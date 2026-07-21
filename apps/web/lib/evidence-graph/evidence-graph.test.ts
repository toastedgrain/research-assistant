import { describe, expect, it } from "vitest";
import type { Manifest } from "../manifest";
import { evidenceKey } from "../evidence/source";
import { getPaperLearningIndex, type PaperLearningPage } from "../learning/paper-index";
import { boundedGraph, buildEvidenceGraph, buildEvidencePacket, validateGraphEvidence } from "./evidence-graph";
import { validateGeneratedGraphResponse, validateInvestigatorResponse, validateTensionResponse } from "./generation";

function fixture(id: string) {
  const manifest = {
    doc_id: `sha256:${id}`, source: { type: "arxiv", arxiv_id: "2001.00001" }, title: `Evidence ${id}`, page_count: 3,
    pages: [{ index: 0, width_pt: 600, height_pt: 800 }, { index: 1, width_pt: 600, height_pt: 800 }, { index: 2, width_pt: 600, height_pt: 800 }],
    sections: [{ title: "Method", page: 0, level: 1 }, { title: "Results", page: 1, level: 1 }, { title: "Limitations", page: 2, level: 1 }],
    assets: [
      { asset_id: "fig-1", kind: "figure", label: "Figure 1", number: "1", page: 1, bbox: [0.1, 0.2, 0.8, 0.5], caption: "Measured trend", caption_bbox: [0.1, 0.52, 0.8, 0.57], image_url: "/figure.png", image_width: 800, parent_id: null },
      { asset_id: "table-1", kind: "table", label: "Table 1", number: "1", page: 1, bbox: [0.1, 0.6, 0.8, 0.8], caption: "Reported accuracy", caption_bbox: [0.1, 0.82, 0.8, 0.87], image_url: "/table.png", image_width: 800, parent_id: null },
    ],
    references: [{ ref_id: "ref-1", marker: "1", raw: "Prior work", title: "Prior work", authors: [], year: 2019, arxiv_id: "1901.00001", openable: true }],
    extraction: { version: "1", figure_backend: "test", warnings: [] },
  } as unknown as Manifest;
  const pages: PaperLearningPage[] = [
    { items: [{ str: "We evaluated on ImageNet dataset using our method.", hasEOL: true, rect: [0.1, 0.2, 0.9, 0.24] }], mentions: [], citations: [] },
    { items: [{ str: "We show that Figure 1 and Table 1 report improved accuracy [1].", hasEOL: true, rect: [0.1, 0.2, 0.9, 0.24] }], mentions: [], citations: [{ refIds: ["ref-1"], text: "[1]", rect: [0.8, 0.2, 0.85, 0.24], openable: true }] },
    { items: [{ str: "However, the result is limited to this evaluation setting.", hasEOL: true, rect: [0.1, 0.2, 0.9, 0.24] }], mentions: [], citations: [] },
  ];
  const index = getPaperLearningIndex(manifest, pages);
  const graph = buildEvidenceGraph(index);
  const claim = graph.nodes.find((node) => node.type === "claim")!;
  const packet = buildEvidencePacket(graph, claim.id, index)!;
  return { index, graph, claim, packet };
}

