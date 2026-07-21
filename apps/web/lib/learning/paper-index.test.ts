import { describe, expect, it } from "vitest";
import type { Manifest } from "../manifest";
import type { PaperLearningPage } from "./paper-index";
import {
  boundedSourceWindow,
  getPaperLearningIndex,
  passagesForNormalizedTerm,
} from "./paper-index";

const manifest = {
  doc_id: "sha256:paper-1",
  source: { type: "upload", arxiv_id: null },
  title: "Indexed paper",
  page_count: 2,
  pages: [
    { index: 0, width_pt: 600, height_pt: 800 },
    { index: 1, width_pt: 600, height_pt: 800 },
  ],
  assets: [],
  references: [],
  sections: [
    { title: "Introduction", page: 0, level: 1 },
    { title: "Method", page: 1, level: 1 },
  ],
  extraction: { version: "1", figure_backend: "caption-heuristic", warnings: [] },
} as Manifest;

const pages: PaperLearningPage[] = [
  {
    items: [
      { str: "Attention mixes values.", hasEOL: true, rect: [0.1, 0.2, 0.8, 0.24] },
      { str: "It has multiple heads.", hasEOL: true, rect: [0.1, 0.31, 0.8, 0.35] },
    ],
    mentions: [],
    citations: [],
  },
  {
    items: [{ str: "The method defines an encoder.", hasEOL: true, rect: [0.1, 0.2, 0.8, 0.24] }],
    mentions: [],
    citations: [],
  },
];

describe("PaperLearningIndex", () => {
  it("caches deterministic page/passages for the same loaded paper", () => {
    const first = getPaperLearningIndex(manifest, pages);
    const second = getPaperLearningIndex(manifest, pages);
    expect(second).toBe(first);
    expect(first.pageText).toHaveLength(2);
    expect(first.passagesByPage.get(0)).toHaveLength(2);
    expect(first.assetsByPage.get(0)).toEqual([]);
  });

  it("derives a bounded local window without rebuilding the whole paper", () => {
    const index = getPaperLearningIndex(manifest, pages);
    const selected = index.passagesByPage.get(0)?.[1];
    const window = boundedSourceWindow(
      index,
      {
        text: "multiple heads",
        page: 0,
        itemRanges: [{ itemIndex: 1, startOffset: 7, endOffset: 21 }],
        bbox: selected?.bbox,
      },
      1,
    );
    expect(window.selected?.id).toBe(selected?.id);
    expect(window.before).toHaveLength(1);
    expect(window.after).toHaveLength(1);
  });

  it("keeps a normalized deterministic lookup for derived terms", () => {
    const index = getPaperLearningIndex(manifest, pages);
    expect(passagesForNormalizedTerm(index, "  ATTENTION mixes values. ")).toHaveLength(1);
  });
});
