import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { challengeEvidence } from "../../../lib/challenges/contracts";
import { passageEvidence } from "../../../lib/evidence/source";
import ChainOfThoughtDemoExperience from "./ChainOfThoughtDemoExperience";

const source = challengeEvidence(
  passageEvidence("chain-paper", 0, "Verified Figure 1 context.", { bbox: [0.1, 0.2, 0.8, 0.4] }),
  "Verified paper evidence.",
);

describe("ChainOfThoughtDemoExperience", () => {
  it("renders the visual comparison and the bounded Figure 2 result view", () => {
    const markup = renderToStaticMarkup(
      <ChainOfThoughtDemoExperience initialTab="explore" evidence={{ mechanism: source, result: source }} onNavigateEvidence={() => undefined} onComplete={() => undefined} />,
    );
    expect(markup).toContain("How chain-of-thought prompting changes the reasoning process");
    expect(markup).toContain("Standard prompting");
    expect(markup).toContain("Chain-of-thought prompting");
    expect(markup).toContain("Reported GSM8K solve rate in Figure 2");
    expect(markup).toContain("PaLM 540B + chain-of-thought prompting: 57");
    expect(markup).toContain("Show Figure 1 evidence");
    expect(markup).toContain("Show Figure 2 source");
  });

  it("renders the instant visual build game instead of a multiple-choice fallback", () => {
    const markup = renderToStaticMarkup(
      <ChainOfThoughtDemoExperience initialTab="build" evidence={{ mechanism: source, result: source }} onNavigateEvidence={() => undefined} onComplete={() => undefined} />,
    );
    expect(markup).toContain("Build the reasoning path");
    expect(markup).toContain("Reasoning pieces");
    expect(markup).toContain("Add to path");
    expect(markup).toContain("Check reasoning path");
    expect(markup).not.toContain("Choose one answer");
  });
});
