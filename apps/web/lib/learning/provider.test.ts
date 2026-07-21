import { describe, expect, it } from "vitest";
import type { Manifest } from "../manifest";
import { getPaperLearningIndex, type PaperLearningPage } from "./paper-index";
import { IndexedLearningContextProvider } from "./provider";

const manifest = {
  doc_id: "sha256:provider-paper", source: { type: "upload", arxiv_id: null }, title: "Provider paper", page_count: 1,
  pages: [{ index: 0, width_pt: 600, height_pt: 800 }], sections: [{ title: "Method", page: 0, level: 1 }], assets: [], references: [],
  extraction: { version: "1", figure_backend: "caption-heuristic", warnings: [] },
} as Manifest;
const pages: PaperLearningPage[] = [{
  items: [{ str: "We define attention as a weighted combination. Attention appears again.", hasEOL: true, rect: [0.1, 0.2, 0.9, 0.24] }], mentions: [], citations: [],
}];

describe("LearningContextProvider", () => {
  it("exposes deterministic concepts, threads, and difficulty without importing game UI", () => {
    const index = getPaperLearningIndex(manifest, pages);
    const provider = new IndexedLearningContextProvider([index]);
    const concept = provider.getConcepts(index.paperId)[0];
    expect(concept?.label).toBe("attention");
    expect(provider.getConceptThread(index.paperId, concept.conceptId)?.occurrences.length).toBeGreaterThan(1);
    expect(provider.getDifficultyRegions(index.paperId)).toHaveLength(1);
  });
});
