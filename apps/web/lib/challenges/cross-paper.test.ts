import { describe, expect, it } from "vitest";
import type { SourceEvidence } from "../evidence/source";
import type { CrossPaperContextProvider } from "../explore/cross-paper-provider";
import { createEvidenceResolver } from "../evidence/resource";
import type { Manifest } from "../manifest";
import { getPaperLearningIndex, type PaperLearningPage } from "../learning/paper-index";
import { createCrossPaperConceptQuest, createEvolutionChallenge, createPaperVsPaperChallenge, createTimelineChallenge } from "./cross-paper";
import { validateChallenge } from "./validator";

const evidence = (paperId: string, assetId: string, page: number, text: string): SourceEvidence => ({
  paperId, page, kind: "caption", assetId, bbox: [0.1, 0.6, 0.9, 0.7], text,
});

const provider: CrossPaperContextProvider = {
  getPaper(paperId) {
    return paperId === "a" ? { paperId: "a", title: "Paper A", arxivId: "1901.00001" }
      : paperId === "b" ? { paperId: "b", title: "Paper B", arxivId: "2001.00001" } : null;
  },
  getConnectedPapers: () => [], getCollectionPapers: () => [],
  findEvidence(query) {
    const all = [evidence("a", "fig-a", 1, "Attention architecture"), evidence("b", "fig-b", 2, "Attention architecture")];
    return all
      .filter((item) => !query.paperIds || query.paperIds.includes(item.paperId))
      .filter((item) => !query.text || item.text?.toLowerCase().includes(query.text.toLowerCase()));
  },
};

function learningIndex(paperId: string, assetId: string) {
  const manifest = {
    doc_id: `sha256:${paperId}`, source: { type: "upload", arxiv_id: null }, title: `Paper ${paperId.toUpperCase()}`, page_count: 3,
    pages: [], sections: [], references: [],
    assets: [{ asset_id: assetId, kind: "figure", label: "Figure 1", number: "1", page: paperId === "a" ? 1 : 2, bbox: [0.1, 0.2, 0.9, 0.6], caption: "Attention architecture", caption_bbox: [0.1, 0.6, 0.9, 0.7], image_url: "/blob/x.png", image_width: 800, parent_id: null }],
    extraction: { version: "1", figure_backend: "caption-heuristic", warnings: [] },
  } as unknown as Manifest;
  const pages: PaperLearningPage[] = Array.from({ length: 3 }, () => ({ items: [], mentions: [], citations: [] }));
  return getPaperLearningIndex(manifest, pages);
}

describe("cross-paper learning", () => {
  it("uses only provider evidence and fails closed for unavailable papers", () => {
    const challenge = createPaperVsPaperChallenge(provider, "a", "b", "attention");
    expect(challenge?.type).toBe("paper-vs-paper");
    expect(challenge?.mode).toBe("scored");
    expect(challenge?.evidence.map((item) => item.source.paperId)).toEqual(["a", "b"]);
    expect(challenge && validateChallenge(challenge, createEvidenceResolver([learningIndex("a", "fig-a"), learningIndex("b", "fig-b")])).valid).toBe(true);
    expect(createPaperVsPaperChallenge(provider, "a", "missing", "attention")).toBeNull();
  });

  it("orders only verified chronology with direct evidence on every paper", () => {
    const timeline = createTimelineChallenge(provider, [
      { paperId: "b", title: "Paper B", arxivId: "2001.00001", year: 2020 },
      { paperId: "a", title: "Paper A", arxivId: "1901.00001", year: 2019 },
    ]);
    expect(timeline?.type).toBe("timeline");
    expect(timeline?.mode).toBe("scored");
    expect(timeline?.mode === "scored" && timeline.answer.kind === "order" && timeline.answer.itemIds).toEqual(["a", "b"]);
    expect(timeline && validateChallenge(timeline, createEvidenceResolver([learningIndex("a", "fig-a"), learningIndex("b", "fig-b")])).valid).toBe(true);
    expect(createTimelineChallenge(provider, [{ paperId: "a", title: "A", arxivId: null, year: null }])).toBeNull();
  });

  it("keeps supplied generated evolution links visibly unscored", () => {
    const challenge = createEvolutionChallenge([
      { id: "a", label: "Paper A figure", evidence: evidence("a", "fig-a", 1, "Attention architecture"), generated: true },
      { id: "b", label: "Paper B figure", evidence: evidence("b", "fig-b", 2, "Attention architecture"), generated: true },
    ]);
    expect(challenge?.type).toBe("evolution");
    expect(challenge?.mode).toBe("explore");
    expect(challenge?.generation?.generated).toBe(true);
  });

  it("orchestrates cross-paper concept quests from already verified challenges", () => {
    expect(createCrossPaperConceptQuest(provider, "a", "b", "attention")?.challenges).toHaveLength(1);
  });
});
