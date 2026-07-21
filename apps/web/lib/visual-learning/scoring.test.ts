import { describe, expect, it } from "vitest";
import type { VisualChallengeSpec } from "./contracts";
import { scoreVisualChallenge } from "./scoring";

function game(overrides: Partial<VisualChallengeSpec> = {}): VisualChallengeSpec {
  return {
    schemaVersion: "1", id: "game", gameType: "build-flow", title: "Build", learningObjective: "Build flow",
    prompt: "Build it", instructions: "Connect it", evidenceIds: ["evidence"],
    interactiveElements: [
      { id: "a", kind: "node", label: "A", evidenceIds: ["evidence"] },
      { id: "b", kind: "node", label: "B", evidenceIds: ["evidence"] },
    ], initialState: { connections: [] },
    correctState: { connections: [{ id: "ab", sourceId: "a", targetId: "b", evidenceIds: ["evidence"] }] },
    scoringMode: "scored", hints: [], successFeedback: "Correct", generated: true,
    ...overrides,
  } as VisualChallengeSpec;
}

describe("visual challenge scoring", () => {
  it("scores source-grounded connections and keeps incorrect states retryable", () => {
    expect(scoreVisualChallenge(game(), { connections: [] })?.correct).toBe(false);
    expect(scoreVisualChallenge(game(), { connections: [{ id: "learner", sourceId: "a", targetId: "b", evidenceIds: [] }] })).toEqual({ correct: true, message: "Correct" });
  });

  it("scores missing placement, ordering, classification, and evidence hunt by stable ids", () => {
    const missing = game({ gameType: "missing-node", correctState: { placements: { missing: "slot" } } });
    expect(scoreVisualChallenge(missing, { placements: { missing: "slot" } })?.correct).toBe(true);
    const sequence = game({ gameType: "sequence", correctState: { nodeOrder: ["a", "b"] } });
    expect(scoreVisualChallenge(sequence, { nodeOrder: ["b", "a"] })?.correct).toBe(false);
    const classification = game({ gameType: "classification", correctState: { classification: { a: "category" } } });
    expect(scoreVisualChallenge(classification, { classification: { a: "category" } })?.correct).toBe(true);
    const hunt = game({ gameType: "evidence-hunt", correctState: { expectedEvidenceIds: ["evidence"] } });
    expect(scoreVisualChallenge(hunt, { expectedEvidenceIds: ["evidence"] })?.correct).toBe(true);
  });

  it("never scores exploratory prediction", () => {
    const exploratory = { ...game(), gameType: "prediction", scoringMode: "exploratory", correctState: undefined } as VisualChallengeSpec;
    expect(scoreVisualChallenge(exploratory, { choiceId: "higher" })).toBeNull();
  });
});
