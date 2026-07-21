import { describe, expect, it } from "vitest";
import type { Manifest } from "../manifest";
import { createSourceEvidence } from "../evidence/source";
import { MemoryWorkspaceRepository } from "./memory";
import { pinEvidencePacket, pinVerifiedEvidence } from "./pinning";
import { addEdge, addNode, emptyGraph } from "../explore/graph";
import type { EvidencePacket } from "../evidence-graph/types";

const manifest = {
  doc_id: "sha256:paper", source: { type: "upload", arxiv_id: null }, title: "Paper", page_count: 1,
  pages: [], sections: [], references: [], extraction: { version: "1", figure_backend: "caption-heuristic", warnings: [] },
  assets: [{ asset_id: "fig-1", kind: "figure", label: "Figure 1", number: "1", page: 0, bbox: [0.1, 0.1, 0.8, 0.5], caption: "Literal caption", caption_bbox: [0.1, 0.51, 0.8, 0.55], image_url: "/figure.png", image_width: 100, parent_id: null }],
} as Manifest;

describe("verified pinning", () => {
  it("persists canonical resolved evidence and its paper", async () => {
    const repository = new MemoryWorkspaceRepository();
    const evidence = createSourceEvidence(manifest, { page: 0, kind: "figure", assetId: "fig-1", bbox: manifest.assets[0].bbox });
    expect((await pinVerifiedEvidence(repository, manifest, evidence)).status).toBe("pinned");
    const [collection] = await repository.listCollections();
    expect(collection.pinnedEvidence).toEqual([evidence]);
    expect(collection.papers[0].paperId).toBe("paper");
  });

  it("rejects invalid manual-looking pointers", async () => {
    const repository = new MemoryWorkspaceRepository();
    const invalid = createSourceEvidence(manifest, { page: 0, kind: "figure", assetId: "missing" });
    expect(await pinVerifiedEvidence(repository, manifest, invalid)).toMatchObject({ status: "rejected" });
    expect(await repository.listCollections()).toEqual([]);
  });

  it("persists an evidence chain while preserving generated relationship provenance", async () => {
    const repository = new MemoryWorkspaceRepository();
    const claim = createSourceEvidence(manifest, { page: 0, kind: "passage", text: "We show Figure 1 reports the result." });
    const figure = createSourceEvidence(manifest, { page: 0, kind: "figure", assetId: "fig-1", bbox: manifest.assets[0].bbox });
    let graph = addNode(emptyGraph(), { id: "claim", type: "claim", label: claim.text!, source: claim, evidence: [claim], metadata: {} });
    graph = addNode(graph, { id: "figure", type: "figure", label: "Figure 1", source: figure, evidence: [figure], metadata: {} });
    graph = addEdge(graph, { source: "claim", target: "figure", type: "generated-related", provenance: "generated", evidence: [claim, figure], reason: "Generated candidate" });
    const packet: EvidencePacket = { schemaVersion: 1, id: "packet-1", paperId: "paper", claimNodeId: "claim", canonicalClaimText: claim.text!, claimEvidence: claim, supportingEvidence: [figure], reportedResults: [], figures: [figure], tables: [], methods: [], experiments: [], datasetsAndBenchmarks: [], comparators: [], limitations: [], citations: [], relationships: graph.edges, supportStatus: "generated candidate relationship", missingSources: [], graph };
    expect((await pinEvidencePacket(repository, manifest, packet)).status).toBe("pinned");
    const [collection] = await repository.listCollections();
    expect(collection.evidenceArtifacts[0]).toMatchObject({ type: "evidence-chain", generated: true, sourceEvidence: [claim, figure] });
  });
});
