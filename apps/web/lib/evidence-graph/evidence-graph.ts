import { challengeEvidence } from "../challenges/contracts";
import { createEvidenceResolver } from "../evidence/resource";
import {
  assetEvidence,
  citationEvidence,
  evidenceKey,
  passageEvidence,
  type SourceEvidence,
} from "../evidence/source";
import {
  addEdge,
  addNode,
  emptyGraph,
  type ResearchGraph,
  type ResearchGraphEdge,
  type ResearchGraphNode,
} from "../explore/graph";
import { buildLearningObjects } from "../learning/objects";
import type { PaperLearningIndex } from "../learning/paper-index";
import type { ClaimObject, ExperimentObject } from "../learning/types";
import type { EvidencePacket } from "./types";

export const CLAIM_PATTERN = /\b(?:(?:we|(?:(?:our|the)\s+)?results?)\s+(?:show|find|observe|demonstrate|indicate|conclude)|our\s+(?:method|approach|model)\s+(?:improves?|outperforms?)|we\s+outperform)\b/i;
const QUALIFICATION_PATTERN = /\b(?:however|although|limited\s+to|limitation|only\s+under|does\s+not|future\s+work|we\s+cannot)\b/i;
const DATASET_PATTERNS = [
  /\b(?:evaluated?|trained|tested)\s+on\s+(?:the\s+)?([A-Z][A-Za-z0-9._-]{2,40})(?:\s+(?:dataset|benchmark))?/,
  /\b([A-Z][A-Za-z0-9._-]{2,40})\s+(?:dataset|benchmark)\b/,
];
const COMPARATOR_PATTERN = /\b(?:compare[ds]?|comparison)\s+(?:with|against|to)\s+([A-Z][A-Za-z0-9._ -]{1,60}?)(?:[.,;]|\s+(?:on|using|and)\b)/;

function concise(text: string, max = 120): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

