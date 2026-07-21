import { canonicalPaperId, createMetadataEvidence, createSourceEvidence, isSourceEvidence, type Evidence, type SourceEvidence } from "../evidence/source";
import type { CrossPaperContextProvider } from "../explore/cross-paper-provider";
import type { PaperTimelineEntry } from "../explore/research-views";
import { challengeEvidence, type ChallengeEvidence, type ChallengeSpec, type EvolutionChallenge, type PaperVsPaperChallenge, type TimelineChallenge } from "./contracts";

const ASSET_EVIDENCE_KINDS = ["figure", "table", "algorithm", "caption"] as const;

function isDirectAssetEvidence(source: SourceEvidence): boolean {
  return ASSET_EVIDENCE_KINDS.includes(source.kind as typeof ASSET_EVIDENCE_KINDS[number]) && Boolean(source.assetId);
}

function canonicalSource(source: SourceEvidence): SourceEvidence {
  const { paperId, ...details } = source;
  return createSourceEvidence(paperId, details);
}

function sourceEvidence(source: SourceEvidence | undefined, reason: string): ChallengeEvidence | null {
  return source && isDirectAssetEvidence(source) ? challengeEvidence(canonicalSource(source), reason) : null;
}

function evidenceForPaper(
  provider: CrossPaperContextProvider,
  paperId: string,
  text?: string,
): ChallengeEvidence | null {
  const source = provider.findEvidence({ paperIds: [paperId], kinds: [...ASSET_EVIDENCE_KINDS], ...(text ? { text } : {}), limit: 20 })
    .find(isDirectAssetEvidence);
  const resolved = source ? provider.resolveEvidence(source) ?? undefined : undefined;
  return sourceEvidence(resolved, "This original asset/caption is the direct source evidence for this paper.");
}

/** A/B/Both only when both paper identities and direct source artifacts resolve. */
export function createPaperVsPaperChallenge(
  provider: CrossPaperContextProvider,
  paperAId: string,
  paperBId: string,
  query: string,
): PaperVsPaperChallenge | null {
  const paperA = provider.getPaper(paperAId);
  const paperB = provider.getPaper(paperBId);
  const term = query.trim();
  if (!paperA || !paperB || !term) return null;
  const canonicalA = paperA.paperId;
  const canonicalB = paperB.paperId;
  const evidenceA = evidenceForPaper(provider, canonicalA, term);
  const evidenceB = evidenceForPaper(provider, canonicalB, term);
  if (!evidenceA || !evidenceB) return null;
  return {
    id: `paper-vs-paper:${canonicalA}:${canonicalB}:${term.toLocaleLowerCase()}`,
    type: "paper-vs-paper", mode: "scored", paperIds: [canonicalA, canonicalB], concepts: [], evidence: [evidenceA, evidenceB],
    prompt: `Which loaded papers provide original asset evidence matching “${term}”?`, difficulty: "medium",
    payload: {
      kind: "paper-vs-paper",
      choices: [{ id: "a", label: paperA.title }, { id: "b", label: paperB.title }, { id: "both", label: "Both papers" }],
      paperLabels: { a: paperA.title, b: paperB.title },
    },
    answer: {
      kind: "choice", correctChoiceIds: ["both"],
      relationships: [{ id: "choice:both", evidenceIds: [evidenceA.id, evidenceB.id], reason: "Each loaded paper has direct source evidence matching the selected term." }],
    }, hints: [], scoring: { maxPoints: 1, partialCredit: false },
  };
}

/**
 * Dev B supplies verified chronology data. Duplicate/unknown years are intentionally not
 * scored: chronology alone must never be presented as causal influence.
 */
export function createTimelineChallenge(
  _provider: CrossPaperContextProvider,
  entries: readonly PaperTimelineEntry[],
): TimelineChallenge | null {
  if (entries.length < 2 || entries.some((entry) => entry.year === null)) return null;
  const years = entries.map((entry) => entry.year as number);
  if (new Set(years).size !== years.length) return null;
  const ordered = entries
    .map((entry) => ({ ...entry, paperId: canonicalPaperId(entry.paperId) }))
    .sort((a, b) => (a.year as number) - (b.year as number));
  const chronology = ordered.map((entry) => challengeEvidence(
    createMetadataEvidence(entry.paperId, { field: "publication-date", value: String(entry.year), label: "Verified arXiv publication year" }),
    "The paper's arXiv identifier provides this publication year.",
  ));
  return {
    id: `timeline:${ordered.map((entry) => entry.paperId).join(":")}`,
    type: "timeline", mode: "scored", paperIds: ordered.map((entry) => entry.paperId), concepts: [], evidence: chronology,
    prompt: "Order these loaded papers by their verified publication year. This does not assert influence.", difficulty: "easy",
    payload: { kind: "timeline", items: ordered.map((entry) => ({ id: entry.paperId, label: `${entry.title} (${entry.year})` })) },
    answer: {
      kind: "order", itemIds: ordered.map((entry) => entry.paperId),
      relationships: ordered.slice(1).map((entry, position) => ({
        id: `adjacency:${ordered[position].paperId}:${entry.paperId}`,
        evidenceIds: [chronology[position].id, chronology[position + 1].id], requiredEvidenceKinds: ["metadata"],
        reason: "The verified publication years establish this chronological order only.",
      })),
    }, hints: [], scoring: { maxPoints: 1, partialCredit: false },
  };
}

