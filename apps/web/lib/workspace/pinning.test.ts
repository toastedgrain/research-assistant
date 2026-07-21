import { describe, expect, it } from "vitest";
import type { Manifest } from "../manifest";
import { createSourceEvidence } from "../evidence/source";
import { MemoryWorkspaceRepository } from "./memory";
import { pinVerifiedEvidence } from "./pinning";

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
});
