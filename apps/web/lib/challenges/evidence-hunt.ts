import { isSourceEvidence, passageEvidence } from "../evidence/source";
import type { EvidenceResolver } from "../evidence/resource";
import { passageForSelection, type PaperLearningIndex } from "../learning/paper-index";
import type { ResearchContext, SelectionContext } from "../research-context/types";
import {
  challengeEvidence,
  type ChallengeEvaluation,
  type ChallengeEvidence,
  type EvidenceHuntChallenge,
} from "./contracts";
import { validateChallenge } from "./validator";

function evidenceForPassage(
  index: PaperLearningIndex,
  selection: SelectionContext,
): ChallengeEvidence | null {
  const passage = passageForSelection(index, selection);
  if (!passage) return null;
  return challengeEvidence(
    passageEvidence(index.paperId, passage.page, passage.text, {
      ...(passage.bbox ? { bbox: passage.bbox } : {}),
      ...(passage.sectionId ? { sectionId: passage.sectionId } : {}),
    }),
    "This passage is the source-supported location for the selected topic.",
    { kind: "passage", resourceId: passage.id },
  );
}

/** Creates a deterministic, source-only hunt from a reader selection. */
export function createEvidenceHunt(
  context: ResearchContext,
  index: PaperLearningIndex,
): EvidenceHuntChallenge | null {
  if (!context.selection) return null;
  const target = evidenceForPassage(index, context.selection);
  if (!target || target.source.paperId !== context.paper.paperId) return null;
  const term = context.selection.text.replace(/\s+/g, " ").trim();
  if (!term) return null;

  return {
    id: `evidence-hunt:${target.id}`,
    type: "evidence-hunt",
    mode: "scored",
    paperIds: [context.paper.paperId],
    concepts: context.concepts.map((concept) => concept.conceptId),
    evidence: [target],
    prompt: `Find where the authors discuss “${term}”.`,
    difficulty: "easy",
    payload: {
      kind: "evidence-hunt",
      selectionInstruction: "Select the passage in the paper that directly supports this prompt, then check your selection.",
      acceptedEvidenceKinds: ["passage"],
      ...(isSourceEvidence(target.source) && target.source.sectionId ? { closeSectionId: target.source.sectionId } : {}),
    },
    answer: {
      kind: "evidence-hunt",
      acceptedEvidenceIds: [target.id],
      relationships: [
        {
          id: `accepted:${target.id}`,
          evidenceIds: [target.id],
          requiredEvidenceKinds: ["passage"],
          reason: "The accepted passage is the evidence that supports the hunt target.",
        },
      ],
    },
    hints: [],
    scoring: { maxPoints: 1, partialCredit: false },
  };
}

export function evaluateEvidenceHunt(
  challenge: EvidenceHuntChallenge,
  selection: SelectionContext | undefined,
  index: PaperLearningIndex,
  resolver: EvidenceResolver,
): ChallengeEvaluation {
  const validation = validateChallenge(challenge, resolver);
  if (!validation.valid || challenge.mode !== "scored") {
    return {
      state: "unresolved",
      message: "This activity cannot verify a source-grounded answer.",
      points: 0,
      maxPoints: challenge.mode === "scored" ? challenge.scoring.maxPoints : 0,
    };
  }
  if (!selection) {
    return {
      state: "needs-revision",
      message: "Select a source passage in the paper before checking your answer.",
      points: 0,
      maxPoints: challenge.scoring.maxPoints,
    };
  }
  const candidate = evidenceForPassage(index, selection);
  if (!candidate || resolver.resolve(candidate).status === "unresolved") {
    return {
      state: "needs-revision",
      message: "This selection does not resolve to a source passage in the paper.",
      points: 0,
      maxPoints: challenge.scoring.maxPoints,
    };
  }
  const accepted = challenge.answer.acceptedEvidenceIds
    .map((id) => challenge.evidence.find((evidence) => evidence.id === id))
    .filter((evidence): evidence is ChallengeEvidence => Boolean(evidence));
  if (
    accepted.some(
      (target) =>
        target.resource?.kind === "passage" &&
        target.resource.resourceId === candidate.resource?.resourceId,
    )
  ) {
    return {
      state: "supported",
      message: "This selection matches the paper’s cited evidence.",
      points: challenge.scoring.maxPoints,
      maxPoints: challenge.scoring.maxPoints,
    };
  }
  if (!isSourceEvidence(candidate.source)) {
    return { state: "unresolved", message: "The selected evidence is not a PDF source passage.", points: 0, maxPoints: challenge.scoring.maxPoints };
  }
  const candidateSource = candidate.source;
  const acceptedSources = accepted.filter((target) => isSourceEvidence(target.source));
  const targetSections = new Set(
    acceptedSources
      .map((target) => isSourceEvidence(target.source) ? target.source.sectionId : undefined)
      .filter(Boolean),
  );
  const close =
    Boolean(candidateSource.sectionId && targetSections.has(candidateSource.sectionId)) ||
    acceptedSources.some((target) => isSourceEvidence(target.source) && target.source.page === candidateSource.page);
  return close
    ? {
        state: "close",
        message: "This is close, but the source-supported passage is more specific.",
        points: 0,
        maxPoints: challenge.scoring.maxPoints,
      }
    : {
        state: "needs-revision",
        message: "This selection does not match the paper’s cited evidence. Compare it with the source and revise your selection.",
        points: 0,
        maxPoints: challenge.scoring.maxPoints,
      };
}
