import { z } from "zod/v3";
import { zodToJsonSchema } from "zod-to-json-schema";
import { evidenceKey } from "../evidence/source";
import {
  addEdge,
  type ResearchGraph,
  type ResearchGraphEdgeType,
} from "../explore/graph";
import type { EvidencePacket, InvestigatorResult, TensionCandidate } from "./types";

const boundedSourceEvidenceSchema = z.object({
  paperId: z.string().min(1).max(128).refine((value) => !value.startsWith("sha256:")),
  page: z.number().int().min(0).max(20_000),
  kind: z.enum(["passage", "figure", "table", "algorithm", "equation", "caption", "citation"]),
  text: z.string().max(4_000).optional(),
  assetId: z.string().max(128).optional(),
  refId: z.string().max(128).optional(),
  bbox: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]).optional(),
  sectionId: z.string().max(128).optional(),
}).strict();

const graphNodeTypeSchema = z.enum(["paper", "section", "concept", "claim", "evidence", "passage", "figure", "table", "equation", "algorithm", "author", "method", "experiment", "result", "dataset", "benchmark", "citation", "limitation"]);
const graphEdgeTypeSchema = z.enum(["cites", "contains", "mentions", "uses", "supports", "reports-result", "produced-by", "uses-method", "evaluated-on", "compares-against", "extends", "qualifies", "contradicts-candidate", "agrees-candidate", "user-connected", "coauthored", "describes-method", "generated-related"]);
const graphEdgeSchema = z.object({
  id: z.string().min(1).max(240), source: z.string().min(1).max(240), target: z.string().min(1).max(240),
  type: graphEdgeTypeSchema, provenance: z.enum(["literal", "generated", "user"]), generated: z.boolean(),
  evidence: z.array(boundedSourceEvidenceSchema).max(16), reason: z.string().max(600).optional(),
}).strict();
export const boundedResearchGraphSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().min(1).max(240), type: graphNodeTypeSchema, label: z.string().min(1).max(500), description: z.string().max(1_000).optional(),
    source: boundedSourceEvidenceSchema.optional(), evidence: z.array(boundedSourceEvidenceSchema).max(16).optional(),
    provenance: z.enum(["literal", "generated", "user"]).optional(), metadata: z.record(z.unknown()),
  }).strict()).min(1).max(60),
  edges: z.array(graphEdgeSchema).max(100),
}).strict();

const evidencePacketSchema: z.ZodType<EvidencePacket> = z.object({
  schemaVersion: z.literal(1), id: z.string().min(1).max(240), paperId: z.string().min(1).max(128), claimNodeId: z.string().min(1).max(240),
  canonicalClaimText: z.string().min(1).max(4_000), claimEvidence: boundedSourceEvidenceSchema,
  supportingEvidence: z.array(boundedSourceEvidenceSchema).max(32), reportedResults: z.array(boundedSourceEvidenceSchema).max(32),
  figures: z.array(boundedSourceEvidenceSchema).max(16), tables: z.array(boundedSourceEvidenceSchema).max(16), methods: z.array(boundedSourceEvidenceSchema).max(24),
  experiments: z.array(boundedSourceEvidenceSchema).max(24), datasetsAndBenchmarks: z.array(boundedSourceEvidenceSchema).max(24), comparators: z.array(boundedSourceEvidenceSchema).max(24),
  limitations: z.array(boundedSourceEvidenceSchema).max(24), citations: z.array(boundedSourceEvidenceSchema).max(24), relationships: z.array(graphEdgeSchema).max(100),
  supportStatus: z.enum(["direct support located", "partial/qualified support located", "multiple supporting sources located", "no direct supporting evidence located in indexed content", "evidence relationship uncertain", "generated candidate relationship"]),
  missingSources: z.array(z.string().max(500)).max(24), graph: boundedResearchGraphSchema,
}).strict();

export const investigateRequestSchema = z.object({ question: z.string().trim().min(1).max(600), packet: evidencePacketSchema }).strict();
export const tensionRequestSchema = z.object({ paperA: evidencePacketSchema, paperB: evidencePacketSchema }).strict().refine((value) => value.paperA.paperId !== value.paperB.paperId, "Tension inspection requires two different papers.");

