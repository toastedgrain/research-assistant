import type {
  ChallengeSpec,
  LearnerResponse,
} from "./contracts";

export { validateChallenge, type ChallengeValidation } from "./validator";

export interface ChallengeScore {
  correct: boolean;
  points: number;
  maxPoints: number;
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

/**
 * Scores only deterministic responses. Evidence Hunt is evaluated against a selected
 * source passage in evidence-hunt.ts; explore specs never emit correctness or score.
 */
export function scoreChallenge(
  challenge: ChallengeSpec,
  response: LearnerResponse,
): ChallengeScore | null {
  if (challenge.mode !== "scored") return null;

  let correct = false;
  if (challenge.answer.kind === "choice" && response.kind === "choice") {
    correct = sameValues(challenge.answer.correctChoiceIds, response.choiceIds);
  } else if (challenge.answer.kind === "pairs" && response.kind === "pairs") {
    const expected = Object.entries(challenge.answer.pairs).sort(([left], [right]) => left.localeCompare(right));
    const actual = Object.entries(response.pairs).sort(([left], [right]) => left.localeCompare(right));
    correct = expected.length === actual.length && expected.every(([key, value], index) => actual[index]?.[0] === key && actual[index]?.[1] === value);
  } else if (challenge.answer.kind === "order" && response.kind === "order") {
    correct = challenge.answer.itemIds.every((item, index) => response.itemIds[index] === item);
  }

  return {
    correct,
    points: correct ? challenge.scoring.maxPoints : 0,
    maxPoints: challenge.scoring.maxPoints,
  };
}