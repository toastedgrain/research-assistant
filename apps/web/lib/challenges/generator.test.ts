import { describe, expect, it } from "vitest";
import { createEvidenceResolver } from "../evidence/resource";
import type { Manifest } from "../manifest";
import { buildLearningObjects } from "../learning/objects";
import { getPaperLearningIndex, type PaperLearningPage } from "../learning/paper-index";
import { createFigureBuild, createOrdering, createPaperCheck, createSectionChallenges, createThreadExpedition, createQuestPlan } from "./generator";
import { scoreChallenge } from "./challenge";
import { validateChallenge } from "./validator";

const manifest = {
  doc_id: "sha256:challenge-paper",
  source: { type: "upload", arxiv_id: null }, title: "Challenge paper", page_count: 3,
  pages: [
    { index: 0, width_pt: 600, height_pt: 800 }, { index: 1, width_pt: 600, height_pt: 800 }, { index: 2, width_pt: 600, height_pt: 800 },
  ],
  sections: [
    { title: "1 Foundations", page: 0, level: 1 }, { title: "2 Method", page: 1, level: 1 }, { title: "3 Results", page: 2, level: 1 },
  ],
  assets: [
    { asset_id: "fig-1", kind: "figure", label: "Figure 1", number: "1", page: 1, bbox: [0.1, 0.2, 0.9, 0.6], caption: "Attention flow.", caption_bbox: [0.1, 0.62, 0.9, 0.67], image_url: "/blob/challenge/crops/fig-1.png", image_width: 800, parent_id: null },
    { asset_id: "table-1", kind: "table", label: "Table 1", number: "1", page: 2, bbox: [0.1, 0.2, 0.9, 0.6], caption: "Accuracy results.", caption_bbox: [0.1, 0.62, 0.9, 0.67], image_url: "/blob/challenge/crops/table-1.png", image_width: 800, parent_id: null },
  ],
  references: [], extraction: { version: "1", figure_backend: "caption-heuristic", warnings: [] },
} as Manifest;

const pages: PaperLearningPage[] = [
  { items: [{ str: "We define vectors as numerical representations.", hasEOL: true, rect: [0.1, 0.2, 0.9, 0.24] }], mentions: [], citations: [] },
  { items: [
    { str: "We define attention as a weighted combination of values.", hasEOL: true, rect: [0.1, 0.2, 0.9, 0.24] },
    { str: "Figure 1 shows the attention flow.", hasEOL: true, rect: [0.1, 0.3, 0.9, 0.34] },
  ], mentions: [], citations: [] },
  { items: [{ str: "Results show the method improves accuracy; Table 1 reports the result.", hasEOL: true, rect: [0.1, 0.2, 0.9, 0.24] }], mentions: [], citations: [] },
];

describe("source-grounded challenge generator", () => {
  const index = getPaperLearningIndex(manifest, pages);
  const objects = buildLearningObjects(index);
  const resolver = createEvidenceResolver([index]);

  it("builds only validated scored interactions and labels prediction exploration as unscored", () => {
    const challenges = createSectionChallenges(index, objects, "sec-1");
    expect(challenges.length).toBeGreaterThan(0);
    expect(challenges.filter((challenge) => challenge.mode === "scored").every((challenge) => validateChallenge(challenge, resolver).valid)).toBe(true);
    expect(challenges.find((challenge) => challenge.type === "figure-detective")?.mode).toBe("scored");
    expect(challenges.find((challenge) => challenge.type === "prediction")?.mode).toBe("explore");
  });

  it("creates a bounded paper route with a source-grounded paper check", () => {
    const quest = createQuestPlan(index, objects);
    expect(quest.checkpoints).toHaveLength(3);
    expect(quest.checkpoints.every((checkpoint) => checkpoint.challenges.length <= 2)).toBe(true);
    const check = createPaperCheck(index, objects);
    expect(check?.type).toBe("paper-check");
    expect(check && validateChallenge(check, resolver).valid).toBe(true);
    expect(check?.payload.kind === "paper-check" && check.payload.questions.map(({ category }) => category)).toEqual(["terminology", "method", "evidence", "result", "relationships"]);
    if (check?.mode === "scored" && check.answer.kind === "paper-check") {
      const wrong = Object.fromEntries(Object.keys(check.answer.answers).map((id) => [id, "wrong"]));
      expect(scoreChallenge(check, { kind: "paper-check", answers: wrong })?.correct).toBe(false);
      expect(scoreChallenge(check, { kind: "paper-check", answers: check.answer.answers })).toMatchObject({ correct: true, points: 5 });
    }
  });

  it("uses controlled diagram data for Figure Build and literal order for Thread Expedition", () => {
    const build = createFigureBuild(index, objects);
    const ordering = createOrdering(index);
    const thread = createThreadExpedition(index, objects);
    expect(build?.payload).toMatchObject({ kind: "figure-build", diagramLabel: expect.stringContaining("source map") });
    expect(build?.prompt).not.toContain("sections");
    expect(ordering && validateChallenge(ordering, resolver).valid).toBe(true);
    expect(thread?.type).toBe("thread-expedition");
    expect(thread && validateChallenge(thread, resolver).valid).toBe(true);
  });
});
