import { evidenceKey } from "../evidence/source";
import type { VisualChallengeSpec } from "../visual-learning/contracts";
import type { EvidencePacket } from "./types";

function safeId(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9:_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "item";
}

function evidenceIds(packet: EvidencePacket): string[] {
  return [...new Set([packet.claimEvidence, ...packet.supportingEvidence, ...packet.reportedResults, ...packet.figures, ...packet.tables, ...packet.methods, ...packet.experiments, ...packet.datasetsAndBenchmarks, ...packet.comparators, ...packet.limitations, ...packet.citations].map(evidenceKey))];
}

export function createClaimVsEvidenceGame(packet: EvidencePacket): VisualChallengeSpec | null {
  const support = packet.graph.edges.filter((edge) => edge.source === packet.claimNodeId && edge.type === "supports" && edge.provenance === "literal");
  if (!support.length) return null;
  const targets = support.flatMap((edge) => {
    const node = packet.graph.nodes.find((item) => item.id === edge.target);
    return node ? [{ edge, node }] : [];
  });
  if (!targets.length) return null;
  const claimId = "canonical-claim";
  const targetId = new Map(targets.map(({ node }, index) => [node.id, `source-${index + 1}`]));
  return {
    schemaVersion: "1", id: safeId(`claim-vs-evidence-${packet.id}`), gameType: "connect-concepts", title: "Claim vs Evidence",
    learningObjective: "Connect the authors' canonical claim to the source material it directly references.",
    prompt: "Which indexed source evidence is directly connected to this claim?", instructions: "Connect the claim to each source-backed evidence node, then submit.",
    evidenceIds: evidenceIds(packet),
    interactiveElements: [
      { id: claimId, kind: "node", label: packet.canonicalClaimText.slice(0, 96), semanticType: "concept", evidenceIds: [evidenceKey(packet.claimEvidence)] },
      ...targets.map(({ node }, index) => ({ id: `source-${index + 1}`, kind: "node" as const, label: node.label.slice(0, 96), semanticType: "evidence" as const, evidenceIds: (node.evidence ?? (node.source ? [node.source] : [])).map(evidenceKey) })),
    ],
    initialState: { connections: [] },
    correctState: { connections: targets.map(({ edge, node }, index) => ({ id: `support-${index + 1}`, sourceId: claimId, targetId: targetId.get(node.id) as string, label: edge.type, evidenceIds: edge.evidence.map(evidenceKey) })) },
    scoringMode: "scored", hints: [{ id: "hint-source-reference", text: "Look for figures, tables, or result passages directly referenced in the canonical claim.", evidenceIds: [evidenceKey(packet.claimEvidence)] }],
    successFeedback: "You reconstructed the direct indexed claim-to-evidence links.", sourceReveal: { label: "Show claim evidence", evidenceIds: [evidenceKey(packet.claimEvidence), ...support.flatMap((edge) => edge.evidence.map(evidenceKey)).slice(0, 7)] }, generated: false,
  };
}

export function createReconstructExperimentGame(packet: EvidencePacket): VisualChallengeSpec | null {
  const experiments = packet.graph.nodes.filter((node) => node.type === "experiment");
  const relationTypes = new Set(["uses-method", "reports-result", "evaluated-on", "compares-against"]);
  const relations = packet.graph.edges.filter((edge) => experiments.some((node) => node.id === edge.source) && relationTypes.has(edge.type) && edge.provenance === "literal");
  if (!relations.length) return null;
  const nodeIds = [...new Set(relations.flatMap((edge) => [edge.source, edge.target]))];
  const nodes = nodeIds.flatMap((id) => { const node = packet.graph.nodes.find((item) => item.id === id); return node ? [node] : []; });
  const elementId = new Map(nodes.map((node, index) => [node.id, `experiment-part-${index + 1}`]));
  return {
    schemaVersion: "1", id: safeId(`reconstruct-experiment-${packet.id}`), gameType: "rebuild-architecture", title: "Reconstruct the Experiment",
    learningObjective: "Rebuild the literal relationships among the experiment, method, evaluation source, comparator, and reported result.",
    prompt: "Reconnect the source-backed experiment structure.", instructions: "Connect each experiment component according to the relationships explicitly indexed from the paper.", evidenceIds: evidenceIds(packet),
    interactiveElements: nodes.map((node, index) => ({ id: `experiment-part-${index + 1}`, kind: "node", label: node.label.slice(0, 96), semanticType: node.type === "dataset" || node.type === "benchmark" ? "dataset" : node.type === "result" ? "result" : node.type === "method" ? "method" : "process", evidenceIds: (node.evidence ?? (node.source ? [node.source] : [])).map(evidenceKey) })),
    initialState: { connections: [] }, correctState: { connections: relations.map((edge, index) => ({ id: `experiment-relation-${index + 1}`, sourceId: elementId.get(edge.source) as string, targetId: elementId.get(edge.target) as string, label: edge.type, evidenceIds: edge.evidence.map(evidenceKey) })) }, scoringMode: "scored",
    hints: [{ id: "hint-experiment", text: "Start with the experiment node, then distinguish what it uses, what it evaluates on, and what it reports.", evidenceIds: relations[0].evidence.map(evidenceKey) }], successFeedback: "You reconstructed the evidence-backed experiment relationships.", sourceReveal: { label: "Show experiment sources", evidenceIds: relations.flatMap((edge) => edge.evidence.map(evidenceKey)).slice(0, 8) }, generated: false,
  };
}

