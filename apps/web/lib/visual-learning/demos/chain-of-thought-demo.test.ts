import { describe, expect, it } from "vitest";
import { createEvidenceResolver } from "../../evidence/resource";
import type { Manifest } from "../../manifest";
import { getPaperLearningIndex, type PaperLearningPage } from "../../learning/paper-index";
import {
  CHAIN_OF_THOUGHT_DEMO_INITIAL_ORDER,
  CHAIN_OF_THOUGHT_DEMO_STEPS,
  CHAIN_OF_THOUGHT_RESULT_BARS,
  correctChainPrefixLength,
  createChainOfThoughtDemoEvidence,
  evaluateChainOfThoughtOrder,
  isChainOfThoughtDemoPaper,
  moveChainStep,
} from "./chain-of-thought-demo";

const manifest = {
  doc_id: "sha256:chain-paper",
  source: { type: "arxiv", arxiv_id: "2201.11903v6" },
  title: "Chain-of-Thought Prompting Elicits Reasoning",
  page_count: 2,
  pages: [
    { index: 0, width_pt: 612, height_pt: 792 },
    { index: 1, width_pt: 612, height_pt: 792 },
  ],
  assets: [{
    asset_id: "fig-1", kind: "figure", label: "Figure 1", number: "1", page: 0,
    bbox: [0.18, 0.57, 0.81, 0.81], caption: "Figure 1: Chain-of-thought prompting comparison.",
    caption_bbox: [0.18, 0.82, 0.82, 0.85], image_url: "/blob/chain/crops/fig-1.png", image_width: 1200, parent_id: null,
  }],
  references: [],
  sections: [{ title: "1 Introduction", page: 1, level: 1 }],
  extraction: { version: "1", figure_backend: "caption-heuristic", warnings: ["Figure 2 crop dropped"] },
} as Manifest;

const pages: PaperLearningPage[] = [
  {
    items: [{ str: "A chain of thought is a series of intermediate natural-language reasoning steps.", hasEOL: true, rect: [0.1, 0.2, 0.8, 0.25] }],
    mentions: [], citations: [],
  },
  {
    items: [{ str: "Figure 2 reports the GSM8K comparison for chain-of-thought prompting.", hasEOL: true, rect: [0.55, 0.34, 0.82, 0.42] }],
    mentions: [], citations: [],
  },
];

describe("Chain-of-Thought demo fixture", () => {
  it("detects the canonical arXiv identity, including versioned ids, without title matching", () => {
    expect(isChainOfThoughtDemoPaper(manifest)).toBe(true);
    expect(isChainOfThoughtDemoPaper({ source: { type: "arxiv", arxiv_id: "2201.11903" } })).toBe(true);
    expect(isChainOfThoughtDemoPaper({ source: { type: "arxiv", arxiv_id: "1706.03762" } })).toBe(false);
    expect(isChainOfThoughtDemoPaper({ source: { type: "upload", arxiv_id: null } })).toBe(false);
  });

  it("resolves Figure 1 as an asset and the dropped Figure 2 crop as a literal caption passage", () => {
    const index = getPaperLearningIndex(manifest, pages);
    const evidence = createChainOfThoughtDemoEvidence(index);
    expect(evidence.mechanism?.source).toMatchObject({ paperId: "chain-paper", kind: "figure", assetId: "fig-1", page: 0 });
    expect(evidence.result?.source).toMatchObject({ paperId: "chain-paper", kind: "passage", page: 1 });
    const resolver = createEvidenceResolver([index]);
    expect(resolver.resolve(evidence.mechanism!).status).toBe("resolved");
    expect(resolver.resolve(evidence.result!).status).toBe("resolved");
  });

  it("has one deterministic, retryable target order and stable reported result values", () => {
    const expected = CHAIN_OF_THOUGHT_DEMO_STEPS.map((step) => step.id);
    expect(evaluateChainOfThoughtOrder(CHAIN_OF_THOUGHT_DEMO_INITIAL_ORDER)).toBe(false);
    expect(correctChainPrefixLength([expected[0], expected[1], "final-answer"])).toBe(2);

    let repaired: string[] = [...CHAIN_OF_THOUGHT_DEMO_INITIAL_ORDER];
    expected.forEach((id, index) => { repaired = moveChainStep(repaired, id, index); });
    expect(repaired).toEqual(expected);
    expect(evaluateChainOfThoughtOrder(repaired)).toBe(true);
    expect(CHAIN_OF_THOUGHT_RESULT_BARS.map((bar) => bar.value)).toEqual([33, 55, 18, 57]);
  });
});
