import { describe, expect, it } from "vitest";
import type { PageTextItem } from "../mentions";
import { buildConceptThread } from "./threads";

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
});
