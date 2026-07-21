import { describe, expect, it, vi } from "vitest";
import { createSourceEvidence } from "./source";
import { evidenceTarget, navigateToEvidence, paperHref, parseEvidenceHash, sourceEvidenceHref, sourcePageHref } from "./navigation";

const evidence = createSourceEvidence("sha256:paper-a", {
  page: 3,
  kind: "passage",
  text: "Exact passage",
  bbox: [0.1, 0.2, 0.8, 0.3],
});

describe("evidence navigation", () => {
  it("creates an exact canonical Reader link", () => {
    const href = sourceEvidenceHref(evidence);
    expect(href).toMatch(/^\/read\/paper-a#page=3&evidence=/);
    expect(href).toContain("bbox=0.1%2C0.2%2C0.8%2C0.3");
  });

  it("parses page, evidence, asset, and bbox fragments and rejects invalid pages", () => {
    expect(parseEvidenceHash("#page=3&evidence=evidence-a&asset=fig-1&bbox=0.1,0.2,0.8,0.3", 5))
      .toMatchObject({ page: 3, evidenceId: "evidence-a", assetId: "fig-1", bbox: [0.1, 0.2, 0.8, 0.3] });
    expect(parseEvidenceHash("#page=5", 5)).toBeNull();
    expect(parseEvidenceHash("#page=-1", 5)).toBeNull();
  });

  it("centralizes canonical paper and page-only fallbacks", () => {
    expect(paperHref("sha256:paper-a")).toBe("/read/paper-a");
    expect(sourcePageHref("sha256:paper-a", 4)).toBe("/read/paper-a#page=4");
    expect(sourcePageHref("paper-a", -1)).toBe("/read/paper-a");
  });

  it("routes current-paper evidence through the exact in-reader target", () => {
    const onCurrent = vi.fn();
    expect(navigateToEvidence(evidence, { currentPaperId: "paper-a", currentPageCount: 5, onCurrent })).toBe(true);
    expect(onCurrent).toHaveBeenCalledWith(expect.objectContaining({ page: 3, bbox: evidence.bbox }), evidence);
  });

  it("canonicalizes a legacy prefixed paper id at the navigation boundary", () => {
    expect(evidenceTarget(
      { paperId: "sha256:paper-a", page: 1, kind: "passage", text: "evidence" },
      { "paper-a": 3 },
    )).toMatchObject({ paperId: "paper-a", page: 1 });
  });

  it("routes cross-paper evidence through the same canonical href", () => {
    const onCrossPaper = vi.fn();
    navigateToEvidence(evidence, { currentPaperId: "paper-b", currentPageCount: 5, onCurrent: vi.fn(), onCrossPaper });
    expect(onCrossPaper).toHaveBeenCalledWith(sourceEvidenceHref(evidence), evidence);
  });
});
