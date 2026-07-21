import { describe, expect, it } from "vitest";
import type { PageTextItem } from "../mentions";
import { buildConceptThread } from "./threads";
import { sourceEvidenceHref } from "../evidence/navigation";

function item(str: string, pageY = 0.2, hasEOL = true): PageTextItem {
  return { str, hasEOL, rect: [0.1, pageY, 0.9, pageY + 0.02] };
}

describe("buildConceptThread", () => {
  it("orders repeated exact concepts across pages and groups them by section", () => {
    const thread = buildConceptThread({
      paperId: "paper-1",
      concept: "filter",
      pages: [
        { items: [item("The \uFB01lter learns local features.")], mentions: [], citations: [] },
        { items: [item("We refine the filter in later layers.")], mentions: [], citations: [] },
      ],
      sections: [
        { title: "Method", page: 0, level: 1 },
        { title: "Analysis", page: 1, level: 1 },
      ],
      assets: [],
    });

    expect(thread.occurrences.map((occurrence) => occurrence.page)).toEqual([0, 1]);
    expect(thread.groups.map((group) => group.section?.title)).toEqual([
      "Method",
      "Analysis",
    ]);
  });

  it("matches a normally hyphenated concept across a PDF line-break hyphen", () => {
    const thread = buildConceptThread({
      paperId: "paper-1",
      concept: "self-attention",
      pages: [
        {
          items: [
            item("The self-", 0.2, true),
            item("attention layer mixes token information.", 0.23, true),
          ],
          mentions: [],
          citations: [],
        },
      ],
      sections: [{ title: "Attention", page: 0, level: 1 }],
      assets: [],
    });

    expect(thread.occurrences).toHaveLength(1);
    expect(thread.occurrences[0].evidence.bbox).toEqual([
      0.1, 0.2, 0.9, 0.25,
    ]);
  });

  it("canonicalizes every occurrence and links the selected occurrence exactly", () => {
    const thread = buildConceptThread({
      paperId: "sha256:paper-1", concept: "attention",
      pages: [{ items: [item("Attention uses values.", 0.3)], mentions: [], citations: [{ refIds: ["ref-1"], text: "[1]", rect: [0.7, 0.3, 0.75, 0.32], openable: false }] }],
      sections: [{ title: "Method", page: 0, level: 1 }],
      assets: [{ asset_id: "fig-1", kind: "figure", label: "Figure 1", number: "1", page: 0, bbox: [0.1, 0.5, 0.8, 0.8], caption: "Attention", caption_bbox: [0.1, 0.81, 0.8, 0.85], image_url: "/figure.png", image_width: 100, parent_id: null }],
    });
    expect(thread.paperId).toBe("paper-1");
    expect(thread.occurrences[0].evidence.paperId).toBe("paper-1");
    expect(thread.occurrences[0].nearbyAssets[0].assetId).toBe("fig-1");
    expect(thread.occurrences[0].citationLandmarks).toEqual(["[1]"]);
    expect(sourceEvidenceHref(thread.occurrences[0].evidence)).toMatch(/^\/read\/paper-1#page=0&evidence=/);
  });
});
