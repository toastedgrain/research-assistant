import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEvidenceResolver } from "../../lib/evidence/resource";
import type { Manifest } from "../../lib/manifest";
import { getPaperLearningIndex, type PaperLearningPage } from "../../lib/learning/paper-index";
import type { ResearchContext } from "../../lib/research-context/types";
import VisualLearningExperience from "./VisualLearningExperience";

function fixture(arxivId: string) {
  const manifest = {
    doc_id: `sha256:${arxivId}`,
    source: { type: "arxiv", arxiv_id: arxivId },
    title: "Paper",
    page_count: 2,
    pages: [{ index: 0, width_pt: 612, height_pt: 792 }, { index: 1, width_pt: 612, height_pt: 792 }],
    assets: [{ asset_id: "fig-1", kind: "figure", label: "Figure 1", number: "1", page: 0, bbox: [0.1, 0.2, 0.8, 0.6], caption: "Figure 1 source.", caption_bbox: [0.1, 0.61, 0.8, 0.65], image_url: "/blob/paper/fig-1.png", image_width: 1000, parent_id: null }],
    references: [], sections: [{ title: "Introduction", page: 0, level: 1 }],
    extraction: { version: "1", figure_backend: "caption-heuristic", warnings: [] },
  } as Manifest;
  const pages: PaperLearningPage[] = [
    { items: [{ str: "A chain of thought uses intermediate reasoning steps.", hasEOL: true, rect: [0.1, 0.1, 0.8, 0.15] }], mentions: [], citations: [] },
    { items: [{ str: "Figure 2 reports a GSM8K chain-of-thought prompting comparison.", hasEOL: true, rect: [0.5, 0.2, 0.8, 0.3] }], mentions: [], citations: [] },
  ];
  const index = getPaperLearningIndex(manifest, pages);
  const selected = index.passages[0];
  const context: ResearchContext = {
    paper: { paperId: index.paperId, title: manifest.title, arxivId, sourceType: "arxiv" },
    selection: { text: selected.text, page: selected.page, itemRanges: selected.itemRanges, bbox: selected.bbox },
    section: { sectionId: "sec-0", title: "Introduction", page: 0, level: 1 },
    surroundingPassages: [], concepts: [], nearbyAssets: [], citations: [], mentions: [],
    sourceWindow: { before: [], selected, after: [] },
  };
  return { index, context, resolver: createEvidenceResolver([index]) };
}

function markupFor(arxivId: string) {
  const { index, context, resolver } = fixture(arxivId);
  return renderToStaticMarkup(
    <VisualLearningExperience kind="visualize" context={context} currentContext={context} index={index} resolver={resolver} onNavigateEvidence={() => undefined} onFocusPaper={() => undefined} onUseDeterministicFallback={() => undefined} onGeneratedChallengeComplete={() => undefined} />,
  );
}

describe("VisualLearningExperience Chain-of-Thought fast path", () => {
  it("renders the deterministic demo immediately for arXiv 2201.11903", () => {
    const markup = markupFor("2201.11903");
    expect(markup).toContain("Demo fast path");
    expect(markup).toContain("makes no model call");
    expect(markup).not.toContain("Building a source-grounded visual");
  });

  it("leaves generic papers on the normal generation path", () => {
    const markup = markupFor("1706.03762");
    expect(markup).toContain("Building a source-grounded visual");
    expect(markup).not.toContain("Demo fast path");
  });
});
