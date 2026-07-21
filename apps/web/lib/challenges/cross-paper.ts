import type { SourceEvidence } from "../evidence/source";
import type { CrossPaperContextProvider } from "../explore/cross-paper-provider";
import type { PaperTimelineEntry } from "../explore/research-views";
import { challengeEvidence, type ChallengeEvidence, type ChallengeSpec, type EvolutionChallenge, type PaperVsPaperChallenge, type TimelineChallenge } from "./contracts";

const ASSET_EVIDENCE_KINDS = ["figure", "table", "algorithm", "caption"] as const;

function isDirectAssetEvidence(source: SourceEvidence): boolean {
  return ASSET_EVIDENCE_KINDS.includes(source.kind as typeof ASSET_EVIDENCE_KINDS[number]) && Boolean(source.assetId);
}

function sourceEvidence(source: SourceEvidence | undefined, reason: string): ChallengeEvidence | null {
  return source && isDirectAssetEvidence(source) ? challengeEvidence(source, reason) : null;
}

function evidenceForPaper(
  provider: CrossPaperContextProvider,
  paperId: string,
  text?: string,
): ChallengeEvidence | null {
  const source = provider.findEvidence({ paperIds: [paperId], kinds: [...ASSET_EVIDENCE_KINDS], ...(text ? { text } : {}), limit: 20 })
    .find(isDirectAssetEvidence);
  return sourceEvidence(source, "This original asset/caption is the direct source evidence for this paper.");
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
  const evidenceA = evidenceForPaper(provider, paperAId, term);
  const evidenceB = evidenceForPaper(provider, paperBId, term);
  if (!evidenceA || !evidenceB) return null;
  return {
    id: `paper-vs-paper:${paperAId}:${paperBId}:${term.toLocaleLowerCase()}`,
    type: "paper-vs-paper", mode: "scored", paperIds: [paperAId, paperBId], concepts: [], evidence: [evidenceA, evidenceB],
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
  provider: CrossPaperContextProvider,
  entries: readonly PaperTimelineEntry[],
): TimelineChallenge | null {
  if (entries.length < 2 || entries.some((entry) => entry.year === null)) return null;
  const years = entries.map((entry) => entry.year as number);
  if (new Set(years).size !== years.length) return null;
  const ordered = [...entries].sort((a, b) => (a.year as number) - (b.year as number));
  const evidence = ordered.map((entry) => evidenceForPaper(provider, entry.paperId));
  if (evidence.some((item) => !item)) return null;
  const direct = evidence.filter((item): item is ChallengeEvidence => Boolean(item));
  return {
    id: `timeline:${ordered.map((entry) => entry.paperId).join(":")}`,
    type: "timeline", mode: "scored", paperIds: ordered.map((entry) => entry.paperId), concepts: [], evidence: direct,
    prompt: "Order these loaded papers by their verified publication year. This does not assert influence.", difficulty: "easy",
    payload: { kind: "timeline", items: ordered.map((entry) => ({ id: entry.paperId, label: `${entry.title} (${entry.year})` })) },
    answer: {
      kind: "order", itemIds: ordered.map((entry) => entry.paperId),
      relationships: ordered.slice(1).map((entry, position) => ({
        id: `adjacency:${ordered[position].paperId}:${entry.paperId}`,
        evidenceIds: [direct[position].id, direct[position + 1].id],
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
}

export function createEvolutionChallenge(steps: readonly EvolutionStep[]): EvolutionChallenge | null {
  if (steps.length < 2 || steps.some((step) => !isDirectAssetEvidence(step.evidence))) return null;
  const evidence = steps.map((step) => sourceEvidence(step.evidence, "This original asset is the supplied evolution step.")!);
  const generated = steps.some((step) => step.generated);
  const base = {
    id: `evolution:${steps.map((step) => step.id).join(":")}`,
    type: "evolution" as const,
    paperIds: [...new Set(steps.map((step) => step.evidence.paperId))],
    concepts: [], evidence,
    prompt: generated ? "Explore the supplied generated evolution proposal against the original assets." : "Reconstruct the verified supplied sequence of original research artifacts.",
    difficulty: "hard" as const,
    payload: { kind: "evolution" as const, items: steps.map((step) => ({ id: step.id, label: step.label })) }, hints: [],
  };
  if (generated) {
    return {
      ...base, mode: "explore",
      generation: { generated: true, createdAt: new Date(0).toISOString(), groundedEvidenceIds: evidence.map((item) => item.id) },
    };
  }
  return {
    ...base, mode: "scored",
    answer: {
      kind: "order", itemIds: steps.map((step) => step.id),
      relationships: steps.slice(1).map((step, position) => ({
        id: `adjacency:${steps[position].id}:${step.id}`, evidenceIds: [evidence[position].id, evidence[position + 1].id],
        reason: "The caller supplied this source-verified sequence; no relationship was inferred from chronology.",
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
  return challenge ? { paperIds: [paperAId, paperBId], challenges: [challenge] } : null;
}
