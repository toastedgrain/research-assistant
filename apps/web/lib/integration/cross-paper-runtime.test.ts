import { describe, expect, it } from "vitest";
import { challengeEvidence } from "../challenges/contracts";
import { assetEvidence, paperRefOf } from "../evidence/source";
import type { PaperAnalysis } from "../explore/analysis";
import { emptyCitationGraph } from "../explore/citation-graph";
import type { Manifest } from "../manifest";
import { createCollection, addPaperToCollection } from "../workspace/collections";
import { createCrossPaperRuntime } from "./cross-paper-runtime";

function analysis(id: string): PaperAnalysis {
  const manifest = {
    doc_id: `sha256:${id}`, source: { type: "arxiv", arxiv_id: id === "a" ? "1901.00001" : "2001.00001" },
    title: `Paper ${id.toUpperCase()}`, page_count: 1,
    pages: [{ index: 0, width_pt: 600, height_pt: 800 }], sections: [{ title: "1 Method", page: 0, level: 1 }], references: [],
    assets: [{ asset_id: `fig-${id}`, kind: "figure", label: "Figure 1", number: "1", page: 0, bbox: [0.1, 0.2, 0.9, 0.6], caption: "Shared attention model", caption_bbox: [0.1, 0.61, 0.9, 0.67], image_url: `/blob/${id}.png`, image_width: 800, parent_id: null }],
    extraction: { version: "1", figure_backend: "caption-heuristic", warnings: [] },
  } as unknown as Manifest;
  return {
    manifest, reverseIndex: new Map(), mentionsByPage: [[]], citationsByPage: [[]],
    pageItems: [[{ str: "We define attention as a weighted representation.", hasEOL: true, rect: [0.1, 0.2, 0.9, 0.24] }]],
  };
}

describe("production cross-paper runtime", () => {
  it("composes both providers and resolves source evidence from both papers", () => {
    const left = analysis("a");
    const right = analysis("b");
    let collection = createCollection("Comparison", { id: "comparison" });
    collection = addPaperToCollection(addPaperToCollection(collection, paperRefOf(left.manifest)), paperRefOf(right.manifest));
    const runtime = createCrossPaperRuntime([left, right], collection, emptyCitationGraph());

    expect(runtime.crossPaper.getCollectionPapers(collection.id).map(({ paperId }) => paperId)).toEqual(["a", "b"]);
    expect(runtime.crossPaper.getPaper("sha256:a")?.paperId).toBe("a");
    expect(runtime.crossPaper.findEvidence({ paperIds: ["sha256:b"], kinds: ["figure"] })[0]?.paperId).toBe("b");
    expect(runtime.learning.getConcepts("a").map(({ label }) => label)).toContain("attention");
    for (const item of [left, right]) {
      const asset = item.manifest.assets[0];
      expect(runtime.evidence.resolve(challengeEvidence(assetEvidence(item.manifest.doc_id, asset), "source")).status).toBe("resolved");
    }
  });
});
