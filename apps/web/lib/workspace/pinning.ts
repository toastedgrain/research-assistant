import { evidenceKey, paperRefOf, type SourceEvidence } from "../evidence/source";
import { validateSourceEvidence } from "../evidence/resource";
import type { Manifest } from "../manifest";
import { addBoardNode, addPinnedEvidence } from "./board";
import { addPaperToCollection, createCollection } from "./collections";
import type { ResearchCollection, WorkspaceRepository } from "./types";
import type { EvidencePacket } from "../evidence-graph/types";

export const PINNED_RESEARCH_COLLECTION_ID = "pinned-research";

export type PinVerifiedResult =
  | { status: "pinned"; collection: ResearchCollection }
  | { status: "rejected"; reason: string };

/**
 * Pins only source evidence that resolves against the loaded manifest. User-authored notes
 * use the note path and can never be silently upgraded into verified research evidence.
 */
export async function pinVerifiedEvidence(
  repository: WorkspaceRepository,
  manifest: Manifest,
  evidence: SourceEvidence,
): Promise<PinVerifiedResult> {
  const validation = validateSourceEvidence(evidence, manifest);
  if (validation.status === "unresolved") return { status: "rejected", reason: validation.reason };
  const current = await repository.getCollection(PINNED_RESEARCH_COLLECTION_ID)
    ?? createCollection("Pinned research", { id: PINNED_RESEARCH_COLLECTION_ID });
  const withPaper = addPaperToCollection(current, paperRefOf(manifest));
  const pinned = addPinnedEvidence(withPaper, evidence);
  const index = pinned.boardNodes.length;
  const withCard = addBoardNode(pinned, {
    id: `source-${evidenceKey(evidence)}`,
    source: evidence,
    x: 30 + (index % 4) * 210,
    y: 35 + Math.floor(index / 4) * 150,
  });
  const collection = await repository.saveCollection(withCard);
  return { status: "pinned", collection };
}

/** Persists a source-backed evidence chain without upgrading model interpretation into source truth. */
export async function pinEvidencePacket(
  repository: WorkspaceRepository,
  manifest: Manifest,
  packet: EvidencePacket,
): Promise<PinVerifiedResult> {
  const sources = [...new Map([
    packet.claimEvidence,
    ...packet.supportingEvidence,
    ...packet.reportedResults,
    ...packet.figures,
    ...packet.tables,
    ...packet.methods,
    ...packet.experiments,
    ...packet.datasetsAndBenchmarks,
    ...packet.comparators,
    ...packet.limitations,
    ...packet.citations,
  ].map((item) => [evidenceKey(item), item])).values()];
  if (sources.length === 0) return { status: "rejected", reason: "The evidence packet has no source evidence." };
  for (const source of sources) {
    const validation = validateSourceEvidence(source, manifest);
    if (validation.status === "unresolved") return { status: "rejected", reason: `Evidence packet was not pinned: ${validation.reason}` };
  }
  const current = await repository.getCollection(PINNED_RESEARCH_COLLECTION_ID) ?? createCollection("Pinned research", { id: PINNED_RESEARCH_COLLECTION_ID });
  const withPaper = addPaperToCollection(current, paperRefOf(manifest));
  const id = `evidence-chain-${packet.id}`;
  const artifact = {
    id,
    type: "evidence-chain" as const,
    label: packet.canonicalClaimText.slice(0, 160),
    sourceEvidence: sources,
    generated: packet.relationships.some((edge) => edge.provenance === "generated"),
    createdAt: Date.now(),
    payload: structuredClone(packet),
  };
  const next = withPaper.evidenceArtifacts.some((item) => item.id === id)
    ? withPaper
    : { ...withPaper, evidenceArtifacts: [...withPaper.evidenceArtifacts, artifact], updatedAt: Date.now() };
  return { status: "pinned", collection: await repository.saveCollection(next) };
}