const candidateRelationSchema = z.enum([
  "supports",
  "reports-result",
  "produced-by",
  "uses-method",
  "evaluated-on",
  "compares-against",
  "extends",
  "qualifies",
  "contradicts-candidate",
  "agrees-candidate",
  "generated-related",
]);

const evidenceGraphCandidateSchema = z.object({
  id: z.string().min(1).max(160),
  source: z.string().min(1).max(240),
  target: z.string().min(1).max(240),
  type: candidateRelationSchema,
  provenance: z.enum(["literal", "generated"]),
  evidenceIds: z.array(z.string().min(1)).min(1).max(12),
  reason: z.string().min(1).max(320),
}).strict();

export const evidenceGraphGenerationResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ready"),
    relationships: z.array(evidenceGraphCandidateSchema).max(20),
  }).strict(),
  z.object({
    status: z.literal("insufficient-evidence"),
    reason: z.string().min(1).max(320),
  }).strict(),
]);

const tensionCandidateSchema = z.object({
  id: z.string().min(1).max(160),
  relation: z.enum(["possible-tension", "differing-result", "qualification", "agreement", "extension"]),
  paperAId: z.string().min(1),
  paperBId: z.string().min(1),
  paperAEvidenceIds: z.array(z.string().min(1)).min(1).max(12),
  paperBEvidenceIds: z.array(z.string().min(1)).min(1).max(12),
  reason: z.string().min(1).max(320),
  provenance: z.enum(["literal", "generated"]),
}).strict();

export const tensionGenerationResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ready"), candidates: z.array(tensionCandidateSchema).max(12) }).strict(),
  z.object({ status: z.literal("insufficient-evidence"), reason: z.string().min(1).max(320) }).strict(),
]);

export const investigatorGenerationResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ready"),
    interpretation: z.object({
      generated: z.literal(true),
      text: z.string().min(1).max(900),
      evidenceIds: z.array(z.string().min(1)).min(1).max(16),
      qualifications: z.array(z.string().min(1).max(240)).max(8),
      uncertainty: z.string().min(1).max(320).nullable(),
    }).strict(),
  }).strict(),
  z.object({ status: z.literal("insufficient-evidence"), reason: z.string().min(1).max(320) }).strict(),
]);

export const evidenceGraphJsonSchema = zodToJsonSchema(evidenceGraphGenerationResponseSchema, {
  name: "EvidenceGraphGenerationResponse",
  $refStrategy: "none",
});
export const tensionJsonSchema = zodToJsonSchema(tensionGenerationResponseSchema, {
  name: "TensionGenerationResponse",
  $refStrategy: "none",
});
export const investigatorJsonSchema = zodToJsonSchema(investigatorGenerationResponseSchema, {
  name: "InvestigatorGenerationResponse",
  $refStrategy: "none",
});

export type EvidenceGraphGenerationResponse = z.infer<typeof evidenceGraphGenerationResponseSchema>;
export type TensionGenerationResponse = z.infer<typeof tensionGenerationResponseSchema>;

function graphEvidenceIds(graph: ResearchGraph): Set<string> {
  return new Set(graph.nodes.flatMap((node) => (node.evidence ?? (node.source ? [node.source] : [])).map(evidenceKey)));
}

/** Merge model suggestions without ever allowing inference to become literal source truth. */
export function validateGeneratedGraphResponse(value: unknown, graph: ResearchGraph): ResearchGraph {
  const parsed = evidenceGraphGenerationResponseSchema.parse(value);
  if (parsed.status === "insufficient-evidence") return graph;
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const evidenceIds = graphEvidenceIds(graph);
  let next = graph;
  for (const candidate of parsed.relationships) {
    if (!nodeIds.has(candidate.source) || !nodeIds.has(candidate.target)) continue;
    if (candidate.evidenceIds.some((id) => !evidenceIds.has(id))) continue;
    const sourceNode = graph.nodes.find((node) => node.id === candidate.source);
    const targetNode = graph.nodes.find((node) => node.id === candidate.target);
    const sourceIds = new Set((sourceNode?.evidence ?? (sourceNode?.source ? [sourceNode.source] : [])).map(evidenceKey));
    const targetIds = new Set((targetNode?.evidence ?? (targetNode?.source ? [targetNode.source] : [])).map(evidenceKey));
    if (!candidate.evidenceIds.some((id) => sourceIds.has(id)) || !candidate.evidenceIds.some((id) => targetIds.has(id))) continue;
    const alreadyLiteral = graph.edges.find((edge) =>
      edge.source === candidate.source &&
      edge.target === candidate.target &&
      edge.type === candidate.type &&
      edge.provenance === "literal",
    );
    if (alreadyLiteral) continue;
    const evidence = graph.nodes
      .flatMap((node) => node.evidence ?? (node.source ? [node.source] : []))
      .filter((item) => candidate.evidenceIds.includes(evidenceKey(item)));
    next = addEdge(next, {
      id: candidate.id,
      source: candidate.source,
      target: candidate.target,
      type: candidate.type as ResearchGraphEdgeType,
      provenance: "generated",
      evidence,
      reason: candidate.reason,
    });
  }
  return next;
}