describe("canonical evidence graph", () => {
  it("creates literal claim links to directly referenced figures and tables", () => {
    const { graph, claim } = fixture("paper-a");
    const targets = graph.edges.filter((edge) => edge.source === claim.id && edge.type === "supports").map((edge) => graph.nodes.find((node) => node.id === edge.target)?.type).sort();
    expect(targets).toEqual(["figure", "table"]);
    expect(graph.edges.filter((edge) => edge.source === claim.id && edge.type === "supports").every((edge) => edge.provenance === "literal" && edge.evidence.length > 0)).toBe(true);
  });

  it("represents experiment, dataset, result, and literal citation provenance", () => {
    const { graph } = fixture("paper-a");
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "evaluated-on", provenance: "literal" }),
      expect.objectContaining({ type: "reports-result", provenance: "literal" }),
      expect.objectContaining({ type: "cites", provenance: "literal" }),
    ]));
  });

  it("builds a bounded packet and preserves qualifications", () => {
    const { packet, graph, claim } = fixture("paper-a");
    expect(packet.canonicalClaimText).toContain("We show");
    expect(packet.supportingEvidence.length).toBeGreaterThan(0);
    expect(packet.limitations[0]?.text).toContain("limited");
    expect(boundedGraph(graph, claim.id, 3).nodes.length).toBeLessThanOrEqual(3);
  });

  it("fails closed when graph evidence no longer resolves", () => {
    const { index, graph } = fixture("paper-a");
    const edge = graph.edges.find((item) => item.evidence.length > 0)!;
    const invalid = { ...graph, edges: graph.edges.map((item) => item.id === edge.id ? { ...item, evidence: [{ ...item.evidence[0], page: 99 }] } : item) };
    expect(validateGraphEvidence(invalid, index)).toMatchObject({ valid: false });
  });

  it("never upgrades a generated candidate to a literal relationship", () => {
    const { graph } = fixture("paper-a");
    const claims = graph.nodes.filter((node) => node.type === "claim");
    const source = claims[0];
    const target = graph.nodes.find((node) => node.id !== source.id && node.source)!;
    const id = evidenceKey(source.source!);
    const targetId = evidenceKey(target.source!);
    const merged = validateGeneratedGraphResponse({ status: "ready", relationships: [{ id: "candidate-1", source: source.id, target: target.id, type: "agrees-candidate", provenance: "literal", evidenceIds: [id, targetId], reason: "Candidate worth inspecting" }] }, graph);
    expect(merged.edges.find((edge) => edge.id === "candidate-1")).toMatchObject({ provenance: "generated", generated: true });
    const rejected = validateGeneratedGraphResponse({ status: "ready", relationships: [{ id: "candidate-bad", source: source.id, target: target.id, type: "agrees-candidate", provenance: "generated", evidenceIds: ["unknown"], reason: "Invalid" }] }, graph);
    expect(rejected.edges.some((edge) => edge.id === "candidate-bad")).toBe(false);
  });
});

describe("bounded model interpretations", () => {
  it("requires investigator evidence ids to come from the packet", () => {
    const { packet } = fixture("paper-a");
    const id = evidenceKey(packet.claimEvidence);
    expect(validateInvestigatorResponse({ status: "ready", interpretation: { generated: true, text: "The indexed source is consistent with the authors' claim under the reported setting.", evidenceIds: [id], qualifications: [], uncertainty: null } }, packet)).toMatchObject({ status: "ready", interpretation: { evidenceIds: [id] } });
    expect(validateInvestigatorResponse({ status: "ready", interpretation: { generated: true, text: "Outside packet", evidenceIds: ["unknown"], qualifications: [], uncertainty: null } }, packet)).toMatchObject({ status: "insufficient-evidence" });
  });

  it("requires tension candidates to cite both packets and preserves generated provenance", () => {
    const left = fixture("paper-a").packet;
    const right = fixture("paper-b").packet;
    const value = { status: "ready", candidates: [{ id: "tension-1", relation: "possible-tension", paperAId: left.paperId, paperBId: right.paperId, paperAEvidenceIds: [evidenceKey(left.claimEvidence)], paperBEvidenceIds: [evidenceKey(right.claimEvidence)], reason: "Reported outcomes are worth comparing under their stated settings.", provenance: "literal" }] };
    expect(validateTensionResponse(value, left, right)[0]).toMatchObject({ provenance: "generated", generated: true });
    expect(validateTensionResponse({ ...value, candidates: [{ ...value.candidates[0], paperBEvidenceIds: ["unknown"] }] }, left, right)).toEqual([]);
  });
});
