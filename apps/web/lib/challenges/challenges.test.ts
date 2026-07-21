import { describe, expect, it } from "vitest";
import { evidenceTarget } from "../evidence/navigation";
import { passageEvidence } from "../evidence/source";
import { scoreChallenge } from "./challenge";
import { challengeEvidence, type ChallengeSpec } from "./contracts";

const target = challengeEvidence(
  passageEvidence("paper-1", 2, "Attention mixes values."),
  "The passage names the values mixed by attention.",
  { kind: "passage", resourceId: "passage-2" },
);

function multipleChoice(): Extract<ChallengeSpec, { type: "multiple-choice"; mode: "scored" }> {
  return {
    id: "challenge-1",
    type: "multiple-choice",
    mode: "scored",
    paperIds: ["paper-1"],
    concepts: ["attention"],
    evidence: [target],
    prompt: "What does attention mix?",
    difficulty: "easy",
    payload: {
      kind: "multiple-choice",
      choices: [
        { id: "tokens", label: "Values" },
        { id: "pages", label: "Pages" },
      ],
    },
    answer: {
      kind: "choice",
      correctChoiceIds: ["tokens"],
      relationships: [{ id: "choice:tokens", evidenceIds: [target.id], reason: target.reason }],
    },
    hints: [],
    scoring: { maxPoints: 1, partialCredit: false },
  };
}

describe("challenge scoring", () => {
  it("scores deterministic scored responses without giving Explore a score", () => {
    const challenge = multipleChoice();
    expect(scoreChallenge(challenge, { kind: "choice", choiceIds: ["tokens"] })?.correct).toBe(true);
    expect(scoreChallenge(challenge, { kind: "choice", choiceIds: ["pages"] })?.correct).toBe(false);

    const { answer: _answer, scoring: _scoring, ...base } = challenge;
    const explore: ChallengeSpec = { ...base, id: "explore-1", mode: "explore", hints: [] };
    expect(scoreChallenge(explore, { kind: "choice", choiceIds: ["tokens"] })).toBeNull();
  });

  it("returns the expected zero-based evidence page and bbox", () => {
    expect(
      evidenceTarget(
        {
          paperId: "paper-1",
          page: 3,
          kind: "figure",
          assetId: "fig-2",
          bbox: [0.1, 0.2, 0.8, 0.7],
        },
        { "paper-1": 6 },
      ),
    ).toEqual({ paperId: "paper-1", page: 3, assetId: "fig-2", bbox: [0.1, 0.2, 0.8, 0.7] });
  });
});