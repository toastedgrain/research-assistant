import { describe, expect, it } from "vitest";
import {
  assetEvidence,
  citationEvidence,
  evidenceKey,
  passageEvidence,
} from "./source";
import { createEvidenceResolver, validateSourceEvidence } from "./resource";
import type { Manifest } from "../manifest";
import { getPaperLearningIndex, type PaperLearningPage } from "../learning/paper-index";
import type { ChallengeEvidence } from "../challenges/contracts";

const manifest = {
  doc_id: "sha256:resolver-paper",
  source: { type: "upload", arxiv_id: null },
  title: "Resolver paper",
  page_count: 1,
  pages: [{ index: 0, width_pt: 600, height_pt: 800 }],
  assets: [{
    asset_id: "fig-1",
    kind: "figure",
    label: "Figure 1",
    number: "1",
    page: 0,
    bbox: [0.1, 0.4, 0.8, 0.8],
    caption: "Figure 1: Evidence.",
    caption_bbox: [0.1, 0.81, 0.8, 0.85],
    image_url: "/figure.png",
    image_width: 200,
    parent_id: null,
  }],
  references: [{ ref_id: "ref-1", marker: "1", raw: "[1] Cited work.", title: "Cited work", authors: [], year: null, arxiv_id: null, openable: false }],
  sections: [{ title: "Method", page: 0, level: 1 }],
  extraction: { version: "1", figure_backend: "caption-heuristic", warnings: [] },
} as Manifest;

const pages: PaperLearningPage[] = [{
  items: [{ str: "The paper defines attention.", hasEOL: true, rect: [0.1, 0.2, 0.8, 0.24] }],
  mentions: [],
  citations: [{ refIds: ["ref-1"], text: "[1]", rect: [0.1, 0.3, 0.15, 0.32], openable: false }],
}];

function wrapper(source: ChallengeEvidence["source"], resource?: ChallengeEvidence["resource"]): ChallengeEvidence {
  return { id: evidenceKey(source), source, reason: "Test evidence.", ...(resource ? { resource } : {}) };
}

describe("EvidenceResolver", () => {
  it("resolves passage and figure resources from canonical evidence", () => {
    const index = getPaperLearningIndex(manifest, pages);
    const passage = index.passages[0];
    const resolver = createEvidenceResolver([index]);
    const passageItem = wrapper(
      passageEvidence(index.paperId, 0, passage.text, { bbox: passage.bbox, sectionId: passage.sectionId }),
      { kind: "passage", resourceId: passage.id },
    );
    const figureItem = wrapper(assetEvidence(index.paperId, manifest.assets[0]));
    const citationItem = wrapper(citationEvidence(index.paperId, manifest.references[0], 0), { kind: "citation", resourceId: "ref-1" });

    expect(resolver.resolve(passageItem)).toMatchObject({ status: "resolved", label: "Passage" });
    expect(resolver.resolve({
      ...passageItem,
      source: { ...passageItem.source, paperId: manifest.doc_id },
    })).toMatchObject({ status: "resolved", label: "Passage" });
    expect(resolver.resolve(figureItem)).toMatchObject({ status: "resolved", label: "Figure 1" });
    expect(resolver.resolve(citationItem)).toMatchObject({ status: "resolved", label: "Citation" });
  });

  it("fails closed for an unloaded paper, invalid page, missing passage, and missing asset", () => {
    const index = getPaperLearningIndex(manifest, pages);
    const resolver = createEvidenceResolver([index]);
    const passage = index.passages[0];

    expect(resolver.resolve(wrapper(passageEvidence("other-paper", 0, passage.text), { kind: "passage", resourceId: passage.id })).status).toBe("unresolved");
    expect(resolver.resolve(wrapper(passageEvidence(index.paperId, 4, passage.text), { kind: "passage", resourceId: passage.id })).status).toBe("unresolved");
    expect(resolver.resolve(wrapper(passageEvidence(index.paperId, 0, passage.text), { kind: "passage", resourceId: "missing" })).status).toBe("unresolved");
    expect(resolver.resolve(wrapper({ paperId: index.paperId, page: 0, kind: "figure", assetId: "missing" })).status).toBe("unresolved");
  });

  it("rejects invalid persisted pages, assets, citations, and unavailable papers", () => {
    const paperId = manifest.doc_id.replace("sha256:", "");
    expect(validateSourceEvidence(passageEvidence(paperId, 2, "outside"), manifest).status).toBe("unresolved");
    expect(validateSourceEvidence({ paperId, page: 0, kind: "figure", assetId: "missing" }, manifest).status).toBe("unresolved");
    expect(validateSourceEvidence({ paperId, page: 0, kind: "citation", refId: "missing" }, manifest).status).toBe("unresolved");
    expect(validateSourceEvidence(passageEvidence(paperId, 0, "source"), null)).toMatchObject({ status: "unresolved", reason: expect.stringContaining("unavailable") });
  });
});
