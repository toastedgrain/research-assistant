import { describe, expect, it } from "vitest";
import { createSourceEvidence, evidenceKey } from "../evidence/source";
import { addEdge, addNode, emptyGraph } from "../explore/graph";
import type { EvidencePacket } from "./types";
import { createClaimEvidenceHunt, createClaimVsEvidenceGame, createCompareEvidenceGame, createReconstructExperimentGame } from "./games";

function packet(paperId: string): EvidencePacket {
  const claim = createSourceEvidence(paperId, { page: 0, kind: "passage", text: "We show the method improves the result." });
  const figure = createSourceEvidence(paperId, { page: 1, kind: "figure", assetId: "fig-1" });
  const method = createSourceEvidence(paperId, { page: 0, kind: "passage", text: "The experiment uses the encoder method." });
  const result = createSourceEvidence(paperId, { page: 1, kind: "passage", text: "The experiment reports the result." });
  let graph = addNode(emptyGraph(), { id: "claim", type: "claim", label: claim.text!, source: claim, evidence: [claim], provenance: "literal", metadata: {} });
  graph = addNode(graph, { id: "figure", type: "figure", label: "Figure 1", source: figure, evidence: [figure], provenance: "literal", metadata: {} });
  graph = addNode(graph, { id: "experiment", type: "experiment", label: "Experiment", source: method, evidence: [method, result], provenance: "literal", metadata: {} });
  graph = addNode(graph, { id: "method", type: "method", label: "Encoder", source: method, evidence: [method], provenance: "literal", metadata: {} });
  graph = addNode(graph, { id: "result", type: "result", label: "Reported result", source: result, evidence: [result], provenance: "literal", metadata: {} });
  graph = addEdge(graph, { source: "claim", target: "figure", type: "supports", evidence: [claim, figure] });
  graph = addEdge(graph, { source: "experiment", target: "method", type: "uses-method", evidence: method });
  graph = addEdge(graph, { source: "experiment", target: "result", type: "reports-result", evidence: result });
  return { schemaVersion: 1, id: `packet-${paperId}`, paperId, claimNodeId: "claim", canonicalClaimText: claim.text!, claimEvidence: claim, supportingEvidence: [figure], reportedResults: [result], figures: [figure], tables: [], methods: [method], experiments: [method, result], datasetsAndBenchmarks: [], comparators: [], limitations: [], citations: [], relationships: graph.edges, supportStatus: "direct support located", missingSources: [], graph };
}

describe("evidence reasoning games", () => {
  it("builds source-scored Claim vs Evidence and Evidence Hunt", () => {
    const source = packet("paper-a");
    const claimGame = createClaimVsEvidenceGame(source)!;
    const hunt = createClaimEvidenceHunt(source)!;
    expect(claimGame).toMatchObject({ gameType: "connect-concepts", scoringMode: "scored", generated: false });
    expect(claimGame.correctState?.connections?.[0].evidenceIds).toContain(evidenceKey(source.claimEvidence));
    expect(hunt.correctState?.expectedEvidenceIds).toEqual([evidenceKey(source.figures[0])]);
  });

  it("reconstructs only literal experiment relationships", () => {
    const game = createReconstructExperimentGame(packet("paper-a"))!;
    expect(game.gameType).toBe("rebuild-architecture");
    expect(game.correctState?.connections).toHaveLength(2);
    expect(game.correctState?.connections?.every((edge) => edge.evidenceIds.length > 0)).toBe(true);
  });

  it("keeps cross-paper comparison exploratory", () => {
    expect(createCompareEvidenceGame(packet("paper-a"), packet("paper-b"))).toMatchObject({ gameType: "compare", scoringMode: "exploratory", generated: false });
  });
});
