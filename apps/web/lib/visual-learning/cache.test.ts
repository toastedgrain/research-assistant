import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { VisualGenerationRequest } from "./contracts";
import { generatedVisualCacheKey, IndexedDbGeneratedVisualRepository } from "./cache";

const request = {
  paper: { paperId: "paper", title: "Paper", arxivId: null }, intent: "visualize", learningObjective: "Learn", difficulty: "easy", learningMode: "learn",
  selection: { text: "Source", page: 0 }, sourceWindow: [{ id: "p", page: 0, text: "Source" }], concepts: [], assets: [], citations: [],
  sourceEvidence: [{ id: "evidence", reason: "source", source: { paperId: "paper", page: 0, kind: "passage", text: "Source" } }],
} as VisualGenerationRequest;

describe("generated visual cache", () => {
  it("uses paper, evidence, intent, model, and schema in a deterministic key", () => {
    expect(generatedVisualCacheKey(request, "learning", "model-a")).toBe(generatedVisualCacheKey(structuredClone(request), "learning", "model-a"));
    expect(generatedVisualCacheKey(request, "learning", "model-a")).not.toBe(generatedVisualCacheKey(request, "challenge", "model-a"));
    expect(generatedVisualCacheKey(request, "learning", "model-a")).not.toBe(generatedVisualCacheKey(request, "learning", "model-b"));
  });

  it("persists generated artifacts outside the static manifest", async () => {
    const repository = new IndexedDbGeneratedVisualRepository({ databaseName: `generated-${Date.now()}-${Math.random()}` });
    const artifact = { key: "key", kind: "learning" as const, paperId: "paper", model: "model", schemaVersion: "1" as const, createdAt: 1, response: { status: "insufficient-evidence" as const, reason: "Not enough source structure." } };
    await repository.put(artifact);
    expect(await repository.get("key")).toEqual(artifact);
  });
});
