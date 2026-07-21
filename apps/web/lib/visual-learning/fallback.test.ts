import { describe, expect, it } from "vitest";
import type { VisualGenerationRequest } from "./contracts";
import { createDeterministicVisualFallback } from "./fallback";

const passage = "Each layer has two sub-layers. The first is a multi-head self-attention mechanism, and the second is a position-wise fully connected feed-forward network.";
const request: VisualGenerationRequest = {
  paper: { paperId: "paper", title: "Paper", arxivId: null }, intent: "visualize", learningObjective: "Understand the explicit source order", difficulty: "medium", learningMode: "learn",
  selection: { text: passage, page: 0 }, sourceWindow: [{ id: "passage", page: 0, text: passage }], concepts: [], assets: [], citations: [],
  sourceEvidence: [{ id: "evidence-passage", reason: "Selected source", source: { paperId: "paper", page: 0, kind: "passage", text: passage } }],
};

describe("deterministic visual fallback", () => {
  it("turns explicit first/second wording into a literal two-stage process", () => {
    const visual = createDeterministicVisualFallback(request)!;
    expect(visual).toMatchObject({ visualizationType: "process", generated: false });
    expect(visual.nodes.map((node) => node.label)).toEqual(["multi-head self-attention mechanism", "position-wise fully connected feed-forward network"]);
    expect(visual.edges[0]).toMatchObject({ source: "source-first-stage", target: "source-second-stage", evidenceIds: ["evidence-passage"] });
  });
});
