import { challengeEvidence, type ChallengeEvidence, type ChallengeDifficulty } from "../challenges/contracts";
import type { EvidenceResolver } from "../evidence/resource";
import {
  assetEvidence,
  captionEvidence,
  citationEvidence,
  evidenceKey,
  isSourceEvidence,
  passageEvidence,
  type SourceEvidence,
} from "../evidence/source";
import { boundedGraph, buildEvidenceGraph, claimForSelection } from "../evidence-graph/evidence-graph";
import { buildLearningObjects } from "../learning/objects";
import type { PaperLearningIndex } from "../learning/paper-index";
import { buildConceptThread } from "../learning/threads";
import type { ResearchContext } from "../research-context/types";
import {
  VisualGenerationRequestSchema,
  type VisualGenerationRequest,
} from "./contracts";

export interface VisualGenerationOptions {
  intent: VisualGenerationRequest["intent"];
  learningMode: VisualGenerationRequest["learningMode"];
  difficulty?: ChallengeDifficulty;
  learningObjective?: string;
  existingVisualLearningSpec?: VisualGenerationRequest["existingVisualLearningSpec"];
}

type SourceChallengeEvidence = ChallengeEvidence & { source: SourceEvidence };

function resolvedOnly(items: ChallengeEvidence[], resolver: EvidenceResolver): SourceChallengeEvidence[] {
  return items.filter((item): item is SourceChallengeEvidence => isSourceEvidence(item.source) && resolver.resolve(item).status === "resolved");
}

function selectedConceptLabel(context: ResearchContext, labels: readonly string[]): string | undefined {
  const selected = context.selection?.text.toLocaleLowerCase() ?? "";
  return labels.find((label) => selected.includes(label.toLocaleLowerCase())) ?? labels[0];
}

/**
 * Creates the sole model input shape from already-resolved client research data. The
 * window is deliberately bounded; generated routes never receive an unstructured paper.
 */
