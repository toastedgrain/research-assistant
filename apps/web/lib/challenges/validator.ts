import { canonicalPaperId, evidenceKey, type EvidenceKind } from "../evidence/source";
import type { EvidenceResolver } from "../evidence/resource";
import type {
  ChallengeChoice,
  ChallengeSpec,
  GroundedRelationship,
} from "./contracts";

export interface ChallengeValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function choicesAreDistinct(choices: ChallengeChoice[]): boolean {
  const ids = new Set(choices.map((choice) => choice.id));
  const labels = new Set(choices.map((choice) => normalized(choice.label)));
  return choices.length > 0 && ids.size === choices.length && labels.size === choices.length;
}

function choicePayloadChoices(challenge: ChallengeSpec): ChallengeChoice[] | null {
  const payload = challenge.payload;
  return payload.kind === "multiple-choice" ||
    payload.kind === "figure-detective" ||
    payload.kind === "prediction" ||
    payload.kind === "claim-evidence" ||
    payload.kind === "paper-vs-paper"
    ? payload.choices
    : null;
}

function orderingPayloadItems(challenge: ChallengeSpec): ChallengeChoice[] | null {
  const payload = challenge.payload;
  return payload.kind === "ordering" ||
    payload.kind === "figure-build" ||
    payload.kind === "timeline" ||
    payload.kind === "evolution" ||
    payload.kind === "prerequisite" ||
    payload.kind === "thread-expedition"
    ? payload.items
    : null;
}

function evidenceKindsMatch(
  relationship: GroundedRelationship,
  kinds: readonly EvidenceKind[],
): boolean {
  return !relationship.requiredEvidenceKinds || relationship.requiredEvidenceKinds.every((kind) => kinds.includes(kind));
}

function validateRelationships(
  relationships: GroundedRelationship[],
  evidence: Map<string, { kind: EvidenceKind }>,
  requiredIds: string[],
  errors: string[],
): void {
  const relationshipById = new Map(relationships.map((relationship) => [relationship.id, relationship]));
  for (const requiredId of requiredIds) {
    if (!relationshipById.has(requiredId)) {
      errors.push(`Expected relationship ${requiredId} has no direct evidence.`);
    }
  }
  for (const relationship of relationships) {
    if (relationship.evidenceIds.length === 0) {
      errors.push(`Relationship ${relationship.id} has no supporting evidence.`);
      continue;
    }
    const kinds: EvidenceKind[] = [];
    for (const evidenceId of relationship.evidenceIds) {
      const item = evidence.get(evidenceId);
      if (!item) errors.push(`Relationship ${relationship.id} references unknown evidence ${evidenceId}.`);
      else kinds.push(item.kind);
    }
    if (!evidenceKindsMatch(relationship, kinds)) {
      errors.push(`Relationship ${relationship.id} has incompatible evidence kinds.`);
    }
  }
}

function validatePayload(challenge: ChallengeSpec, errors: string[]): void {
  if (challenge.type !== challenge.payload.kind) {
    errors.push("Challenge type does not match its payload.");
    return;
  }
  const choices = choicePayloadChoices(challenge);
  const items = orderingPayloadItems(challenge);
  if (choices && !choicesAreDistinct(choices)) {
    errors.push("Choice labels must be distinct.");
  }
  if (challenge.payload.kind === "concept-match") {
    if (!choicesAreDistinct(challenge.payload.concepts) || !choicesAreDistinct(challenge.payload.definitions)) {
      errors.push("Match items must be distinct.");
    }
  }
  if (challenge.payload.kind === "paper-check") {
    const ids = new Set(challenge.payload.questions.map(({ id }) => id));
    if (challenge.payload.questions.length < 2 || ids.size !== challenge.payload.questions.length) {
      errors.push("Paper Check requires distinct questions across multiple categories.");
    }
    for (const question of challenge.payload.questions) {
      if (!choicesAreDistinct(question.choices)) errors.push(`Paper Check question ${question.id} requires distinct choices.`);
    }
  }
  if (items && !choicesAreDistinct(items)) {
    errors.push("Order items must be distinct.");
  }
  if (challenge.payload.kind === "evidence-hunt" && !challenge.payload.acceptedEvidenceKinds.includes("passage")) {
    errors.push("Evidence Hunt must accept passage evidence.");
  }
}

