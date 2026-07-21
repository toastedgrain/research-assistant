import { assetEvidence, passageEvidence } from "../evidence/source";
import type { Asset } from "../manifest";
import type { PassageRef } from "../research-context/types";
import type { DefinitionObject, ExperimentObject, LearningObject } from "../learning/types";
import type { PaperLearningIndex } from "../learning/paper-index";
import {
  challengeEvidence,
  type ChallengeEvidence,
  type ChallengeSpec,
  type FigureBuildChallenge,
  type FigureDetectiveChallenge,
  type PaperCheckChallenge,
  type PredictionChallenge,
} from "./contracts";

export interface QuestCheckpoint {
  id: string;
  sectionId: string;
  label: string;
  challenges: ChallengeSpec[];
}

export interface QuestPlan {
  paperId: string;
  checkpoints: QuestCheckpoint[];
}

function sourcePassage(index: PaperLearningIndex, source: { page: number; text?: string; bbox?: PassageRef["bbox"]; sectionId?: string }, reason: string): ChallengeEvidence | null {
  const passage = index.passages.find((candidate) => candidate.page === source.page && candidate.text === source.text);
  if (!passage) return null;
  return challengeEvidence(
    passageEvidence(index.paperId, passage.page, passage.text, {
      ...(passage.bbox ? { bbox: passage.bbox } : {}),
      ...(passage.sectionId ? { sectionId: passage.sectionId } : {}),
    }),
    reason,
    { kind: "passage", resourceId: passage.id },
  );
}

function sourceAsset(index: PaperLearningIndex, asset: Asset, reason: string): ChallengeEvidence {
  return challengeEvidence(assetEvidence(index.paperId, asset), reason);
}

function definitions(objects: readonly LearningObject[]): DefinitionObject[] {
  return objects.filter((object): object is DefinitionObject => object.kind === "definition");
}

function sourceForDefinition(index: PaperLearningIndex, definition: DefinitionObject): ChallengeEvidence | null {
  return sourcePassage(index, definition.evidence[0], `The paper explicitly defines “${definition.label}” here.`);
}

function choicesForDefinitions(definitionsForChoices: readonly DefinitionObject[]) {
  return definitionsForChoices.map((definition) => ({ id: definition.id, label: definition.label }));
}

export function createQuickQuiz(index: PaperLearningIndex, objects: readonly LearningObject[]): ChallengeSpec | null {
  const options = definitions(objects);
  const target = options[0];
  if (!target || options.length < 2) return null;
  const targetEvidence = sourceForDefinition(index, target);
  if (!targetEvidence) return null;
  return {
    id: `quick-quiz:${target.id}`,
    type: "multiple-choice", mode: "scored", paperIds: [index.paperId], concepts: [target.id],
    evidence: [targetEvidence],
    prompt: `Which term do the authors explicitly define in this source passage?`,
    difficulty: "easy",
    payload: { kind: "multiple-choice", choices: choicesForDefinitions(options) },
    answer: {
      kind: "choice", correctChoiceIds: [target.id],
      relationships: [{ id: `choice:${target.id}`, evidenceIds: [targetEvidence.id], requiredEvidenceKinds: ["passage"], reason: targetEvidence.reason }],
    },
    hints: [{ id: "read-source", text: "Read the first phrase in the cited passage." }], scoring: { maxPoints: 1, partialCredit: false },
  };
}

export function createConceptMatch(index: PaperLearningIndex, objects: readonly LearningObject[]): ChallengeSpec | null {
  const options = definitions(objects).slice(0, 4);
  if (options.length < 2) return null;
  const evidence = options.map((definition) => sourceForDefinition(index, definition));
  if (evidence.some((item) => !item)) return null;
  const resolvedEvidence = evidence.filter((item): item is ChallengeEvidence => Boolean(item));
  return {
    id: `concept-match:${index.paperId}`, type: "concept-match", mode: "scored", paperIds: [index.paperId],
    concepts: options.map((item) => item.id), evidence: resolvedEvidence,
    prompt: "Match each paper-defined term to its original definition.", difficulty: "medium",
    payload: {
      kind: "concept-match",
      concepts: options.map((definition) => ({ id: definition.id, label: definition.label })),
      definitions: options.map((definition) => ({ id: `${definition.id}:text`, label: definition.definitionText })),
    },
    answer: {
      kind: "pairs", pairs: Object.fromEntries(options.map((definition) => [definition.id, `${definition.id}:text`])),
      relationships: options.map((definition, position) => ({
        id: `pair:${definition.id}:${definition.id}:text`, evidenceIds: [resolvedEvidence[position].id],
        requiredEvidenceKinds: ["passage"], reason: resolvedEvidence[position].reason,
      })),
    },
    hints: [], scoring: { maxPoints: options.length, partialCredit: false },
  };
}

