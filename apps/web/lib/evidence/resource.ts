import type { ChallengeEvidence } from "../challenges/contracts";
import type { PaperLearningIndex } from "../learning/paper-index";
import type { PassageRef } from "../research-context/types";
import { sectionRefsOf, type SourceEvidence, type SourceEvidenceKind } from "./source";

export interface ResolvedEvidence {
  status: "resolved";
  evidence: ChallengeEvidence;
  source: SourceEvidence;
  paper: PaperLearningIndex["manifest"];
  section?: { id: string; title: string };
  passage?: PassageRef;
  asset?: PaperLearningIndex["manifest"]["assets"][number];
  label: string;
  excerpt?: string;
}

export interface UnresolvedEvidence {
  status: "unresolved";
  evidence: ChallengeEvidence;
  source: SourceEvidence;
  reason: string;
}

export type EvidenceResolution = ResolvedEvidence | UnresolvedEvidence;

export interface EvidenceResolver {
  resolve(evidence: ChallengeEvidence): EvidenceResolution;
}

function validBBox(bbox: SourceEvidence["bbox"]): boolean {
  return Boolean(
    bbox &&
      bbox.every((value) => Number.isFinite(value) && value >= 0 && value <= 1) &&
      bbox[0] <= bbox[2] &&
      bbox[1] <= bbox[3],
  );
}

function sameBBox(a: SourceEvidence["bbox"], b: SourceEvidence["bbox"]): boolean {
  return Boolean(a && b && a.length === b.length && a.every((value, index) => value === b[index]));
}

function requiredAssetKind(kind: SourceEvidenceKind): string | null {
  return ["figure", "table", "algorithm", "equation"].includes(kind) ? kind : null;
}

function unresolved(evidence: ChallengeEvidence, reason: string): UnresolvedEvidence {
  return { status: "unresolved", evidence, source: evidence.source, reason };
}

function resolved(
  index: PaperLearningIndex,
  evidence: ChallengeEvidence,
  details: Omit<ResolvedEvidence, "status" | "evidence" | "source" | "paper" | "section">,
): ResolvedEvidence {
  const section = evidence.source.sectionId
    ? sectionRefsOf(index.manifest).find((candidate) => candidate.sectionId === evidence.source.sectionId)
    : undefined;
  return {
    status: "resolved",
    evidence,
    source: evidence.source,
    paper: index.manifest,
    ...(section ? { section: { id: section.sectionId, title: section.title } } : {}),
    ...details,
  };
}

/**
 * Resolves canonical source evidence plus Dev A's local resource handle against loaded,
 * deterministic paper data. Missing handles never fall back to a text guess for scoring.
 */
export function createEvidenceResolver(indices: readonly PaperLearningIndex[]): EvidenceResolver {
  const indexByPaper = new Map(indices.map((index) => [index.paperId, index]));
  return {
    resolve(evidence) {
      const source = evidence.source;
      const index = indexByPaper.get(source.paperId);
      if (!index) return unresolved(evidence, "The referenced paper is not loaded.");
      if (!Number.isInteger(source.page) || source.page < 0 || source.page >= index.manifest.page_count) {
        return unresolved(evidence, "The referenced page does not exist.");
      }
      if (source.bbox && !validBBox(source.bbox)) {
        return unresolved(evidence, "The referenced region is invalid.");
      }
      if (
        source.sectionId &&
        !sectionRefsOf(index.manifest).some((section) => section.sectionId === source.sectionId)
      ) {
        return unresolved(evidence, "The referenced section does not exist.");
      }

      if (source.kind === "passage") {
        if (evidence.resource?.kind !== "passage") {
          return unresolved(evidence, "Scored passage evidence requires a passage resource handle.");
        }
        const passage = index.passageById.get(evidence.resource.resourceId);
        if (!passage || passage.page !== source.page || source.text !== passage.text) {
          return unresolved(evidence, "The referenced passage does not exist on this page.");
        }
        if (source.bbox && !sameBBox(source.bbox, passage.bbox)) {
          return unresolved(evidence, "The referenced passage region no longer matches the paper.");
        }
        return resolved(index, evidence, { passage, label: "Passage", excerpt: passage.text });
      }

      if (source.kind === "citation") {
        if (evidence.resource?.kind !== "citation") {
          return unresolved(evidence, "Scored citation evidence requires a citation resource handle.");
        }
        const reference = index.manifest.references.find(
          (item) => item.ref_id === evidence.resource?.resourceId,
        );
        const markerOnPage = index.citationsByPage
          .get(source.page)
          ?.some((citation) => citation.refIds.includes(evidence.resource?.resourceId ?? ""));
        if (!reference || !markerOnPage) {
          return unresolved(evidence, "The referenced citation marker does not exist on this page.");
        }
        return resolved(index, evidence, { label: "Citation", excerpt: reference.title ?? reference.raw });
      }

      if (source.kind === "caption" || requiredAssetKind(source.kind)) {
        if (!source.assetId) return unresolved(evidence, "Asset evidence requires an asset id.");
        const asset = index.manifest.assets.find((item) => item.asset_id === source.assetId);
        if (!asset || asset.page !== source.page) {
          return unresolved(evidence, "The referenced asset does not exist on this page.");
        }
        const expectedKind = requiredAssetKind(source.kind);
        if (expectedKind && asset.kind !== expectedKind) {
          return unresolved(evidence, "The evidence kind does not match the referenced asset.");
        }
        const expectedBBox = source.kind === "caption" ? asset.caption_bbox : asset.bbox;
        if (source.bbox && !sameBBox(source.bbox, expectedBBox ?? undefined)) {
          return unresolved(evidence, "The referenced asset region no longer matches the paper.");
        }
        return resolved(index, evidence, {
          asset,
          label: source.kind === "caption" ? `${asset.label} caption` : asset.label,
          excerpt: source.kind === "caption" ? asset.caption : source.text ?? asset.caption,
        });
      }

      return unresolved(evidence, "The evidence kind cannot be resolved.");
    },
  };
}
