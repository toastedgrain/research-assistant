import type { VisualGenerationRequest, VisualLearningSpec } from "./contracts";

function ordinalStages(text: string): [string, string] | null {
  const match = text.replace(/\s+/g, " ").match(/\bthe\s+first\s+is\s+(?:a|the)\s+(.{3,120}?),\s+(?:and\s+)?the\s+second\s+is\s+(?:a|the)\s+(.{3,140}?)(?:\.|;|$)/i);
  if (!match) return null;
  return [match[1].trim(), match[2].trim()];
}

/** A deliberately small deterministic source map used only when local generation fails. */
export function createDeterministicVisualFallback(request: VisualGenerationRequest): VisualLearningSpec | null {
  const selected = request.sourceEvidence.find((item) =>
    item.source.kind === "passage" && item.source.text?.includes(request.selection.text),
  ) ?? request.sourceEvidence.find((item) => item.source.kind === "passage");
  if (!selected) return null;
  const concept = request.concepts.find((item) => request.selection.text.toLocaleLowerCase().includes(item.label.toLocaleLowerCase()))
    ?? request.concepts[0];
  const conceptLabel = concept?.label ?? "Selected source";
  const stages = ordinalStages(selected.source.text ?? request.selection.text);
  if (stages) {
    return {
      schemaVersion: "1", id: `fallback-process:${selected.id.replace(/[^A-Za-z0-9:_-]/g, "-")}`,
      title: "Source-described process", learningGoal: request.learningObjective, visualizationType: "process",
      nodes: [
        { id: "source-first-stage", label: stages[0].slice(0, 96), description: "The paper explicitly identifies this as the first stage.", semanticType: "process", evidenceIds: [selected.id] },
        { id: "source-second-stage", label: stages[1].slice(0, 96), description: "The paper explicitly identifies this as the second stage.", semanticType: "process", evidenceIds: [selected.id] },
      ],
      edges: [{ id: "literal-first-second", source: "source-first-stage", target: "source-second-stage", label: "first → second", relationshipType: "flows-to", evidenceIds: [selected.id] }],
      animationSteps: [{ id: "show-first", action: "show-node", targetIds: ["source-first-stage"] }, { id: "draw-order", action: "draw-edge", targetIds: ["literal-first-second"] }, { id: "show-second", action: "show-node", targetIds: ["source-second-stage"] }],
      explanationSteps: [{ id: "literal-order", text: "This ordering is copied from the selected source passage, not inferred from model knowledge.", evidenceIds: [selected.id] }],
      interactions: [{ id: "verify-order", type: "show-evidence", instruction: "Verify the explicit first/second ordering in the original passage.", targetIds: ["literal-first-second"], evidenceIds: [selected.id] }],
      evidenceIds: [selected.id], generated: false,
    };
  }
  return {
    schemaVersion: "1",
    id: `fallback:${selected.id.replace(/[^A-Za-z0-9:_-]/g, "-")}`,
    title: `${conceptLabel} source map`,
    learningGoal: request.learningObjective,
    visualizationType: "concept-map",
    nodes: [
      { id: "selected-concept", label: conceptLabel, description: "The learner-selected concept.", semanticType: "concept", evidenceIds: [selected.id] },
      { id: "original-source", label: "Original source", description: "The exact author passage that anchors this map.", semanticType: "evidence", evidenceIds: [selected.id] },
    ],
    edges: [{ id: "source-contains-concept", source: "original-source", target: "selected-concept", label: "contains", relationshipType: "contains", evidenceIds: [selected.id] }],
    animationSteps: [
      { id: "show-source", action: "show-node", targetIds: ["original-source"] },
      { id: "draw-grounding", action: "draw-edge", targetIds: ["source-contains-concept"] },
      { id: "show-concept", action: "show-node", targetIds: ["selected-concept"] },
    ],
    explanationSteps: [{ id: "read-source", text: "Start with the original passage, then inspect the selected concept in place.", evidenceIds: [selected.id] }],
    interactions: [{ id: "open-source", type: "show-evidence", instruction: "Open the exact source passage.", targetIds: ["original-source"], evidenceIds: [selected.id] }],
    evidenceIds: [selected.id],
    generated: false,
  };
}