function sourceSections(index: PaperLearningIndex): Array<{ sectionId: string; title: string; evidence: ChallengeEvidence }> {
  return index.manifest.sections.flatMap((section, position) => {
    const sectionId = `sec-${position}`;
    const passage = index.passages.find((candidate) => candidate.sectionId === sectionId);
    const evidence = passage ? sourcePassage(index, passage, `This section is in the authors’ published order.`) : null;
    return evidence ? [{ sectionId, title: section.title, evidence }] : [];
  });
}

export function createFigureBuild(index: PaperLearningIndex): FigureBuildChallenge | null {
  const sections = sourceSections(index).slice(0, 4);
  if (sections.length < 2) return null;
  const items = sections.map((section) => ({ id: section.sectionId, label: section.title }));
  return {
    id: `figure-build:${index.paperId}`, type: "figure-build", mode: "scored", paperIds: [index.paperId], concepts: [],
    evidence: sections.map((section) => section.evidence),
    prompt: "Build the paper’s source-verified structural flow by placing its sections in order.", difficulty: "medium",
    payload: { kind: "figure-build", items, diagramLabel: "Paper structure" },
    answer: {
      kind: "order", itemIds: items.map((item) => item.id),
      relationships: sections.slice(1).map((section, position) => ({
        id: `adjacency:${sections[position].sectionId}:${section.sectionId}`,
        evidenceIds: [sections[position].evidence.id, section.evidence.id], requiredEvidenceKinds: ["passage"],
        reason: "The author’s section order grounds this structural adjacency.",
      })),
    },
    hints: [], scoring: { maxPoints: 1, partialCredit: false },
  };
}

export function createFigureDetective(index: PaperLearningIndex, sectionId?: string): FigureDetectiveChallenge | null {
  const candidates = index.manifest.assets.filter((asset) => !sectionId || asset.page >= (index.manifest.sections[Number(sectionId.replace("sec-", ""))]?.page ?? 0));
  const target = candidates.find((asset) => asset.kind === "figure") ?? index.manifest.assets.find((asset) => asset.kind === "figure");
  if (!target || index.manifest.assets.length < 2 || !target.caption) return null;
  const evidence = sourceAsset(index, target, `The original caption for ${target.label} identifies this asset.`);
  const choices = index.manifest.assets.slice(0, 4).map((asset) => ({ id: asset.asset_id, label: asset.label }));
  if (!choices.some((choice) => choice.id === target.asset_id)) choices.unshift({ id: target.asset_id, label: target.label });
  return {
    id: `figure-detective:${target.asset_id}`, type: "figure-detective", mode: "scored", paperIds: [index.paperId], concepts: [], evidence: [evidence],
    prompt: `Which original asset has the caption “${target.caption}”?`, difficulty: "easy",
    payload: { kind: "figure-detective", choices, assetId: target.asset_id },
    answer: {
      kind: "choice", correctChoiceIds: [target.asset_id],
      relationships: [{ id: `choice:${target.asset_id}`, evidenceIds: [evidence.id], requiredEvidenceKinds: [target.kind], reason: evidence.reason }],
    },
    hints: [{ id: "caption", text: "Open the source evidence to inspect the original caption." }], scoring: { maxPoints: 1, partialCredit: false },
  };
}

function experimentEvidence(index: PaperLearningIndex, experiment: ExperimentObject) {
  const method = sourcePassage(index, experiment.methodEvidence[0], "This is the paper’s reported pre-result context.");
  const result = sourcePassage(index, experiment.resultEvidence[0], "This is the paper’s reported result.");
  return method && result ? { method, result } : null;
}

