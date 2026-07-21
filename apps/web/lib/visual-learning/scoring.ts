import type { VisualChallengeSpec } from "./contracts";

export type VisualLearnerState = VisualChallengeSpec["initialState"];

export interface VisualChallengeScore {
  correct: boolean;
  message: string;
}

function sameList(left: readonly string[] = [], right: readonly string[] = []): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function sameSet(left: readonly string[] = [], right: readonly string[] = []): boolean {
  return left.length === right.length && [...left].sort().every((item, index) => item === [...right].sort()[index]);
}

function sameRecord(left: Record<string, string> = {}, right: Record<string, string> = {}): boolean {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}

function connectionKeys(state: VisualLearnerState): string[] {
  return (state.connections ?? []).map((edge) => `${edge.sourceId}->${edge.targetId}`);
}

export function scoreVisualChallenge(spec: VisualChallengeSpec, state: VisualLearnerState): VisualChallengeScore | null {
  if (spec.scoringMode === "exploratory") return null;
  const expected = spec.correctState;
  if (!expected) return { correct: false, message: "This interaction has no validated correct state and cannot be scored." };

  const checks: boolean[] = [];
  if (expected.nodeOrder?.length) checks.push(sameList(state.nodeOrder, expected.nodeOrder));
  if (expected.connections?.length) checks.push(sameSet(connectionKeys(state), connectionKeys(expected)));
  if (Object.keys(expected.placements ?? {}).length) checks.push(sameRecord(state.placements, expected.placements));
  if (expected.selectedElementIds?.length) checks.push(sameSet(state.selectedElementIds, expected.selectedElementIds));
  if (Object.keys(expected.classification ?? {}).length) checks.push(sameRecord(state.classification, expected.classification));
  if (expected.choiceId) checks.push(state.choiceId === expected.choiceId);
  if (expected.expectedEvidenceIds?.length) checks.push(sameSet(state.expectedEvidenceIds, expected.expectedEvidenceIds));
  const correct = checks.length > 0 && checks.every(Boolean);
  return {
    correct,
    message: correct
      ? spec.successFeedback
      : "Not quite. Keep the parts you trust, revise the visual state, or use a source-grounded hint.",
  };
}
