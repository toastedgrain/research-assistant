import { assetEvidence, passageEvidence } from "../evidence/source";
import { buildPrerequisiteGraph } from "../learning/prerequisites";
import type { PaperLearningIndex } from "../learning/paper-index";
import { buildConceptThread } from "../learning/threads";
import type { DefinitionObject, ExperimentObject, LearningObject } from "../learning/types";
import { createMiniDiagram } from "../learning/visualize";
import type { Asset } from "../manifest";
import type { PassageRef } from "../research-context/types";
import {
  challengeEvidence,
  type ChallengeEvidence,
  type ChallengeSpec,
  type FigureBuildChallenge,
  type FigureDetectiveChallenge,
  type PaperCheckChallenge,
  type PrerequisiteChallenge,
  type PredictionChallenge,
  type ThreadExpeditionChallenge,
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

function sourcePassage(
  index: PaperLearningIndex,
  source: { page: number; text?: string; bbox?: PassageRef["bbox"]; sectionId?: string },
  reason: string,
): ChallengeEvidence | null {
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
  return sourcePassage(index, definition.evidence[0], `The paper explicitly defines "${definition.label}" here.`);
}

function choicesForDefinitions(items: readonly DefinitionObject[]) {
  return items.map((definition) => ({ id: definition.id, label: definition.label }));
}

function uniqueEvidence(items: readonly ChallengeEvidence[]): ChallengeEvidence[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export function createQuickQuiz(index: PaperLearningIndex, objects: readonly LearningObject[]): ChallengeSpec | null {
  const options = definitions(objects).slice(0, 4);
  const target = options[0];
  if (target && options.length >= 2) {
    const targetEvidence = sourceForDefinition(index, target);
    if (!targetEvidence) return null;
    return {
      id: `quick-quiz:${target.id}`,
      type: "multiple-choice", mode: "scored", paperIds: [index.paperId], concepts: [target.id], evidence: [targetEvidence],
      prompt: "Which term do the authors explicitly define in this source passage?", difficulty: "easy",
      payload: { kind: "multiple-choice", choices: choicesForDefinitions(options) },
      answer: {
        kind: "choice", correctChoiceIds: [target.id],
        relationships: [{ id: `choice:${target.id}`, evidenceIds: [targetEvidence.id], requiredEvidenceKinds: ["passage"], reason: targetEvidence.reason }],
      },
      hints: [{ id: "read-source", text: "Read the first phrase in the cited passage." }],
      scoring: { maxPoints: 1, partialCredit: false },
    };
  }

  // A caption-label lookup is a conservative fallback when a paper has no explicit definitions.
  const captioned = index.manifest.assets.filter((asset) => asset.caption).slice(0, 4);
  const asset = captioned[0];
  if (!asset || captioned.length < 2) return null;
  const evidence = sourceAsset(index, asset, `This is the original ${asset.label} and caption.`);
  return {
    id: `quick-quiz:${asset.asset_id}`, type: "multiple-choice", mode: "scored", paperIds: [index.paperId], concepts: [], evidence: [evidence],
    prompt: `Which original asset is captioned "${asset.caption}"?`, difficulty: "easy",
    payload: { kind: "multiple-choice", choices: captioned.map((item) => ({ id: item.asset_id, label: item.label })) },
    answer: {
      kind: "choice", correctChoiceIds: [asset.asset_id],
      relationships: [{ id: `choice:${asset.asset_id}`, evidenceIds: [evidence.id], requiredEvidenceKinds: [asset.kind], reason: evidence.reason }],
    },
    hints: [], scoring: { maxPoints: 1, partialCredit: false },
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
    const evidence = passage ? sourcePassage(index, passage, "This passage anchors the section in the authors' published order.") : null;
    return evidence ? [{ sectionId, title: section.title, evidence }] : [];
  });
}

export function createOrdering(index: PaperLearningIndex): ChallengeSpec | null {
  const sections = sourceSections(index).slice(0, 4);
  if (sections.length < 2) return null;
  const items = sections.map((section) => ({ id: section.sectionId, label: section.title }));
  return {
    id: `ordering:${index.paperId}`, type: "ordering", mode: "scored", paperIds: [index.paperId], concepts: [],
    evidence: sections.map((section) => section.evidence),
    prompt: "Place these sections in the order published by the authors.", difficulty: "easy",
    payload: { kind: "ordering", items },
    answer: {
      kind: "order", itemIds: items.map((item) => item.id),
      relationships: sections.slice(1).map((section, position) => ({
        id: `adjacency:${sections[position].sectionId}:${section.sectionId}`,
        evidenceIds: [sections[position].evidence.id, section.evidence.id], requiredEvidenceKinds: ["passage"],
        reason: "The authors' published section order grounds this adjacency.",
      })),
    },
    hints: [], scoring: { maxPoints: 1, partialCredit: false },
  };
}

export function createFigureBuild(index: PaperLearningIndex, objects: readonly LearningObject[]): FigureBuildChallenge | null {
  const target = objects.find((object) => object.kind === "concept") ?? objects.find((object) => object.kind === "definition");
  if (!target) return null;
  const diagram = createMiniDiagram(target, objects);
  const edge = diagram?.edges[0];
  if (!diagram || diagram.nodes.length < 2 || !edge?.evidence[0]) return null;
  const evidence = sourcePassage(index, edge.evidence[0], `This controlled diagram relocates the paper's literal definition of ${target.label}.`);
  if (!evidence) return null;
  const items = diagram.nodes.map((node) => ({ id: node.id, label: node.label }));
  return {
    id: `figure-build:${target.id}`, type: "figure-build", mode: "scored", paperIds: [index.paperId], concepts: [target.id], evidence: [evidence],
    prompt: "Build this controlled source map by placing the concept before its source definition.", difficulty: "medium",
    payload: { kind: "figure-build", items, diagramLabel: diagram.label },
    answer: {
      kind: "order", itemIds: [edge.from, edge.to],
      relationships: [{ id: `adjacency:${edge.from}:${edge.to}`, evidenceIds: [evidence.id], requiredEvidenceKinds: ["passage"], reason: evidence.reason }],
    },
    hints: [{ id: "controlled-diagram", text: "No topology was inferred from figure pixels." }],
    scoring: { maxPoints: 1, partialCredit: false },
  };
}

export function createFigureDetective(index: PaperLearningIndex, sectionId?: string): FigureDetectiveChallenge | null {
  const sectionPage = sectionId ? index.manifest.sections[Number(sectionId.replace("sec-", ""))]?.page : undefined;
  const figures = index.manifest.assets.filter((asset) => asset.kind === "figure" && (sectionPage === undefined || asset.page >= sectionPage));
  const target = figures[0] ?? index.manifest.assets.find((asset) => asset.kind === "figure");
  const choicesFrom = index.manifest.assets.filter((asset) => asset.caption).slice(0, 4);
  if (!target?.caption || choicesFrom.length < 2) return null;
  if (!choicesFrom.some((asset) => asset.asset_id === target.asset_id)) choicesFrom.unshift(target);
  const evidence = sourceAsset(index, target, `The original crop and caption identify ${target.label}.`);
  return {
    id: `figure-detective:${target.asset_id}`, type: "figure-detective", mode: "scored", paperIds: [index.paperId], concepts: [], evidence: [evidence],
    prompt: "Inspect the original crop with its caption hidden. Which source caption belongs to it?", difficulty: "easy",
    payload: { kind: "figure-detective", choices: choicesFrom.map((asset) => ({ id: asset.asset_id, label: asset.caption ?? asset.label })), assetId: target.asset_id },
    answer: {
      kind: "choice", correctChoiceIds: [target.asset_id],
      relationships: [{ id: `choice:${target.asset_id}`, evidenceIds: [evidence.id], requiredEvidenceKinds: [target.kind], reason: evidence.reason }],
    },
    hints: [{ id: "visual", text: "Use only properties visibly present in the source crop." }], scoring: { maxPoints: 1, partialCredit: false },
  };
}

function experimentEvidence(index: PaperLearningIndex, experiment: ExperimentObject) {
  const method = sourcePassage(index, experiment.methodEvidence[0], "This is the paper's reported pre-result context.");
  const result = sourcePassage(index, experiment.resultEvidence[0], "This is the paper's reported result.");
  return method && result ? { method, result } : null;
}

export function createPrediction(index: PaperLearningIndex, objects: readonly LearningObject[]): PredictionChallenge | null {
  const experiment = objects.find((object): object is ExperimentObject => object.kind === "experiment");
  if (!experiment) return null;
  const evidence = experimentEvidence(index, experiment);
  if (!evidence) return null;
  return {
    id: `prediction:${experiment.id}`, type: "prediction", mode: "explore", paperIds: [index.paperId], concepts: [],
    evidence: [evidence.method, evidence.result],
    prompt: "Before revealing the authors' reported result, what outcome would you predict from this source context?", difficulty: "medium",
    payload: {
      kind: "prediction", choices: [
        { id: "improves", label: "The reported outcome improves" },
        { id: "similar", label: "The reported outcome is similar" },
        { id: "worse", label: "The reported outcome is worse" },
      ], resultEvidenceId: evidence.result.id,
    },
    hints: [{ id: "reveal", text: "Commit to a prediction, then reveal the paper's result." }],
  };
}

export function createClaimEvidence(index: PaperLearningIndex, objects: readonly LearningObject[]): ChallengeSpec | null {
  const claims = objects.filter((object) => object.kind === "claim");
  const match = claims.flatMap((claim) => index.manifest.assets
    .filter((asset) => claim.claimText.includes(asset.label))
    .map((asset) => ({ claim, asset })))[0];
  if (!match || index.manifest.assets.length < 2) return null;
  const claimSource = sourcePassage(index, match.claim.evidence[0], "This source claim explicitly names the supporting asset.");
  if (!claimSource) return null;
  const namedAsset = sourceAsset(index, match.asset, "This is the asset literally named by the claim.");
  const choices = index.manifest.assets.slice(0, 4).map((asset) => ({ id: asset.asset_id, label: asset.label }));
  if (!choices.some((choice) => choice.id === match.asset.asset_id)) choices.unshift({ id: match.asset.asset_id, label: match.asset.label });
  return {
    id: `claim-evidence:${match.claim.id}`, type: "claim-evidence", mode: "scored", paperIds: [index.paperId], concepts: [],
    evidence: [claimSource, namedAsset], prompt: "Which original asset is explicitly named as support by this source claim?", difficulty: "medium",
    payload: { kind: "claim-evidence", choices, claimEvidenceId: claimSource.id, relationship: "supports" },
    answer: {
      kind: "choice", correctChoiceIds: [match.asset.asset_id],
      relationships: [{ id: `choice:${match.asset.asset_id}`, evidenceIds: [claimSource.id, namedAsset.id], requiredEvidenceKinds: ["passage", match.asset.kind], reason: "The source claim literally names this asset." }],
    },
    hints: [], scoring: { maxPoints: 1, partialCredit: false },
  };
}

export function createPrerequisiteChallenge(index: PaperLearningIndex, objects: readonly LearningObject[]): PrerequisiteChallenge | null {
  const concepts = objects.filter((object) => object.kind === "concept");
  for (const concept of concepts) {
    const graph = buildPrerequisiteGraph(objects, concept.label);
    const edge = graph.edges.find((candidate) => !candidate.generated && candidate.source.length > 0);
    if (!edge) continue;
    const source = sourcePassage(index, edge.source[0], `The paper literally states this dependency for ${concept.label}.`);
    const from = graph.nodes.find((node) => node.id === edge.from);
    const to = graph.nodes.find((node) => node.id === edge.to);
    if (!source || !from || !to) continue;
    return {
      id: `prerequisite:${concept.id}`, type: "prerequisite", mode: "scored", paperIds: [index.paperId], concepts: [concept.id], evidence: [source],
      prompt: `Which source-derived prerequisite comes before ${to.label}?`, difficulty: "medium",
      payload: { kind: "prerequisite", rootId: to.id, items: [{ id: from.id, label: from.label }, { id: to.id, label: to.label }] },
      answer: {
        kind: "order", itemIds: [from.id, to.id],
        relationships: [{ id: `adjacency:${from.id}:${to.id}`, evidenceIds: [source.id], requiredEvidenceKinds: ["passage"], reason: source.reason }],
      },
      hints: [], scoring: { maxPoints: 1, partialCredit: false },
    };
  }
  return null;
}

export function createThreadExpedition(index: PaperLearningIndex, objects: readonly LearningObject[]): ThreadExpeditionChallenge | null {
  const concepts = objects.filter((object) => object.kind === "concept");
  for (const concept of concepts) {
    const thread = buildConceptThread({ paperId: index.paperId, concept: concept.label, pages: index.pages, sections: index.manifest.sections, assets: index.manifest.assets });
    if (thread.occurrences.length < 2) continue;
    const occurrences = thread.occurrences.slice(0, 5);
    const evidence = occurrences.map((occurrence, position) => challengeEvidence(
      occurrence.evidence,
      `This is source occurrence ${position + 1} of ${concept.label}.`,
      { kind: "passage", resourceId: occurrence.passage.id },
    ));
    const items = occurrences.map((occurrence) => ({ id: occurrence.id, label: `p. ${occurrence.page + 1}: ${occurrence.passage.text.slice(0, 90)}` }));
    return {
      id: `thread-expedition:${concept.id}`, type: "thread-expedition", mode: "scored", paperIds: [index.paperId], concepts: [concept.id], evidence,
      prompt: `Trace ${concept.label} through the paper in source order.`, difficulty: "medium",
      payload: { kind: "thread-expedition", conceptLabel: concept.label, items },
      answer: {
        kind: "order", itemIds: items.map(({ id }) => id),
        relationships: items.slice(1).map((item, position) => ({
          id: `adjacency:${items[position].id}:${item.id}`, evidenceIds: [evidence[position].id, evidence[position + 1].id],
          requiredEvidenceKinds: ["passage"], reason: "The page and occurrence order are observed directly in the paper.",
        })),
      },
      hints: [], scoring: { maxPoints: 1, partialCredit: false },
    };
  }
  return null;
}

function sectionQuestion(index: PaperLearningIndex, category: "method" | "result", pattern: RegExp) {
  const sections = sourceSections(index);
  const target = sections.find((section) => pattern.test(section.title));
  if (!target || sections.length < 2) return null;
  return {
    id: category,
    prompt: `Which section is anchored by this ${category} source passage?`,
    category,
    choices: sections.slice(0, 4).map((section) => ({ id: section.sectionId, label: section.title })),
    correct: target.sectionId,
    evidence: target.evidence,
  } as const;
}

export function createPaperCheck(index: PaperLearningIndex, objects: readonly LearningObject[]): PaperCheckChallenge | null {
  const termDefinitions = definitions(objects).slice(0, 4);
  const term = termDefinitions[0];
  const termEvidence = term ? sourceForDefinition(index, term) : null;
  const method = sectionQuestion(index, "method", /method|approach|model|architecture/i);
  const result = sectionQuestion(index, "result", /result|experiment|evaluation|analysis/i);
  const detective = createFigureDetective(index);
  const claim = createClaimEvidence(index, objects);
  if (!term || termDefinitions.length < 2 || !termEvidence || !method || !result || !detective || detective.mode !== "scored" || claim?.mode !== "scored" || claim.answer.kind !== "choice" || claim.payload.kind !== "claim-evidence") return null;

  const questions: PaperCheckChallenge["payload"]["questions"] = [
    { id: "terminology", category: "terminology", prompt: "Which term is explicitly defined in the cited source?", choices: choicesForDefinitions(termDefinitions) },
    { id: method.id, category: method.category, prompt: method.prompt, choices: method.choices },
    { id: "evidence", category: "evidence", prompt: detective.prompt, choices: detective.payload.choices },
    { id: result.id, category: result.category, prompt: result.prompt, choices: result.choices },
    { id: "relationships", category: "relationships", prompt: claim.prompt, choices: claim.payload.choices },
  ];
  const answers = {
    terminology: term.id,
    method: method.correct,
    evidence: detective.answer.correctChoiceIds[0],
    result: result.correct,
    relationships: claim.answer.correctChoiceIds[0],
  };
  const evidence = uniqueEvidence([termEvidence, method.evidence, ...detective.evidence, result.evidence, ...claim.evidence]);
  const relationshipFor = (questionId: keyof typeof answers, evidenceIds: string[], reason: string) => ({
    id: `question:${questionId}:${answers[questionId]}`, evidenceIds, reason,
  });
  return {
    id: `paper-check:${index.paperId}`, type: "paper-check", mode: "scored", paperIds: [index.paperId],
    concepts: termDefinitions.map((item) => item.id), evidence,
    prompt: "Paper Check: terminology, method, evidence, results, and source relationships.", difficulty: "hard",
    payload: { kind: "paper-check", questions },
    answer: {
      kind: "paper-check", answers,
      relationships: [
        relationshipFor("terminology", [termEvidence.id], termEvidence.reason),
        relationshipFor("method", [method.evidence.id], method.evidence.reason),
        relationshipFor("evidence", detective.answer.relationships[0].evidenceIds, detective.answer.relationships[0].reason),
        relationshipFor("result", [result.evidence.id], result.evidence.reason),
        relationshipFor("relationships", claim.answer.relationships[0].evidenceIds, claim.answer.relationships[0].reason),
      ],
    },
    hints: [], scoring: { maxPoints: questions.length, partialCredit: true },
  };
}

/** At most two meaningful, user-triggered checkpoints per major section. */
export function createSectionChallenges(index: PaperLearningIndex, objects: readonly LearningObject[], sectionId: string): ChallengeSpec[] {
  const sectionPosition = Number(sectionId.replace("sec-", ""));
  if (!Number.isInteger(sectionPosition) || sectionPosition < 0) return [];
  const last = index.manifest.sections.length - 1;
  const candidates = sectionPosition === 0
    ? [createQuickQuiz(index, objects), createConceptMatch(index, objects)]
    : sectionPosition === last
      ? [createClaimEvidence(index, objects), createOrdering(index)]
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
