import { describe, expect, it } from "vitest";
import { createCollection } from "./collections";
import { evidenceCandidates, evidenceLabel } from "./evidence";

const figure = { paperId: "p", page: 1, kind: "figure" as const, assetId: "fig-1" };

describe("workspace evidence candidates", () => {
  it("deduplicates verified pointers gathered from pins and source-backed nodes", () => {
    const collection = {
      ...createCollection("Evidence", { id: "e", now: 1 }),
      pinnedEvidence: [figure],
      boardNodes: [{ id: "n", source: figure, x: 0, y: 0 }],
      notes: [{ id: "note", text: "note", source: figure, createdAt: 1 }],
    };
    expect(evidenceCandidates(collection)).toEqual([figure]);
  });

  it("does not upgrade a user note pointer into verified comparison evidence", () => {
    const collection = {
      ...createCollection("Notes", { id: "notes", now: 1 }),
      notes: [{ id: "note", text: "user interpretation", source: figure, createdAt: 1 }],
    };
    expect(evidenceCandidates(collection)).toEqual([]);
  });

  it("keeps a useful literal label when the source manifest is unavailable", () => {
    expect(evidenceLabel(figure, null)).toBe("figure · fig-1 · page 2");
  });
});
