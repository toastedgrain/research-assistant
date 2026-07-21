"use client";

import { useEffect, useId, useState } from "react";
import type { VisualLearningSpec } from "../../lib/visual-learning/contracts";

function quoted(value: string): string {
  return value.replace(/["<>`]/g, "").replace(/\s+/g, " ").slice(0, 96);
}

function diagramSource(spec: VisualLearningSpec): string {
  if (spec.visualizationType === "timeline") {
    return ["timeline", `  title ${quoted(spec.title)}`, ...spec.nodes.map((node) => `  ${quoted(node.label)}`)].join("\n");
  }
  const direction = spec.visualizationType === "hierarchy" ? "TD" : "LR";
  return [
    `flowchart ${direction}`,
    ...spec.nodes.map((node) => `  ${node.id}["${quoted(node.label)}"]`),
    ...spec.edges.map((edge) => `  ${edge.source} -->${edge.label ? `|${quoted(edge.label)}|` : ""} ${edge.target}`),
  ].join("\n");
}

export default function MermaidFallback({ spec }: { spec: VisualLearningSpec }) {
  const id = useId().replace(/:/g, "-");
  const [svg, setSvg] = useState<string>("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral" });
      const rendered = await mermaid.render(`marginalia-${id}`, diagramSource(spec));
      if (!cancelled) setSvg(rendered.svg);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [id, spec]);

  if (failed) return <p className="p-6 text-sm text-neutral-600 dark:text-neutral-300">The simple diagram could not render. The interactive source-backed view remains available.</p>;
  return <div className="min-h-[320px] overflow-auto p-5" aria-label={`${spec.title} simple diagram`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