export interface EvolutionStep {
  id: string;
  label: string;
  evidence: SourceEvidence;
  /** Generated semantic linkage is visibly Explore-only until independently verified. */
  generated?: boolean;
  relationFromPrevious?: {
    type: "literal-citation" | "chronology";
    evidence: Evidence;
  };
}

export function createEvolutionChallenge(steps: readonly EvolutionStep[]): EvolutionChallenge | null {
  if (steps.length < 2 || steps.some((step) => !isDirectAssetEvidence(step.evidence))) return null;
  const assetEvidence = steps.map((step) => sourceEvidence(step.evidence, "This original asset is the supplied evolution step.")!);
  const relations = steps.slice(1).map((step, position) => {
    const relation = step.relationFromPrevious;
    // A lone date does not prove a pairwise order, and an asset never proves lineage.
    // Chronology is scored by the Timeline factory, which carries dates for both papers.
    if (
      !relation ||
      relation.type !== "literal-citation" ||
      !isSourceEvidence(relation.evidence) ||
      relation.evidence.kind !== "citation" ||
      !relation.evidence.refId ||
      canonicalPaperId(relation.evidence.paperId) !== canonicalPaperId(step.evidence.paperId)
    ) return null;
    return challengeEvidence(
      canonicalSource(relation.evidence),
      "A literal, resolvable citation from this paper to the preceding paper supports this lineage step.",
      { kind: "citation", resourceId: relation.evidence.refId, targetPaperId: canonicalPaperId(steps[position].evidence.paperId) },
    );
  });
  const generated = steps.some((step) => step.generated);
  const verifiedSequence = !generated && relations.every((relationship) => relationship !== null);
  const evidence = [...assetEvidence, ...relations.filter((item): item is ChallengeEvidence => Boolean(item))];
  const base = {
    id: `evolution:${steps.map((step) => step.id).join(":")}`,
    type: "evolution" as const,
    paperIds: [...new Set(steps.map((step) => canonicalPaperId(step.evidence.paperId)))],
    concepts: [], evidence,
    prompt: generated
      ? "Explore the supplied generated evolution proposal against the original assets."
      : verifiedSequence
        ? "Reconstruct the provenance-supported sequence of original research artifacts."
        : "Explore these original artifacts; no verified evolutionary relationship is available for scoring.",
    difficulty: "hard" as const,
    payload: { kind: "evolution" as const, items: steps.map((step) => ({ id: step.id, label: step.label })) }, hints: [],
  };
  if (!verifiedSequence) {
    return {
      ...base, mode: "explore",
      ...(generated ? { generation: { generated: true as const, createdAt: new Date(0).toISOString(), groundedEvidenceIds: evidence.map((item) => item.id) } } : {}),
    };
  }
  return {
    ...base, mode: "scored",
    answer: {
      kind: "order", itemIds: steps.map((step) => step.id),
      relationships: steps.slice(1).map((step, position) => ({
        id: `adjacency:${steps[position].id}:${step.id}`, evidenceIds: [relations[position]!.id],
        requiredEvidenceKinds: [relations[position]!.source.kind],
        reason: relations[position]!.reason,
      })),
    }, scoring: { maxPoints: 1, partialCredit: false },
  };
}

export interface CrossPaperConceptQuest {
  paperIds: string[];
  challenges: ChallengeSpec[];
}

export function createCrossPaperConceptQuest(
  provider: CrossPaperContextProvider,
  paperAId: string,
  paperBId: string,
  query: string,
): CrossPaperConceptQuest | null {
  const challenge = createPaperVsPaperChallenge(provider, paperAId, paperBId, query);
  return challenge ? { paperIds: challenge.paperIds, challenges: [challenge] } : null;
}
