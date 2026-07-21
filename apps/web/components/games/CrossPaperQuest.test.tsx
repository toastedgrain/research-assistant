import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CrossPaperContextProvider } from "../../lib/explore/cross-paper-provider";
import CrossPaperQuest from "./CrossPaperQuest";

const provider: CrossPaperContextProvider = {
  resolveEvidence(source) { return source; },
  getPaper: (id) => id === "a" ? { paperId: "a", title: "A", arxivId: null } : id === "b" ? { paperId: "b", title: "B", arxivId: null } : null,
  getConnectedPapers: () => [], getCollectionPapers: () => [],
  findEvidence: (query) => [
    { paperId: "a", page: 0, kind: "caption" as const, assetId: "fig-a", text: "attention", bbox: [0.1, 0.6, 0.9, 0.7] as [number, number, number, number] },
    { paperId: "b", page: 0, kind: "caption" as const, assetId: "fig-b", text: "attention", bbox: [0.1, 0.6, 0.9, 0.7] as [number, number, number, number] },
  ].filter((item) => !query.paperIds || query.paperIds.includes(item.paperId)),
};

describe("CrossPaperQuest", () => {
  it("renders no scored comparison without a resolver, preserving failure-closed behavior", () => {
    expect(renderToStaticMarkup(<CrossPaperQuest provider={provider} paperAId="a" paperBId="b" query="attention" />)).toContain("requires both loaded papers");
  });
});
