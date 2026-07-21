import type { LearningObject, PrerequisiteGraph, PrerequisiteNode } from "./types";

function normalized(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function nodeId(label: string): string {
  return `concept-${normalized(label).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "")}`;
}

/**
 * Only literal "requires/depends on/uses" statements create source-derived edges. Optional
 * outside suggestions remain visibly generated and are never eligible for scored answers.
 */
export function buildPrerequisiteGraph(
  objects: readonly LearningObject[],
  rootLabel: string,
  suggestedLabels: readonly string[] = [],
): PrerequisiteGraph {
  const concepts = objects.filter((object) => object.kind === "concept");
  const root = concepts.find((concept) => normalized(concept.label) === normalized(rootLabel));
  const rootNode: PrerequisiteNode = {
    id: root?.id ?? nodeId(rootLabel), label: root?.label ?? rootLabel.trim(), kind: "source-derived",
    generated: false, source: root?.evidence ?? [],
  };
  const nodes: PrerequisiteNode[] = [rootNode];
  const edges: PrerequisiteGraph["edges"] = [];
  const rootPattern = rootNode.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  for (const concept of concepts) {
    if (concept.id === rootNode.id) continue;
    const conceptPattern = concept.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const relationship = new RegExp(`\\b${rootPattern}\\s+(?:requires|depends on|uses)\\s+${conceptPattern}\\b`, "i");
    const evidence = objects
      .flatMap((object) => object.evidence)
      .find((item) => relationship.test(item.text ?? ""));
    if (!evidence) continue;
    const node: PrerequisiteNode = { id: concept.id, label: concept.label, kind: "source-derived", generated: false, source: concept.evidence };
    nodes.push(node);
    edges.push({ from: node.id, to: rootNode.id, kind: "source-derived", generated: false, source: [evidence] });
  }

  for (const label of suggestedLabels) {
    if (!label.trim() || nodes.some((node) => normalized(node.label) === normalized(label))) continue;
    nodes.push({ id: nodeId(label), label: label.trim(), kind: "suggested", generated: true, source: [] });
  }
  return { rootConceptId: rootNode.id, nodes, edges, generated: nodes.some((node) => node.generated), source: rootNode.source };
}
