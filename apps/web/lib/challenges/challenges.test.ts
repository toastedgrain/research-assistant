import { describe, expect, it } from "vitest";
import { evidenceTarget } from "../evidence/navigation";
import { scoreChallenge, validateChallenge } from "./challenge";
import type { ChallengeSpec } from "./types";

function multipleChoice(): ChallengeSpec {
  return {
    id: "challenge-1",
    type: "multiple-choice",
    paperIds: ["paper-1"],
    concepts: ["attention"],
    source: [
      { paperId: "paper-1", page: 2, kind: "passage", text: "Attention mixes values." },
    ],
    prompt: "What does attention mix?",
    difficulty: "easy",
    payload: {
      kind: "multiple-choice",
      choices: [
        { id: "tokens", label: "Values" },
        { id: "pages", label: "Pages" },
      ],
    },
    answer: { kind: "choice", choiceIds: ["tokens"] },
    hints: [],
    scoring: { maxPoints: 1, partialCredit: false },
  };
}

describe("challenge validation", () => {
  it("rejects a scored challenge with no source evidence", () => {
    const challenge = multipleChoice();
    challenge.source = [];
    expect(validateChallenge(challenge, { "paper-1": 5 }).valid).toBe(false);
  });

  it("rejects duplicate choices", () => {
    const challenge = multipleChoice();
    if (challenge.payload.kind === "multiple-choice") {
      challenge.payload.choices[1].label = " values ";
    }
    expect(validateChallenge(challenge, { "paper-1": 5 }).errors).toContain(
      "Choice labels must be distinct.",
    );
  });

  it("rejects evidence on a page outside the paper", () => {
    const result = validateChallenge(multipleChoice(), { "paper-1": 2 });
    expect(result.errors).toContain("Source evidence points to an invalid page.");
  });
});

describe("challenge scoring and evidence navigation", () => {
  it("scores correct and incorrect answers deterministically", () => {
    const challenge = multipleChoice();
    expect(scoreChallenge(challenge, { kind: "choice", choiceIds: ["tokens"] }).correct).toBe(
      true,
    );
    expect(scoreChallenge(challenge, { kind: "choice", choiceIds: ["pages"] }).correct).toBe(
      false,
    );
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