function validateAnswer(challenge: Extract<ChallengeSpec, { mode: "scored" }>, errors: string[]): void {
  const evidenceById = new Map(
    challenge.evidence.map((item) => [item.id, { kind: item.source.kind }]),
  );
  const choices = choicePayloadChoices(challenge);
  const items = orderingPayloadItems(challenge);
  if (challenge.answer.kind === "choice" && choices) {
    const choiceIds = new Set(choices.map((choice) => choice.id));
    const correctIds = challenge.answer.correctChoiceIds;
    if (correctIds.length === 0 || new Set(correctIds).size !== correctIds.length || correctIds.some((id) => !choiceIds.has(id))) {
      errors.push("Expected answer must reference an available choice.");
    }
    if (challenge.payload.kind === "multiple-choice" && !challenge.payload.multiple && correctIds.length !== 1) {
      errors.push("Single-answer multiple choice requires exactly one correct choice id.");
    }
    validateRelationships(
      challenge.answer.relationships,
      evidenceById,
      challenge.answer.correctChoiceIds.map((id) => `choice:${id}`),
      errors,
    );
    return;
  }
  if (challenge.answer.kind === "pairs" && challenge.payload.kind === "concept-match") {
    const concepts = new Set(challenge.payload.concepts.map((item) => item.id));
    const definitions = new Set(challenge.payload.definitions.map((item) => item.id));
    const pairs = Object.entries(challenge.answer.pairs);
    if (
      pairs.length !== concepts.size ||
      pairs.some(([concept, definition]) => !concepts.has(concept) || !definitions.has(definition))
    ) {
      errors.push("Expected pairs must cover every concept and definition.");
    }
    validateRelationships(
      challenge.answer.relationships,
      evidenceById,
      pairs.map(([concept, definition]) => `pair:${concept}:${definition}`),
      errors,
    );
    return;
  }
  if (challenge.answer.kind === "order" && items) {
    const itemIds = new Set(items.map((item) => item.id));
    const answer = challenge.answer;
    if (
      answer.itemIds.length !== itemIds.size ||
      answer.itemIds.some((id) => !itemIds.has(id))
    ) {
      errors.push("Expected order must contain every item exactly once.");
    }
    validateRelationships(
      answer.relationships,
      evidenceById,
      answer.itemIds.slice(1).map((item, index) => `adjacency:${answer.itemIds[index]}:${item}`),
      errors,
    );
    return;
  }
  if (challenge.answer.kind === "evidence-hunt" && challenge.payload.kind === "evidence-hunt") {
    if (challenge.answer.acceptedEvidenceIds.length === 0) {
      errors.push("Evidence Hunt requires an accepted source passage.");
    }
    for (const evidenceId of challenge.answer.acceptedEvidenceIds) {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence || evidence.kind === "metadata" || !challenge.payload.acceptedEvidenceKinds.includes(evidence.kind)) {
        errors.push("Evidence Hunt accepted evidence is incompatible with its target.");
      }
    }
    validateRelationships(
      challenge.answer.relationships,
      evidenceById,
      challenge.answer.acceptedEvidenceIds.map((id) => `accepted:${id}`),
      errors,
    );
    return;
  }
  if (challenge.answer.kind === "paper-check" && challenge.payload.kind === "paper-check") {
    const questions = new Map(challenge.payload.questions.map((question) => [question.id, question]));
    const answers = Object.entries(challenge.answer.answers);
    if (answers.length !== questions.size || answers.some(([questionId, choiceId]) => !questions.get(questionId)?.choices.some(({ id }) => id === choiceId))) {
      errors.push("Paper Check answers must cover every question with an available choice.");
    }
    validateRelationships(
      challenge.answer.relationships,
      evidenceById,
      answers.map(([questionId, choiceId]) => `question:${questionId}:${choiceId}`),
      errors,
    );
    return;
  }
  errors.push("Challenge answer does not match its payload.");
}

/**
 * Fail-closed validator for all scored relationships. Explore specs still get structural
 * validation, but unresolved evidence stays a warning because it cannot produce score or
 * verified-correct feedback.
 */
export function validateChallenge(
  challenge: ChallengeSpec,
  resolver?: EvidenceResolver,
): ChallengeValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  validatePayload(challenge, errors);
  if (challenge.paperIds.some((paperId) => paperId !== canonicalPaperId(paperId))) {
    errors.push("Challenge paper ids must use the canonical representation.");
  }

  const evidenceIds = new Set<string>();
  for (const item of challenge.evidence) {
    if (!item.id || item.id !== evidenceKey(item.source)) {
      errors.push("Challenge evidence id must match the canonical evidence key.");
    }
    if (evidenceIds.has(item.id)) errors.push("Challenge evidence ids must be distinct.");
    evidenceIds.add(item.id);
    if (!challenge.paperIds.includes(canonicalPaperId(item.source.paperId))) {
      errors.push("Challenge evidence belongs to a paper outside the challenge.");
    }
    const resolution = resolver?.resolve(item);
    if (challenge.mode === "scored") {
      if (!resolver) errors.push("Scored challenges require an evidence resolver.");
      else if (resolution?.status === "unresolved") errors.push(resolution.reason);
    } else if (resolution?.status === "unresolved") {
      warnings.push(resolution.reason);
    }
  }

  if (challenge.mode === "explore") {
    if ("answer" in challenge || "scoring" in challenge) {
      errors.push("Explore challenges cannot carry an expected answer or scoring.");
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  if (challenge.evidence.length === 0) errors.push("Scored challenges require source evidence.");
  if (challenge.scoring.maxPoints <= 0) errors.push("Scored challenges require positive points.");
  validateAnswer(challenge, errors);
  return { valid: errors.length === 0, errors, warnings };
}
