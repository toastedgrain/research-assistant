import type {
  ChallengeLifecycle,
  ChallengeSpec,
  LearnerResponse,
} from "./contracts";

export { validateChallenge, type ChallengeValidation } from "./validator";

export interface ChallengeScore {
  correct: boolean;
  points: number;
  maxPoints: number;
  categoryResults?: Record<string, boolean>;
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function scoresChoiceResponse(
  challenge: Extract<ChallengeSpec, { mode: "scored" }>,
  response: Extract<LearnerResponse, { kind: "choice" }>,
): boolean {
  if (challenge.answer.kind !== "choice") return false;

  // Single-answer controls intentionally use one exact stable id. This prevents a
  // generated label, array position, or stale display value from becoming an answer.
  if (challenge.payload.kind === "multiple-choice" && !challenge.payload.multiple) {
    return challenge.answer.correctChoiceIds.length === 1 &&
      response.choiceIds.length === 1 &&
      challenge.answer.correctChoiceIds[0] === response.choiceIds[0];
  }

  return sameValues(challenge.answer.correctChoiceIds, response.choiceIds);
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
    correct = scoresChoiceResponse(challenge, response);
  } else if (challenge.answer.kind === "pairs" && response.kind === "pairs") {
    const expected = Object.entries(challenge.answer.pairs).sort(([left], [right]) => left.localeCompare(right));
    const actual = Object.entries(response.pairs).sort(([left], [right]) => left.localeCompare(right));
    correct = expected.length === actual.length && expected.every(([key, value], index) => actual[index]?.[0] === key && actual[index]?.[1] === value);
  } else if (challenge.answer.kind === "order" && response.kind === "order") {
    correct = challenge.answer.itemIds.every((item, index) => response.itemIds[index] === item);
  } else if (challenge.answer.kind === "paper-check" && response.kind === "paper-check" && challenge.payload.kind === "paper-check") {
    const categoryResults: Record<string, boolean> = {};
    for (const question of challenge.payload.questions) {
      categoryResults[question.category] = response.answers[question.id] === challenge.answer.answers[question.id];
    }
    correct = Object.values(categoryResults).every(Boolean);
    const points = Object.values(categoryResults).filter(Boolean).length;
    return { correct, points, maxPoints: challenge.payload.questions.length, categoryResults };
  }

  return {
    correct,
    points: correct ? challenge.scoring.maxPoints : 0,
    maxPoints: challenge.scoring.maxPoints,
  };
}

/** A wrong generic answer stays revisable; only a correct answer completes the activity. */
export function lifecycleAfterScore(score: Pick<ChallengeScore, "correct">): ChallengeLifecycle {
  return score.correct ? "complete" : "submitted";
}
