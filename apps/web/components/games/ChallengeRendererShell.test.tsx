import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ChallengeSpec } from "../../lib/challenges/types";
import ChallengeRendererShell from "./ChallengeRendererShell";

function validChallenge(): ChallengeSpec {
  return {
    id: "challenge-1",
    type: "multiple-choice",
    paperIds: ["paper-1"],
    concepts: ["attention"],
    source: [
      { paperId: "paper-1", page: 1, kind: "passage", text: "Attention mixes values." },
    ],
    prompt: "What does attention mix?",
    difficulty: "easy",
    payload: {
      kind: "multiple-choice",
      choices: [
        { id: "values", label: "Values" },
        { id: "pages", label: "Pages" },
      ],
    },
    answer: { kind: "choice", choiceIds: ["values"] },
    hints: [],
    scoring: { maxPoints: 1, partialCredit: false },
  };
}

describe("ChallengeRendererShell", () => {
  it("renders a valid challenge and its evidence path", () => {
    const markup = renderToStaticMarkup(
      <ChallengeRendererShell
        challenge={validChallenge()}
        paperPageCounts={{ "paper-1": 3 }}
        onNavigateEvidence={() => undefined}
      />,
    );

    expect(markup).toContain("What does attention mix?");
    expect(markup).toContain("Values");
    expect(markup).toContain("Evidence p.2");
  });

  it("renders nothing when validation rejects the challenge", () => {
    const challenge = validChallenge();
    challenge.source = [];
    expect(
      renderToStaticMarkup(
        <ChallengeRendererShell
          challenge={challenge}
          paperPageCounts={{ "paper-1": 3 }}
          onNavigateEvidence={() => undefined}
        />,
      ),
    ).toBe("");
  });
});