function overlaps(a: readonly number[] | null | undefined, b: readonly number[] | null | undefined): boolean {
  if (!a || !b) return true;
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function sourceNode(
  id: string,
  type: ResearchGraphNode["type"],
  label: string,
  evidence: SourceEvidence[],
  metadata: Record<string, unknown> = {},
): ResearchGraphNode {
  return {
    id,
    type,
    label: concise(label),
    source: evidence[0],
    evidence,
    provenance: "literal",
    metadata,
  };
}

function objectClaim(objects: ReturnType<typeof buildLearningObjects>, id: string): ClaimObject | undefined {
  return objects.find((object): object is ClaimObject => object.kind === "claim" && object.id === id);
}

function experimentObjects(objects: ReturnType<typeof buildLearningObjects>): ExperimentObject[] {
  return objects.filter((object): object is ExperimentObject => object.kind === "experiment");
}

function datasetName(text: string): string | null {
  for (const pattern of DATASET_PATTERNS) {
    const match = text.match(pattern)?.[1]?.trim();
    if (match && !/^(?:the|this|our|same|training|test|validation)$/i.test(match)) return match;
  }
  return null;
}

export function isConservativeClaim(text: string): boolean {
  return CLAIM_PATTERN.test(text);
}

/** Builds only literal, locally provable relationships. Model candidates are merged later. */
export function buildEvidenceGraph(index: PaperLearningIndex): ResearchGraph {
  const objects = buildLearningObjects(index);
  const paperNodeId = `paper:${index.paperId}`;
  let graph = addNode(emptyGraph(), {
    id: paperNodeId,
    type: "paper",
    label: index.manifest.title || "Untitled paper",
    provenance: "literal",
    metadata: { paperId: index.paperId, arxivId: index.manifest.source.arxiv_id, loaded: true },
  });

  for (const claim of objects.filter((object): object is ClaimObject => object.kind === "claim")) {
    graph = addNode(graph, sourceNode(claim.id, "claim", claim.claimText, claim.evidence, { originalText: claim.claimText, confidence: claim.confidence }));
    graph = addEdge(graph, { source: paperNodeId, target: claim.id, type: "contains", evidence: claim.evidence, reason: "This exact claim passage occurs in the paper." });
  }

  for (const asset of index.manifest.assets) {
    const id = `asset:${index.paperId}:${asset.asset_id}`;
    const evidence = assetEvidence(index.paperId, asset);
    graph = addNode(graph, sourceNode(id, asset.kind, asset.label, [evidence], { assetId: asset.asset_id, caption: asset.caption, page: asset.page }));
    graph = addEdge(graph, { source: paperNodeId, target: id, type: "contains", evidence, reason: `The manifest contains ${asset.label}.` });
  }

  for (const claimNode of graph.nodes.filter((node) => node.type === "claim")) {
    const claim = objectClaim(objects, claimNode.id);
    const claimSource = claim?.evidence[0];
    if (!claim || !claimSource) continue;
    const passage = index.passages.find((item) => item.page === claimSource.page && item.text === claimSource.text);
    const mentions = index.pages[claimSource.page]?.mentions ?? [];
    const literalAssetIds = new Set<string>();
    for (const asset of index.manifest.assets) {
      if (claim.claimText.toLocaleLowerCase().includes(asset.label.toLocaleLowerCase())) literalAssetIds.add(asset.asset_id);
    }
    for (const mention of mentions) {
      if (mention.assetId && passage && overlaps(mention.rect, passage.bbox)) literalAssetIds.add(mention.assetId);
    }
    for (const assetId of literalAssetIds) {
      const asset = index.manifest.assets.find((item) => item.asset_id === assetId);
      const target = `asset:${index.paperId}:${assetId}`;
      if (!asset) continue;
      graph = addEdge(graph, {
        source: claim.id,
        target,
        type: "supports",
        evidence: [claimSource, assetEvidence(index.paperId, asset)],
        reason: `The canonical claim text directly references ${asset.label}.`,
      });
    }
  }

  for (const experiment of experimentObjects(objects)) {
    const experimentNode = sourceNode(experiment.id, "experiment", experiment.label, experiment.evidence, { confidence: experiment.confidence });
    const methodId = `${experiment.id}:method`;
    const resultId = `${experiment.id}:result`;
    graph = addNode(graph, experimentNode);
    graph = addNode(graph, sourceNode(methodId, "method", concise(experiment.methodEvidence[0]?.text ?? "Method"), experiment.methodEvidence));
    graph = addNode(graph, sourceNode(resultId, "result", concise(experiment.resultEvidence[0]?.text ?? "Reported result"), experiment.resultEvidence));
    graph = addEdge(graph, { source: paperNodeId, target: experiment.id, type: "contains", evidence: experiment.evidence, reason: "This bounded experiment is assembled from explicit method and result passages." });
    graph = addEdge(graph, { source: experiment.id, target: methodId, type: "uses-method", evidence: experiment.methodEvidence, reason: "This passage is the indexed method context for the experiment." });
    graph = addEdge(graph, { source: experiment.id, target: resultId, type: "reports-result", evidence: experiment.resultEvidence, reason: "This passage is the indexed reported-result context." });

    const methodText = experiment.methodEvidence.map((item) => item.text ?? "").join(" ");
    const dataset = datasetName(methodText);
    if (dataset) {
      const datasetId = `dataset:${index.paperId}:${dataset.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      graph = addNode(graph, sourceNode(datasetId, "dataset", dataset, experiment.methodEvidence, { exactSourceName: dataset }));
      graph = addEdge(graph, { source: experiment.id, target: datasetId, type: "evaluated-on", evidence: experiment.methodEvidence, reason: `The method/setup passage explicitly names ${dataset}.` });
    }
    const comparator = methodText.match(COMPARATOR_PATTERN)?.[1]?.trim();
    if (comparator) {
      const comparatorId = `method:${index.paperId}:comparator:${comparator.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      graph = addNode(graph, sourceNode(comparatorId, "method", comparator, experiment.methodEvidence, { comparator: true }));
      graph = addEdge(graph, { source: experiment.id, target: comparatorId, type: "compares-against", evidence: experiment.methodEvidence, reason: `The setup passage explicitly identifies ${comparator} as a comparator.` });
    }

    for (const claim of objects.filter((object): object is ClaimObject => object.kind === "claim")) {
      const sameResult = claim.evidence.some((source) => experiment.resultEvidence.some((result) => evidenceKey(source) === evidenceKey(result)));
      if (sameResult) graph = addEdge(graph, { source: claim.id, target: resultId, type: "supports", evidence: experiment.resultEvidence, reason: "The canonical claim and reported result share the same exact source passage." });
    }
  }

  for (const passage of index.passages.filter((item) => QUALIFICATION_PATTERN.test(item.text))) {
    const evidence = passageEvidence(index.paperId, passage.page, passage.text, { ...(passage.bbox ? { bbox: passage.bbox } : {}), ...(passage.sectionId ? { sectionId: passage.sectionId } : {}) });
    const limitationId = `${passage.id}:limitation`;
    graph = addNode(graph, sourceNode(limitationId, "limitation", passage.text, [evidence]));
    graph = addEdge(graph, { source: paperNodeId, target: limitationId, type: "contains", evidence, reason: "This passage contains explicit qualifying language." });
    for (const claim of graph.nodes.filter((node) => node.type === "claim" && node.source && Math.abs(node.source.page - passage.page) <= 1 && node.source.sectionId === passage.sectionId)) {
      graph = addEdge(graph, { source: claim.id, target: limitationId, type: "qualifies", evidence: [claim.source as SourceEvidence, evidence], reason: "The qualification occurs in the same indexed section near this claim." });
    }
  }

  const seenCitations = new Set<string>();
  index.citationsByPage.forEach((citations, page) => {
    for (const marker of citations) {
      for (const refId of marker.refIds) {
        const key = `${page}:${refId}`;
        if (seenCitations.has(key)) continue;
        seenCitations.add(key);
        const reference = index.manifest.references.find((item) => item.ref_id === refId);
        if (!reference) continue;
        const evidence = { ...citationEvidence(index.paperId, reference, page), ...(marker.rect ? { bbox: marker.rect } : {}) };
        const citationId = `citation:${index.paperId}:${refId}`;
        graph = addNode(graph, sourceNode(citationId, "citation", reference.title ?? reference.raw, [evidence], { refId, arxivId: reference.arxiv_id, openable: reference.openable }));
        graph = addEdge(graph, { source: paperNodeId, target: citationId, type: "cites", evidence, reason: "This literal citation marker resolves to the extracted reference." });
        for (const claim of graph.nodes.filter((node) => node.type === "claim" && node.source?.page === page)) {
          const directMarker = claim.source?.text?.includes(marker.text) || (claim.source?.bbox && marker.rect && overlaps(claim.source.bbox, marker.rect));
          if (directMarker && claim.source) graph = addEdge(graph, { source: claim.id, target: citationId, type: "cites", evidence: [claim.source, evidence], reason: "The canonical claim passage contains this literal citation marker." });
        }
      }
    }
  });

  for (const concept of objects.filter((object) => object.kind === "concept")) {
    graph = addNode(graph, sourceNode(concept.id, "concept", concept.label, concept.evidence, { aliases: concept.aliases }));
    graph = addEdge(graph, { source: paperNodeId, target: concept.id, type: "contains", evidence: concept.evidence, reason: "This concept comes from an explicit in-paper definition." });
  }

  return graph;
}

export function claimForSelection(graph: ResearchGraph, text: string, page: number): ResearchGraphNode | null {
  const selected = text.replace(/\s+/g, " ").trim();
  return graph.nodes.find((node) => node.type === "claim" && node.source?.page === page && (
    node.metadata.originalText === selected ||
    String(node.metadata.originalText ?? "").includes(selected) ||
    selected.includes(String(node.metadata.originalText ?? ""))
  )) ?? null;
}

export function boundedGraph(graph: ResearchGraph, rootId: string, maxNodes = 18): ResearchGraph {
  if (!graph.nodes.some((node) => node.id === rootId)) return emptyGraph();
  const included = new Set([rootId]);
  const queue = [rootId];
  while (queue.length && included.size < maxNodes) {
    const current = queue.shift() as string;
    for (const edge of graph.edges.filter((item) => item.source === current || item.target === current)) {
      const other = edge.source === current ? edge.target : edge.source;
      if (!included.has(other)) { included.add(other); queue.push(other); }
      if (included.size >= maxNodes) break;
    }
  }
  return {
    nodes: graph.nodes.filter((node) => included.has(node.id)),
    edges: graph.edges.filter((edge) => included.has(edge.source) && included.has(edge.target)),
  };
}

export function validateGraphEvidence(graph: ResearchGraph, index: PaperLearningIndex): { valid: boolean; errors: string[] } {
  const resolver = createEvidenceResolver([index]);
  const errors: string[] = [];
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  if (nodeIds.size !== graph.nodes.length) errors.push("Graph node ids must be unique.");
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) errors.push(`Edge ${edge.id} has a missing endpoint.`);
    if (edge.provenance === "literal" && edge.evidence.length === 0) errors.push(`Literal edge ${edge.id} has no source evidence.`);
    if (edge.provenance === "generated" && !edge.generated) errors.push(`Generated edge ${edge.id} lost its generated marker.`);
    for (const source of edge.evidence) {
      let resource: Parameters<typeof challengeEvidence>[2];
      if (source.kind === "passage") {
        const passage = index.passages.find((item) => item.page === source.page && item.text === source.text);
        if (passage) resource = { kind: "passage", resourceId: passage.id };
      } else if (source.kind === "citation" && source.refId) resource = { kind: "citation", resourceId: source.refId };
      if (resolver.resolve(challengeEvidence(source, edge.reason ?? "Graph relationship evidence", resource)).status === "unresolved") {
        errors.push(`Edge ${edge.id} contains unresolved source evidence.`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

function uniqueEvidence(items: SourceEvidence[]): SourceEvidence[] {
  return [...new Map(items.map((item) => [evidenceKey(item), item])).values()];
}

export function buildEvidencePacket(graph: ResearchGraph, claimNodeId: string, index: PaperLearningIndex): EvidencePacket | null {
  const claim = graph.nodes.find((node) => node.id === claimNodeId && node.type === "claim");
  if (!claim?.source) return null;
  const local = boundedGraph(graph, claimNodeId, 24);
  const relationships = local.edges.filter((edge) => edge.source === claimNodeId || local.nodes.some((node) => node.id === edge.source && node.type === "experiment"));
  const nodesFor = (types: ResearchGraphNode["type"][]) => local.nodes.filter((node) => types.includes(node.type)).flatMap((node) => node.evidence ?? (node.source ? [node.source] : []));
  const supportEdges = local.edges.filter((edge) => edge.source === claimNodeId && edge.type === "supports");
  const supportingEvidence = uniqueEvidence(supportEdges.flatMap((edge) => edge.evidence)).filter((source) => evidenceKey(source) !== evidenceKey(claim.source as SourceEvidence));
  const limitations = uniqueEvidence(nodesFor(["limitation"]));
  const directCount = supportEdges.filter((edge) => edge.provenance === "literal").length;
  const status = directCount > 1
    ? "multiple supporting sources located"
    : directCount === 1 && limitations.length
      ? "partial/qualified support located"
      : directCount === 1
        ? "direct support located"
        : supportEdges.some((edge) => edge.provenance === "generated")
          ? "generated candidate relationship"
          : "no direct supporting evidence located in indexed content";
  const validation = validateGraphEvidence(local, index);
  return {
    schemaVersion: 1,
    id: `packet:${claimNodeId}`,
    paperId: index.paperId,
    claimNodeId,
    canonicalClaimText: String(claim.metadata.originalText ?? claim.label),
    claimEvidence: claim.source,
    supportingEvidence,
    reportedResults: uniqueEvidence(nodesFor(["result"])),
    figures: uniqueEvidence(nodesFor(["figure"])),
    tables: uniqueEvidence(nodesFor(["table"])),
    methods: uniqueEvidence(nodesFor(["method"])),
    experiments: uniqueEvidence(nodesFor(["experiment"])),
    datasetsAndBenchmarks: uniqueEvidence(nodesFor(["dataset", "benchmark"])),
    comparators: uniqueEvidence(local.nodes.filter((node) => node.metadata.comparator).flatMap((node) => node.evidence ?? [])),
    limitations,
    citations: uniqueEvidence(nodesFor(["citation"])),
    relationships,
    supportStatus: status,
    missingSources: validation.valid ? [] : validation.errors,
    graph: local,
  };
}
