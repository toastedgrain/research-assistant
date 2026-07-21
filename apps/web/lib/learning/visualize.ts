import type { LearningObject, MiniDiagram } from "./types";

/** A small source map, not a generated explanation or arbitrary executable UI. */
export function createMiniDiagram(
  object: LearningObject,
  objects: readonly LearningObject[],
): MiniDiagram | null {
  const source = object.evidence;
  if (source.length === 0) return null;
  const relatedDefinition = objects.find(
    (candidate) => candidate.kind === "definition" && candidate.label.toLocaleLowerCase() === object.label.toLocaleLowerCase(),
  );
  const definitionEvidence = relatedDefinition?.evidence[0] ?? source[0];
  const nodes: MiniDiagram["nodes"] = [
    { id: "concept", label: object.label, kind: "concept", evidence: source },
    { id: "source", label: "Source definition", kind: "source", evidence: [definitionEvidence] },
  ];
  return {
    id: `diagram:${object.id}`,
    label: `${object.label} source map`,
    nodes,
    edges: [{ from: "concept", to: "source", label: "defined in", evidence: [definitionEvidence] }],
    source: [definitionEvidence],
  };
}