export function createVisualGenerationRequest(
  context: ResearchContext,
  index: PaperLearningIndex,
  resolver: EvidenceResolver,
  options: VisualGenerationOptions,
): VisualGenerationRequest | null {
  if (!context.selection?.text.trim()) return null;

  const passageSources = context.surroundingPassages.slice(0, 7).map((passage) => challengeEvidence(
    passageEvidence(index.paperId, passage.page, passage.text, {
      ...(passage.bbox ? { bbox: passage.bbox } : {}),
      ...(passage.sectionId ? { sectionId: passage.sectionId } : {}),
    }),
    passage.id === context.sourceWindow.selected?.id
      ? "This is the learner-selected source passage."
      : "This is bounded surrounding source context.",
    { kind: "passage", resourceId: passage.id },
  ));

  const assetSources = context.nearbyAssets.flatMap((nearby) => {
    const asset = index.manifest.assets.find((candidate) => candidate.asset_id === nearby.assetId);
    if (!asset) return [];
    return [
      challengeEvidence(assetEvidence(index.paperId, asset), `This is the verified original ${asset.label}.`),
      ...(asset.caption ? [challengeEvidence(captionEvidence(index.paperId, asset), `This is the verified caption for ${asset.label}.`)] : []),
    ];
  });

  const citationSources = context.citations.flatMap((marker) => marker.refIds.slice(0, 4).flatMap((refId) => {
    const reference = index.manifest.references.find((candidate) => candidate.ref_id === refId);
    if (!reference) return [];
    return [challengeEvidence(
      citationEvidence(index.paperId, reference, marker.page),
      "This citation marker and reference are observed in the paper.",
      { kind: "citation", resourceId: refId },
    )];
  }));

  const evidence = resolvedOnly([...passageSources, ...assetSources, ...citationSources], resolver);
  const uniqueEvidence = [...new Map(evidence.map((item) => [item.id, item])).values()];
  if (!uniqueEvidence.length) return null;

  const objects = buildLearningObjects(index);
  const conceptObjects = objects.filter((object) => object.kind === "concept");
  const selectedConcept = selectedConceptLabel(context, conceptObjects.map((object) => object.label));
  const thread = selectedConcept ? buildConceptThread({
    paperId: index.paperId,
    concept: selectedConcept,
    pages: index.pages,
    sections: index.manifest.sections,
    assets: index.manifest.assets,
  }) : null;
  const evidenceIds = new Set(uniqueEvidence.map((item) => item.id));
  const evidenceGraph = buildEvidenceGraph(index);
  const selectedClaim = claimForSelection(evidenceGraph, context.selection.text, context.selection.page);
  const localEvidenceGraph = selectedClaim ? boundedGraph(evidenceGraph, selectedClaim.id, 24) : null;
  const graphNodeTypes = new Set(["claim", "evidence", "passage", "figure", "table", "equation", "method", "experiment", "result", "dataset", "benchmark", "citation", "concept", "limitation"]);
  const graphNodes = localEvidenceGraph?.nodes.flatMap((node) => {
    if (!graphNodeTypes.has(node.type)) return [];
    const ids = (node.evidence ?? (node.source ? [node.source] : [])).map(evidenceKey).filter((id) => evidenceIds.has(id));
    return ids.length ? [{ id: node.id, type: node.type as "claim", label: node.label, evidenceIds: ids }] : [];
  }) ?? [];
  const graphNodeIds = new Set(graphNodes.map((node) => node.id));
  const graphEdges = localEvidenceGraph?.edges.flatMap((edge) => {
    const ids = edge.evidence.map(evidenceKey).filter((id) => evidenceIds.has(id));
    if (!graphNodeIds.has(edge.source) || !graphNodeIds.has(edge.target) || !ids.length) return [];
    return [{ id: edge.id, source: edge.source, target: edge.target, type: edge.type as "supports", provenance: edge.provenance, evidenceIds: ids, reason: edge.reason ?? "Verified graph relationship" }];
  }) ?? [];

  const request: VisualGenerationRequest = {
    paper: {
      paperId: index.paperId,
      title: index.manifest.title || "Untitled paper",
      arxivId: index.manifest.source.arxiv_id,
    },
    intent: options.intent,
    learningObjective: options.learningObjective ?? `Understand ${selectedConcept ?? "the selected source passage"} by manipulating its verified structure.`,
    difficulty: options.difficulty ?? "medium",
    learningMode: options.learningMode,
    selection: { text: context.selection.text, page: context.selection.page },
    ...(context.section ? { section: { id: context.section.sectionId, title: context.section.title, page: context.section.page } } : {}),
    sourceWindow: context.surroundingPassages.slice(0, 7).map((passage) => ({
      id: passage.id,
      page: passage.page,
      text: passage.text,
      ...(passage.sectionId ? { sectionId: passage.sectionId } : {}),
    })),
    concepts: conceptObjects.slice(0, 16).map((object) => ({ id: object.id, label: object.label })),
    ...(thread && thread.occurrences.length > 1 ? {
      conceptThread: {
        concept: thread.concept.label,
        occurrences: thread.occurrences.slice(0, 12).flatMap((occurrence) => {
          const match = uniqueEvidence.find((item) => item.source.kind === "passage" && item.source.text === occurrence.passage.text);
          return match ? [{ id: occurrence.id, page: occurrence.page, text: occurrence.passage.text, evidenceId: match.id }] : [];
        }),
      },
    } : {}),
    assets: context.nearbyAssets.flatMap((nearby) => {
      const asset = index.manifest.assets.find((candidate) => candidate.asset_id === nearby.assetId);
      if (!asset) return [];
      const ids = uniqueEvidence.filter((item) => item.source.assetId === asset.asset_id).map((item) => item.id);
      if (!ids.length) return [];
      return [{
        id: asset.asset_id,
        kind: asset.kind,
        label: asset.label,
        page: asset.page,
        caption: asset.caption,
        evidenceIds: ids,
        imageUrl: asset.image_url,
      }];
    }),
    citations: context.citations.slice(0, 12).map((citation) => ({ refIds: citation.refIds, text: citation.text, page: citation.page })),
    sourceEvidence: uniqueEvidence.map((item) => ({ id: item.id, reason: item.reason, source: item.source })),
    ...(selectedClaim && graphNodes.some((node) => node.id === selectedClaim.id) ? { evidenceGraph: { rootClaimId: selectedClaim.id, nodes: graphNodes, edges: graphEdges } } : {}),
    ...(options.existingVisualLearningSpec ? { existingVisualLearningSpec: options.existingVisualLearningSpec } : {}),
  };

  // Avoid carrying a thread shell whose occurrences could not be tied to supplied evidence.
  if (request.conceptThread?.occurrences.length === 0) delete request.conceptThread;
  for (const item of request.assets) item.evidenceIds = item.evidenceIds.filter((id) => evidenceIds.has(id));
  return VisualGenerationRequestSchema.parse(request);
}
