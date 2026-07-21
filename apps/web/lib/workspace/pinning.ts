import { evidenceKey, paperRefOf, type SourceEvidence } from "../evidence/source";
import { validateSourceEvidence } from "../evidence/resource";
import type { Manifest } from "../manifest";
import { addBoardNode, addPinnedEvidence } from "./board";
import { addPaperToCollection, createCollection } from "./collections";
import type { ResearchCollection, WorkspaceRepository } from "./types";

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