export function createPrediction(index: PaperLearningIndex, objects: readonly LearningObject[]): PredictionChallenge | null {
  const experiment = objects.find((object): object is ExperimentObject => object.kind === "experiment");
  if (!experiment) return null;
  const evidence = experimentEvidence(index, experiment);
  if (!evidence) return null;
  return {
    id: `prediction:${experiment.id}`, type: "prediction", mode: "explore", paperIds: [index.paperId], concepts: [], evidence: [evidence.method, evidence.result],
    prompt: "Before revealing the authors’ reported result, what outcome would you predict from this source context?", difficulty: "medium",
    payload: {
      kind: "prediction", choices: [
        { id: "improves", label: "The reported outcome improves" },
        { id: "similar", label: "The reported outcome is similar" },
        { id: "worse", label: "The reported outcome is worse" },
      ], resultEvidenceId: evidence.result.id,
    },
    hints: [{ id: "reveal", text: "Reveal the paper’s result after making your own prediction." }],
  };
}

export function createClaimEvidence(index: PaperLearningIndex, objects: readonly LearningObject[]): ChallengeSpec | null {
  const claims = objects.filter((object) => object.kind === "claim");
  const match = claims.flatMap((claim) => index.manifest.assets
    .filter((asset) => claim.claimText.includes(asset.label))
    .map((asset) => ({ claim, asset })))[0];
  if (!match || index.manifest.assets.length < 2) return null;
  const claimEvidence = sourcePassage(index, match.claim.evidence[0], "This claim explicitly names the supporting source asset.");
  if (!claimEvidence) return null;
  const assetEvidence = sourceAsset(index, match.asset, `This is the asset explicitly named by the claim.`);
  const choices = index.manifest.assets.slice(0, 4).map((asset) => ({ id: asset.asset_id, label: asset.label }));
  if (!choices.some((choice) => choice.id === match.asset.asset_id)) choices.unshift({ id: match.asset.asset_id, label: match.asset.label });
  return {
    id: `claim-evidence:${match.claim.id}`, type: "claim-evidence", mode: "scored", paperIds: [index.paperId], concepts: [], evidence: [claimEvidence, assetEvidence],
    prompt: `Which original asset is explicitly named by this claim?`, difficulty: "medium",
    payload: { kind: "claim-evidence", choices, claimEvidenceId: claimEvidence.id, relationship: "supports" },
    answer: {
      kind: "choice", correctChoiceIds: [match.asset.asset_id],
      relationships: [{ id: `choice:${match.asset.asset_id}`, evidenceIds: [claimEvidence.id, assetEvidence.id], requiredEvidenceKinds: ["passage", match.asset.kind], reason: "The claim literally names this asset." }],
    }, hints: [], scoring: { maxPoints: 1, partialCredit: false },
  };
}

export function createPaperCheck(index: PaperLearningIndex, objects: readonly LearningObject[]): ChallengeSpec | null {
  const quick = createQuickQuiz(index, objects);
  if (!quick || quick.payload.kind !== "multiple-choice" || quick.mode !== "scored" || quick.answer.kind !== "choice") return null;
  const check: PaperCheckChallenge = {
    id: `paper-check:${quick.id}`, type: "paper-check", mode: "scored", paperIds: quick.paperIds,
    concepts: quick.concepts, evidence: quick.evidence,
    prompt: `Paper Check — terminology: ${quick.prompt}`, difficulty: quick.difficulty,
    payload: { kind: "paper-check", choices: quick.payload.choices, category: "terminology" },
    answer: quick.answer, hints: quick.hints, scoring: quick.scoring,
  };
  return check;
}

/** At most two meaningful, user-triggered checkpoints per major section. */
export function createSectionChallenges(index: PaperLearningIndex, objects: readonly LearningObject[], sectionId: string): ChallengeSpec[] {
  const sectionPosition = Number(sectionId.replace("sec-", ""));
  if (!Number.isInteger(sectionPosition) || sectionPosition < 0) return [];
  const last = index.manifest.sections.length - 1;
  const candidates = sectionPosition === 0
    ? [createQuickQuiz(index, objects), createConceptMatch(index, objects)]
    : sectionPosition === last
      ? [createClaimEvidence(index, objects), createFigureBuild(index)]
      : [createFigureDetective(index, sectionId), createPrediction(index, objects)];
  return candidates.filter((challenge): challenge is ChallengeSpec => Boolean(challenge)).slice(0, 2);
}

export function createQuestPlan(index: PaperLearningIndex, objects: readonly LearningObject[]): QuestPlan {
  return {
    paperId: index.paperId,
    checkpoints: index.manifest.sections.map((section, position) => ({
      id: `${index.paperId}:checkpoint:sec-${position}`,
      sectionId: `sec-${position}`,
      label: section.title,
      challenges: createSectionChallenges(index, objects, `sec-${position}`),
    })),
  };
}
