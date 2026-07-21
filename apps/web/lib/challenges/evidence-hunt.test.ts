import { describe, expect, it } from "vitest";
import { createEvidenceResolver } from "../evidence/resource";
import type { Manifest } from "../manifest";
import { getPaperLearningIndex, type PaperLearningPage } from "../learning/paper-index";
import type { SelectionContext } from "../research-context/types";
import { buildResearchContext } from "../research-context/context";
import { createChallengeReturnRecord, restoresChallenge } from "./session";
import { createEvidenceHunt, evaluateEvidenceHunt } from "./evidence-hunt";

const manifest = {
  doc_id: "sha256:hunt-paper",
  source: { type: "upload", arxiv_id: null },
  title: "Evidence Hunt paper",
  page_count: 2,
  pages: [
    { index: 0, width_pt: 600, height_pt: 800 },
    { index: 1, width_pt: 600, height_pt: 800 },
  ],
  assets: [],
  references: [],
  sections: [
    { title: "Method", page: 0, level: 1 },
    { title: "Results", page: 1, level: 1 },
  ],
  extraction: { version: "1", figure_backend: "caption-heuristic", warnings: [] },
} as Manifest;

const pages: PaperLearningPage[] = [
  {
    items: [
      { str: "Multiple heads let the model attend to different positions.", hasEOL: true, rect: [0.1, 0.2, 0.8, 0.24] },
      { str: "The implementation uses residual connections.", hasEOL: true, rect: [0.1, 0.3, 0.8, 0.34] },
    ],
    mentions: [],
    citations: [],
  },
  {
    items: [{ str: "The result improves the benchmark.", hasEOL: true, rect: [0.1, 0.2, 0.8, 0.24] }],
    mentions: [],
    citations: [],
  },
];

function selection(page: number, itemIndex: number): SelectionContext {
  const index = getPaperLearningIndex(manifest, pages);
  const passage = index.passagesByPage.get(page)?.find((item) => item.itemRanges.some((range) => range.itemIndex === itemIndex));
  if (!passage) throw new Error("Missing fixture passage");
  return {
    text: passage.text,
    page,
    itemRanges: [passage.itemRanges[0]],
    bbox: passage.bbox,
  };
}

function fixture() {
  const index = getPaperLearningIndex(manifest, pages);
  const targetSelection = selection(0, 0);
  const context = buildResearchContext({ manifest, selection: targetSelection, pages, index });
  const challenge = createEvidenceHunt(context, index);
  if (!challenge) throw new Error("Expected an Evidence Hunt fixture");
  return { index, challenge };
}

describe("Evidence Hunt", () => {
  it("accepts its verified passage and distinguishes close and unsupported selections", () => {
    const { index, challenge } = fixture();
    const resolver = createEvidenceResolver([index]);

    expect(evaluateEvidenceHunt(challenge, selection(0, 0), index, resolver).state).toBe("supported");
    expect(evaluateEvidenceHunt(challenge, selection(0, 1), index, resolver).state).toBe("close");
    expect(evaluateEvidenceHunt(challenge, selection(1, 0), index, resolver).state).toBe("needs-revision");
  });

  it("refuses to score when the accepted evidence cannot resolve", () => {
    const { index, challenge } = fixture();
    challenge.evidence[0].resource = { kind: "passage", resourceId: "missing" };
    expect(evaluateEvidenceHunt(challenge, selection(0, 0), index, createEvidenceResolver([index])).state).toBe("unresolved");
  });

  it("preserves a learner selection and lifecycle in the evidence return record", () => {
    const { challenge } = fixture();
    const record = createChallengeReturnRecord({
      challengeId: challenge.id,
      lifecycle: "submitted",
      response: { kind: "evidence-hunt", selectedPassageId: "passage-0-0" },
      position: 2,
      focusTargetId: `challenge-${challenge.id}`,
    });
    expect(restoresChallenge(challenge, record)).toBe(true);
    expect(record.response).toEqual({ kind: "evidence-hunt", selectedPassageId: "passage-0-0" });
    expect(record.lifecycle).toBe("submitted");
  });
});
