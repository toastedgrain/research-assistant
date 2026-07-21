import { describe, expect, it } from "vitest";
import { passageEvidence } from "../evidence/source";
import { createEvidenceResolver } from "../evidence/resource";
import type { Manifest } from "../manifest";
import type { PaperLearningPage } from "../learning/paper-index";
import { getPaperLearningIndex } from "../learning/paper-index";
import { challengeEvidence, type ChallengeSpec } from "./contracts";
import { validateChallenge } from "./validator";

const manifest = {
  doc_id: "sha256:challenge-paper",
  source: { type: "upload", arxiv_id: null },
  title: "Challenge paper",
  page_count: 1,
  pages: [{ index: 0, width_pt: 600, height_pt: 800 }],
  assets: [],
  references: [],
  sections: [{ title: "Method", page: 0, level: 1 }],
  extraction: { version: "1", figure_backend: "caption-heuristic", warnings: [] },
} as Manifest;

const pages: PaperLearningPage[] = [{
  items: [{ str: "Attention mixes values.", hasEOL: true, rect: [0.1, 0.2, 0.8, 0.24] }],
  mentions: [],
  citations: [],
}];

function passageTarget() {
  const index = getPaperLearningIndex(manifest, pages);
  const passage = index.passages[0];
  return {
    index,
    target: challengeEvidence(
      passageEvidence(index.paperId, passage.page, passage.text, {
        bbox: passage.bbox,
        sectionId: passage.sectionId,
      }),
      "The paper states this relationship in the selected passage.",
      { kind: "passage", resourceId: passage.id },
    ),
  };
}

function scoredChoice(): ChallengeSpec {
  const { index, target } = passageTarget();
  return {
    id: "choice-1",
    type: "multiple-choice",
    mode: "scored",
    paperIds: [index.paperId],
    concepts: ["attention"],
    evidence: [target],
    prompt: "What does attention mix?",
    difficulty: "easy",
    payload: {
      kind: "multiple-choice",
      choices: [
        { id: "values", label: "Values" },
        { id: "pages", label: "Pages" },
      ],
    },
    answer: {
      kind: "choice",
      correctChoiceIds: ["values"],
      relationships: [
        {
          id: "choice:values",
          evidenceIds: [target.id],
          requiredEvidenceKinds: ["passage"],
          reason: "The target passage names values.",
        },
      ],
    },
    hints: [],
    scoring: { maxPoints: 1, partialCredit: false },
  };
}

describe("discriminated challenge validation", () => {
  it("accepts a scored relationship only when its canonical source and resource resolve", () => {
    const { index } = passageTarget();
    expect(validateChallenge(scoredChoice(), createEvidenceResolver([index]))).toMatchObject({ valid: true });
  });

  it("rejects stale challenge evidence ids and missing answer-level evidence", () => {
    const { index } = passageTarget();
    const challenge = scoredChoice();
    if (challenge.mode !== "scored") throw new Error("Expected a scored fixture.");
    challenge.evidence[0].id = "stale-evidence";
    challenge.answer.relationships[0].evidenceIds = [];
    const errors = validateChallenge(challenge, createEvidenceResolver([index])).errors.join(" ");
    expect(errors).toContain("canonical evidence key");
    expect(errors).toContain("no supporting evidence");
  });

  it("rejects incompatible relationship evidence kinds", () => {
    const { index } = passageTarget();
    const challenge = scoredChoice();
    if (challenge.mode !== "scored") throw new Error("Expected a scored fixture.");
    challenge.answer.relationships[0].requiredEvidenceKinds = ["figure"];
    expect(validateChallenge(challenge, createEvidenceResolver([index])).errors.join(" ")).toContain(
      "incompatible evidence kinds",
    );
  });

  it("requires exactly one stable correct id for a single-answer multiple choice", () => {
    const { index } = passageTarget();
    const challenge = scoredChoice();
    if (challenge.mode !== "scored" || challenge.answer.kind !== "choice") throw new Error("Expected a scored choice fixture.");
    challenge.answer.correctChoiceIds = ["values", "pages"];
    expect(validateChallenge(challenge, createEvidenceResolver([index])).errors).toContain(
      "Single-answer multiple choice requires exactly one correct choice id.",
    );
  });

  it("allows Explore to remain unscored without an expected answer", () => {
    const { index, target } = passageTarget();
    const explore: ChallengeSpec = {
      id: "explore-1",
      type: "multiple-choice",
      mode: "explore",
      paperIds: [index.paperId],
      concepts: [],
      evidence: [target],
      prompt: "Compare the wording with the paper.",
      difficulty: "easy",
      payload: { kind: "multiple-choice", choices: [{ id: "read", label: "Read source" }] },
      hints: [],
    };
    expect(validateChallenge(explore, createEvidenceResolver([index]))).toMatchObject({ valid: true });
  });

  it("fails scored challenges closed when a resource cannot resolve", () => {
    const { index } = passageTarget();
    const challenge = scoredChoice();
    if (challenge.mode === "scored") challenge.evidence[0].resource = { kind: "passage", resourceId: "missing" };
    expect(validateChallenge(challenge, createEvidenceResolver([index])).valid).toBe(false);
  });
});
