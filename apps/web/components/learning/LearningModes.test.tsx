import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEvidenceResolver } from "../../lib/evidence/resource";
import type { Manifest } from "../../lib/manifest";
import { getPaperLearningIndex, type PaperLearningPage } from "../../lib/learning/paper-index";
import LearningModes from "./LearningModes";

const manifest = {
  doc_id: "sha256:mode-paper", source: { type: "upload", arxiv_id: null }, title: "Mode paper", page_count: 2,
  pages: [{ index: 0, width_pt: 600, height_pt: 800 }, { index: 1, width_pt: 600, height_pt: 800 }],
  sections: [{ title: "1 Foundations", page: 0, level: 1 }, { title: "2 Method", page: 1, level: 1 }],
  assets: [{ asset_id: "fig-1", kind: "figure", label: "Figure 1", number: "1", page: 1, bbox: [0.1, 0.2, 0.9, 0.6], caption: "Attention flow.", caption_bbox: [0.1, 0.62, 0.9, 0.67], image_url: "/blob/mode/crops/fig-1.png", image_width: 800, parent_id: null }],
  references: [], extraction: { version: "1", figure_backend: "caption-heuristic", warnings: [] },
} as Manifest;
const pages: PaperLearningPage[] = [
  { items: [{ str: "We define vectors as numerical representations.", hasEOL: true, rect: [0.1, 0.2, 0.9, 0.24] }], mentions: [], citations: [] },
  { items: [{ str: "We define attention as a weighted combination of values.", hasEOL: true, rect: [0.1, 0.2, 0.9, 0.24] }], mentions: [], citations: [] },
];

describe("LearningModes", () => {
  it("keeps Learn and Quest opt-in while exposing the relative difficulty rail", () => {
    const index = getPaperLearningIndex(manifest, pages);
    const markup = renderToStaticMarkup(
      <LearningModes
        index={index}
        resolver={createEvidenceResolver([index])}
        context={null}
        completedChallengeIds={new Set()}
        onStartChallenge={() => undefined}
        onStartVisualLearning={() => undefined}
        onStartVisualGame={() => undefined}
        onTrace={() => undefined}
      />,
    );
    expect(markup).toContain("Learn");
    expect(markup).toContain("Quest");
    expect(markup).toContain("Relative reading density");
    expect(markup).toContain("Section checkpoints");
  });
});
