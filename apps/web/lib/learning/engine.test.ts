import { describe, expect, it } from "vitest";
import type { Manifest } from "../manifest";
import { buildDifficultyRegions } from "./difficulty";
import { buildLearningObjects } from "./objects";
import { buildPrerequisiteGraph } from "./prerequisites";
import { createMiniDiagram } from "./visualize";
import { getPaperLearningIndex, type PaperLearningPage } from "./paper-index";

const manifest = {
  doc_id: "sha256:learning-paper",
  source: { type: "upload", arxiv_id: null },
  title: "Learning paper",
  page_count: 3,
  pages: [
    { index: 0, width_pt: 600, height_pt: 800 },
    { index: 1, width_pt: 600, height_pt: 800 },
    { index: 2, width_pt: 600, height_pt: 800 },
  ],
  sections: [
    { title: "1 Foundations", page: 0, level: 1 },
    { title: "2 Method", page: 1, level: 1 },
    { title: "3 Results", page: 2, level: 1 },
  ],
  assets: [
    {
      asset_id: "fig-1", kind: "figure", label: "Figure 1", number: "1", page: 1,
      bbox: [0.1, 0.2, 0.9, 0.6], caption: "Attention flow.",
      caption_bbox: [0.1, 0.62, 0.9, 0.67], image_url: "/blob/learning/crops/fig-1.png", image_width: 800, parent_id: null,
    },
    {
      asset_id: "table-1", kind: "table", label: "Table 1", number: "1", page: 2,
      bbox: [0.1, 0.2, 0.9, 0.6], caption: "Accuracy results.",
      caption_bbox: [0.1, 0.62, 0.9, 0.67], image_url: "/blob/learning/crops/table-1.png", image_width: 800, parent_id: null,
    },
  ],
  references: [],
  extraction: { version: "1", figure_backend: "test", warnings: [] },
} as unknown as Manifest;

const pages: PaperLearningPage[] = [
  { items: [{ str: "We define vectors as numerical representations.", hasEOL: true, rect: [0.1, 0.2, 0.9, 0.24] }], mentions: [], citations: [] },
  { items: [
    { str: "We define attention as a weighted combination of values.", hasEOL: true, rect: [0.1, 0.2, 0.9, 0.24] },
    { str: "Attention requires vectors; Figure 1 shows the attention flow.", hasEOL: true, rect: [0.1, 0.3, 0.9, 0.34] },
  ], mentions: [], citations: [] },
  { items: [{ str: "Results show the method improves accuracy (p < 0.05); Table 1 reports the result.", hasEOL: true, rect: [0.1, 0.2, 0.9, 0.24] }], mentions: [], citations: [] },
];

describe("deterministic learning engine", () => {
  const index = getPaperLearningIndex(manifest, pages);
  const objects = buildLearningObjects(index);

  it("builds only source-linked learning objects", () => {
    const definition = objects.find((item) => item.kind === "definition" && item.label === "attention");
    const figure = objects.find((item) => item.kind === "figure");
    const claim = objects.find((item) => item.kind === "claim");
    expect(definition?.evidence[0]).toMatchObject({ paperId: index.paperId, kind: "passage", page: 1 });
    expect(figure?.evidence[0]).toMatchObject({ assetId: "fig-1", kind: "figure" });
    expect(claim?.evidence[0]).toMatchObject({ kind: "passage", page: 2 });
  });

  it("computes stable, bounded relative difficulty regions", () => {
    const first = buildDifficultyRegions(index, objects);
    const second = buildDifficultyRegions(index, objects);
    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect(first.map((region) => region.difficulty).every((score) => score >= 0 && score <= 1)).toBe(true);
    expect(first[2].reasons.some((reason) => reason.kind === "parenthetical-density")).toBe(true);
  });

  it("keeps explicit paper prerequisites source-derived and labels suggestions distinctly", () => {
    const graph = buildPrerequisiteGraph(objects, "attention", ["linear algebra"]);
    expect(graph.nodes.find((node) => node.label === "vectors")?.kind).toBe("source-derived");
    expect(graph.edges[0]).toMatchObject({ kind: "source-derived", generated: false });
    expect(graph.nodes.find((node) => node.label === "linear algebra")).toMatchObject({ kind: "suggested", generated: true });
  });

  it("renders controlled diagram data from exact source objects only", () => {
    const attention = objects.find((item) => item.kind === "concept" && item.label === "attention");
    expect(attention).toBeDefined();
    const diagram = createMiniDiagram(attention!, objects);
    expect(diagram?.nodes.map((node) => node.label)).toContain("attention");
    expect(diagram?.source[0]).toMatchObject({ paperId: index.paperId });
    expect(diagram?.nodes.map((node) => node.kind)).toEqual(["concept", "source"]);
  });
});
