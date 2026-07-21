import type {
  ChallengeAnswer,
  ChallengeChoice,
  ChallengeScore,
  ChallengeSpec,
} from "./types";

export interface ChallengeValidation {
  valid: boolean;
  errors: string[];
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function choicesAreDistinct(choices: ChallengeChoice[]): boolean {
  const ids = new Set(choices.map((choice) => choice.id));
  const labels = new Set(choices.map((choice) => normalized(choice.label)));
  return ids.size === choices.length && labels.size === choices.length;
}

export function validateChallenge(
  challenge: ChallengeSpec,
  paperPageCounts: Record<string, number> = {},
): ChallengeValidation {
  const errors: string[] = [];
  if (challenge.scoring.maxPoints > 0 && challenge.source.length === 0) {
    errors.push("Scored challenges require source evidence.");
  }
  if (
    challenge.source.some((evidence) => {
      const pageCount = paperPageCounts[evidence.paperId];
      return evidence.page < 0 || (pageCount !== undefined && evidence.page >= pageCount);
    })
  ) {
    errors.push("Source evidence points to an invalid page.");
  }
  if (challenge.type !== challenge.payload.kind) {
    errors.push("Challenge type does not match its payload.");
  }

  if (challenge.payload.kind === "multiple-choice") {
    const payload = challenge.payload;
    if (!choicesAreDistinct(payload.choices)) {
      errors.push("Choice labels must be distinct.");
    }
    if (
      challenge.answer.kind !== "choice" ||
      challenge.answer.choiceIds.length === 0 ||
      challenge.answer.choiceIds.some(
        (id) => !payload.choices.some((choice) => choice.id === id),
      )
    ) {
      errors.push("Expected answer must reference an available choice.");
    }
  }

  if (challenge.payload.kind === "concept-match") {
    const payload = challenge.payload;
    if (
      !choicesAreDistinct(payload.concepts) ||
      !choicesAreDistinct(payload.definitions)
    ) {
      errors.push("Match items must be distinct.");
    }
    const conceptIds = new Set(payload.concepts.map((item) => item.id));
    const definitionIds = new Set(payload.definitions.map((item) => item.id));
    if (
      challenge.answer.kind !== "pairs" ||
      conceptIds.size !== Object.keys(challenge.answer.pairs).length ||
      Object.entries(challenge.answer.pairs).some(
        ([conceptId, definitionId]) =>
          !conceptIds.has(conceptId) || !definitionIds.has(definitionId),
      )
    ) {
      errors.push("Expected pairs must cover every concept and definition.");
    }
  }

  if (challenge.payload.kind === "ordering") {
    const payload = challenge.payload;
    if (!choicesAreDistinct(payload.items)) errors.push("Order items must be distinct.");
    const itemIds = new Set(payload.items.map((item) => item.id));
    if (
      challenge.answer.kind !== "order" ||
      challenge.answer.itemIds.length !== itemIds.size ||
      challenge.answer.itemIds.some((id) => !itemIds.has(id))
    ) {
      errors.push("Expected order must contain every item exactly once.");
    }
  }

  return { valid: errors.length === 0, errors };
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function scoreChallenge(
  challenge: ChallengeSpec,
  response: ChallengeAnswer,
): ChallengeScore {
  let correct = false;
  if (challenge.answer.kind === "choice" && response.kind === "choice") {
    correct = arraysEqual([...challenge.answer.choiceIds].sort(), [...response.choiceIds].sort());
  } else if (challenge.answer.kind === "order" && response.kind === "order") {
    correct = arraysEqual(challenge.answer.itemIds, response.itemIds);
  } else if (challenge.answer.kind === "pairs" && response.kind === "pairs") {
    const expected = Object.entries(challenge.answer.pairs).sort();
    const actual = Object.entries(response.pairs).sort();
    correct =
      expected.length === actual.length &&
      expected.every(([key, value], index) => actual[index]?.[0] === key && actual[index]?.[1] === value);
  }
  return {
    correct,
    points: correct ? challenge.scoring.maxPoints : 0,
    maxPoints: challenge.scoring.maxPoints,
  };
}
