import { describe, expect, it } from "vitest";
import { sourceEvidenceHref } from "../evidence/navigation";
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
  resolveEvidence(source) { return source; },
  findEvidence(query) {
    const all = [evidence("a", "fig-a", 1, "Attention architecture"), evidence("b", "fig-b", 2, "Attention architecture")];
    return all
      .filter((item) => !query.paperIds || query.paperIds.includes(item.paperId))
      .filter((item) => !query.text || item.text?.toLowerCase().includes(query.text.toLowerCase()));
  },
};

function learningIndex(paperId: string, assetId: string, citationTarget?: { paperId: string; arxivId: string }) {
  const manifest = {
    doc_id: `sha256:${paperId}`, source: { type: "arxiv", arxiv_id: paperId === "a" ? "1901.00001" : "2001.00001" }, title: `Paper ${paperId.toUpperCase()}`, page_count: 3,
    pages: [], sections: [], references: citationTarget ? [{ ref_id: `ref-${citationTarget.paperId}`, marker: "1", raw: "[1] Earlier paper", title: "Earlier paper", authors: [], year: 2019, arxiv_id: citationTarget.arxivId, openable: true }] : [],
    assets: [{ asset_id: assetId, kind: "figure", label: "Figure 1", number: "1", page: paperId === "a" ? 1 : 2, bbox: [0.1, 0.2, 0.9, 0.6], caption: "Attention architecture", caption_bbox: [0.1, 0.6, 0.9, 0.7], image_url: "/blob/x.png", image_width: 800, parent_id: null }],
    extraction: { version: "1", figure_backend: "caption-heuristic", warnings: [] },
  } as unknown as Manifest;
  const pages: PaperLearningPage[] = Array.from({ length: 3 }, (_, page) => ({
    items: [], mentions: [],
    citations: citationTarget && page === 0 ? [{ refIds: [`ref-${citationTarget.paperId}`], text: "[1]", rect: [0.1, 0.2, 0.15, 0.22], openable: true }] : [],
  }));
  return getPaperLearningIndex(manifest, pages);
}

describe("cross-paper learning", () => {
  it("uses only provider evidence and fails closed for unavailable papers", () => {
    const challenge = createPaperVsPaperChallenge(provider, "a", "b", "attention");
    expect(challenge?.type).toBe("paper-vs-paper");
    expect(challenge?.mode).toBe("scored");
    expect(challenge?.evidence.map((item) => item.source.paperId)).toEqual(["a", "b"]);
    expect(challenge?.evidence.map((item) => sourceEvidenceHref(item.source).split("#")[0])).toEqual(["/read/a", "/read/b"]);
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
    expect(timeline?.evidence.every((item) => item.source.kind === "metadata")).toBe(true);
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

  it("does not score unsupported caller ordering as evolutionary truth", () => {
    const challenge = createEvolutionChallenge([
      { id: "a", label: "Paper A figure", evidence: evidence("a", "fig-a", 1, "Attention architecture") },
      { id: "b", label: "Paper B figure", evidence: evidence("b", "fig-b", 2, "Attention architecture") },
    ]);
    expect(challenge?.mode).toBe("explore");
    expect(challenge && "answer" in challenge).toBe(false);
  });

  it("does not upgrade an asset labelled as a relationship into evolution truth", () => {
    const challenge = createEvolutionChallenge([
      { id: "a", label: "Paper A figure", evidence: evidence("a", "fig-a", 1, "Attention architecture") },
      {
        id: "b",
        label: "Paper B figure",
        evidence: evidence("b", "fig-b", 2, "Attention architecture"),
        relationFromPrevious: { type: "literal-citation", evidence: evidence("b", "fig-b", 2, "Attention architecture") },
      },
    ]);
    expect(challenge?.mode).toBe("explore");
  });

  it("scores evolution only when a literal citation resolves to the preceding paper", () => {
    const challenge = createEvolutionChallenge([
      { id: "a", label: "Paper A figure", evidence: evidence("a", "fig-a", 1, "Attention architecture") },
      {
        id: "b",
        label: "Paper B figure",
        evidence: evidence("b", "fig-b", 2, "Attention architecture"),
        relationFromPrevious: {
          type: "literal-citation",
          evidence: { paperId: "b", page: 0, kind: "citation", refId: "ref-a", text: "[1]" },
        },
      },
    ]);
    const resolver = createEvidenceResolver([
      learningIndex("a", "fig-a"),
      learningIndex("b", "fig-b", { paperId: "a", arxivId: "1901.00001" }),
    ]);
    expect(challenge?.mode).toBe("scored");
    expect(challenge && validateChallenge(challenge, resolver).valid).toBe(true);
  });

  it("orchestrates cross-paper concept quests from already verified challenges", () => {
    expect(createCrossPaperConceptQuest(provider, "a", "b", "attention")?.challenges).toHaveLength(1);
  });
});
