import { describe, expect, it } from "vitest";
import type { VisualGenerationRequest } from "./contracts";
import { validateVisualChallengeResponse, validateVisualLearningResponse, VisualSpecValidationError } from "./validation";

const evidenceId = "evidence-source";
const request: VisualGenerationRequest = {
  paper: { paperId: "paper", title: "Paper", arxivId: null },
  intent: "visualize",
  learningObjective: "Understand the source process",
  difficulty: "medium",
  learningMode: "learn",
  selection: { text: "Input flows to output.", page: 0 },
  section: { id: "sec-0", title: "Method", page: 0 },
  sourceWindow: [{ id: "passage", page: 0, text: "Input flows to output.", sectionId: "sec-0" }],
  concepts: [{ id: "input", label: "Input" }, { id: "output", label: "Output" }],
  assets: [], citations: [],
  sourceEvidence: [{ id: evidenceId, reason: "The source states the relationship.", source: { paperId: "paper", page: 0, kind: "passage", text: "Input flows to output.", sectionId: "sec-0" } }],
};

function learningResponse() {
  return {
    status: "ready",
    spec: {
      schemaVersion: "1", id: "visual", title: "Source flow", learningGoal: "Understand the flow", visualizationType: "flow",
      nodes: [
        { id: "input", label: "Input", description: "Source input", semanticType: "input", evidenceIds: [evidenceId] },
        { id: "output", label: "Output", description: "Source output", semanticType: "output", evidenceIds: [evidenceId] },
      ],
      edges: [{ id: "flow", source: "input", target: "output", relationshipType: "flows-to", evidenceIds: [evidenceId] }],
      animationSteps: [{ id: "show", action: "show-node", targetIds: ["input"] }],
      explanationSteps: [{ id: "explain", text: "The source states this flow.", evidenceIds: [evidenceId] }],
      interactions: [{ id: "inspect", type: "focus-node", instruction: "Inspect the input", targetIds: ["input"], evidenceIds: [evidenceId] }],
      evidenceIds: [evidenceId], generated: true,
    },
  } as const;
}

function challengeResponse() {
  return {
    status: "ready",
    spec: {
      schemaVersion: "1", id: "game", gameType: "build-flow", title: "Build the flow", learningObjective: "Rebuild the source flow",
      prompt: "Connect the source stages.", instructions: "Connect Input to Output.", evidenceIds: [evidenceId],
      interactiveElements: [
        { id: "input", kind: "node", label: "Input", evidenceIds: [evidenceId] },
        { id: "output", kind: "node", label: "Output", evidenceIds: [evidenceId] },
      ],
      initialState: { connections: [] },
      correctState: { connections: [{ id: "flow", sourceId: "input", targetId: "output", evidenceIds: [evidenceId] }] },
      scoringMode: "scored", hints: [{ id: "hint", text: "Start at Input.", evidenceIds: [evidenceId] }],
      successFeedback: "The rebuilt flow matches the source.", generated: true,
    },
  } as const;
}

describe("visual generation validation", () => {
  it("accepts a fully source-grounded learning visual and challenge", () => {
    expect(validateVisualLearningResponse(learningResponse(), request).status).toBe("ready");
    expect(validateVisualChallengeResponse(challengeResponse(), request).status).toBe("ready");
  });

  it("rejects malformed output and unknown evidence", () => {
    expect(() => validateVisualLearningResponse({ status: "ready", spec: {} }, request)).toThrow(VisualSpecValidationError);
    const visual = structuredClone(learningResponse()) as any;
    visual.spec.nodes[0].evidenceIds = ["invented-evidence"];
    expect(() => validateVisualLearningResponse(visual, request)).toThrow(/unknown evidence/);
  });

  it("rejects duplicate nodes, invalid edges, and invalid interaction targets", () => {
    const visual = structuredClone(learningResponse()) as any;
    visual.spec.nodes[1].id = "input";
    visual.spec.edges[0].target = "missing";
    visual.spec.interactions[0].targetIds = ["missing"];
    expect(() => validateVisualLearningResponse(visual, request)).toThrow(/unique.*unknown endpoint.*unknown item/i);
  });

  it("rejects unsupported scored relationships and scored predictions", () => {
    const game = structuredClone(challengeResponse()) as any;
    game.spec.correctState.connections[0].evidenceIds = [];
    expect(() => validateVisualChallengeResponse(game, request)).toThrow(/no direct source evidence/);

    const prediction = structuredClone(challengeResponse()) as any;
    prediction.spec.gameType = "prediction";
    expect(() => validateVisualChallengeResponse(prediction, request)).toThrow(/Prediction must remain exploratory/);
  });

  it("rejects invented scored components and ordering not stated by cited evidence", () => {
    const invented = structuredClone(challengeResponse()) as any;
    invented.spec.interactiveElements[0].label = "Invented embedding";
    expect(() => validateVisualChallengeResponse(invented, request)).toThrow(/not literally grounded/);

    const unorderedRequest = structuredClone(request) as VisualGenerationRequest;
    unorderedRequest.sourceEvidence[0].source.text = "Input and output are model components.";
    expect(() => validateVisualChallengeResponse(challengeResponse(), unorderedRequest)).toThrow(/lacks explicit source ordering/);
  });

  it("rejects a generated figure region without matching verified bbox evidence", () => {
    const game = structuredClone(challengeResponse()) as any;
    game.spec.gameType = "figure-detective";
    game.spec.interactiveElements[0].kind = "figure";
    game.spec.interactiveElements[0].bbox = [0.1, 0.1, 0.4, 0.4];
    expect(() => validateVisualChallengeResponse(game, request)).toThrow(/region that was not supplied/);
  });
});