export function createClaimEvidenceHunt(packet: EvidencePacket): VisualChallengeSpec | null {
  const expected = [...new Set(packet.supportingEvidence.map(evidenceKey))];
  if (!expected.length) return null;
  return {
    schemaVersion: "1", id: safeId(`evidence-hunt-${packet.id}`), gameType: "evidence-hunt", title: "Evidence Hunt",
    learningObjective: "Locate the original source evidence directly indexed for the claim.", prompt: packet.canonicalClaimText.slice(0, 320), instructions: "Return to the PDF and select the source evidence that supports this claim.", evidenceIds: evidenceIds(packet),
    interactiveElements: expected.map((id, index) => ({ id: `evidence-target-${index + 1}`, kind: "evidence-target", label: `Expected source ${index + 1}`, semanticType: "evidence", evidenceIds: [id] })),
    initialState: { expectedEvidenceIds: [] }, correctState: { expectedEvidenceIds: expected }, scoringMode: "scored",
    hints: [{ id: "hint-hunt", text: "Follow any figure, table, or result reference in the canonical claim before revealing the answer.", evidenceIds: [evidenceKey(packet.claimEvidence)] }], successFeedback: "You located the expected source evidence.", sourceReveal: { label: "Show expected evidence", evidenceIds: expected.slice(0, 8) }, generated: false,
  };
}

export function createCompareEvidenceGame(paperA: EvidencePacket, paperB: EvidencePacket): VisualChallengeSpec {
  const left = [paperA.claimEvidence, ...paperA.supportingEvidence].slice(0, 4);
  const right = [paperB.claimEvidence, ...paperB.supportingEvidence].slice(0, 4);
  return {
    schemaVersion: "1", id: safeId(`compare-evidence-${paperA.id}-${paperB.id}`), gameType: "compare", title: "Compare Evidence",
    learningObjective: "Inspect how two papers report evidence without upgrading semantic similarity into scientific agreement or contradiction.", prompt: "Compare the two source-backed evidence packets.", instructions: "Inspect each source node and record similarities or differences as exploratory observations.", evidenceIds: [...new Set([...left, ...right].map(evidenceKey))],
    interactiveElements: [...left.map((source, index) => ({ id: `paper-a-${index + 1}`, kind: "node" as const, label: `Paper A · ${source.kind} · p.${source.page + 1}`, semanticType: "evidence" as const, evidenceIds: [evidenceKey(source)] })), ...right.map((source, index) => ({ id: `paper-b-${index + 1}`, kind: "node" as const, label: `Paper B · ${source.kind} · p.${source.page + 1}`, semanticType: "evidence" as const, evidenceIds: [evidenceKey(source)] }))],
    initialState: {}, scoringMode: "exploratory", hints: [{ id: "hint-conditions", text: "Compare reported conditions, methods, metrics, and qualifications before interpreting outcomes.", evidenceIds: [evidenceKey(paperA.claimEvidence), evidenceKey(paperB.claimEvidence)] }], successFeedback: "You inspected evidence from both papers without turning an inferred relation into source truth.", sourceReveal: { label: "Show original evidence", evidenceIds: [...left, ...right].map(evidenceKey).slice(0, 8) }, generated: false,
  };
}