function packetEvidenceIds(packet: EvidencePacket): Set<string> {
  return new Set([
    packet.claimEvidence,
    ...packet.supportingEvidence,
    ...packet.reportedResults,
    ...packet.figures,
    ...packet.tables,
    ...packet.methods,
    ...packet.experiments,
    ...packet.datasetsAndBenchmarks,
    ...packet.comparators,
    ...packet.limitations,
    ...packet.citations,
  ].map(evidenceKey));
}

export function validateTensionResponse(
  value: unknown,
  paperA: EvidencePacket,
  paperB: EvidencePacket,
): TensionCandidate[] {
  const parsed = tensionGenerationResponseSchema.parse(value);
  if (parsed.status === "insufficient-evidence") return [];
  const left = packetEvidenceIds(paperA);
  const right = packetEvidenceIds(paperB);
  return parsed.candidates.flatMap((candidate) => {
    if (candidate.paperAId !== paperA.paperId || candidate.paperBId !== paperB.paperId) return [];
    if (candidate.paperAEvidenceIds.some((id) => !left.has(id))) return [];
    if (candidate.paperBEvidenceIds.some((id) => !right.has(id))) return [];
    // Cross-paper semantic comparison is generated unless a separate literal source edge proves it.
    return [{ ...candidate, provenance: "generated" as const, generated: true }];
  });
}

export function validateInvestigatorResponse(value: unknown, packet: EvidencePacket): InvestigatorResult {
  const parsed = investigatorGenerationResponseSchema.parse(value);
  if (parsed.status === "insufficient-evidence") return parsed;
  const available = packetEvidenceIds(packet);
  if (parsed.interpretation.evidenceIds.some((id) => !available.has(id))) {
    return { status: "insufficient-evidence", reason: "The generated interpretation referenced evidence outside the verified packet." };
  }
  return parsed;
}

export function evidenceGraphModelInput(graph: ResearchGraph): object {
  return {
    nodes: graph.nodes.slice(0, 40).map((node) => ({
      id: node.id,
      type: node.type,
      label: node.label,
      evidenceIds: (node.evidence ?? (node.source ? [node.source] : [])).map(evidenceKey),
    })),
    literalRelationships: graph.edges.filter((edge) => edge.provenance === "literal").slice(0, 60).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      evidenceIds: edge.evidence.map(evidenceKey),
      reason: edge.reason,
    })),
  };
}

export function evidencePacketModelInput(packet: EvidencePacket): object {
  const source = (items: EvidencePacket["supportingEvidence"]) => items.slice(0, 16).map((item) => ({
    id: evidenceKey(item),
    kind: item.kind,
    page: item.page,
    text: item.text,
    assetId: item.assetId,
    refId: item.refId,
  }));
  return {
    id: packet.id,
    paperId: packet.paperId,
    canonicalClaimText: packet.canonicalClaimText,
    supportStatus: packet.supportStatus,
    claimEvidence: source([packet.claimEvidence]),
    supportingEvidence: source(packet.supportingEvidence),
    results: source(packet.reportedResults),
    methods: source(packet.methods),
    experiments: source(packet.experiments),
    datasetsAndBenchmarks: source(packet.datasetsAndBenchmarks),
    comparators: source(packet.comparators),
    limitations: source(packet.limitations),
    citations: source(packet.citations),
    missingSources: packet.missingSources,
  };
}
