/**
 * Shared evidence contracts — expansion doc §5.
 *
 * These are the objects that cross the Developer A / Developer B boundary. Neither side
 * imports the other's components; they exchange these. Keep this module small: §3 warns
 * that a "shared utilities" layer becomes a dumping ground.
 *
 * Two invariants this module exists to protect:
 *
 * 1. **One coordinate model.** `NormalizedBBox` is an alias of the generated schema's
 *    `BBox`, not a new type. Coordinates are converted exactly once, in
 *    `apps/api/extract/geometry.py` (§1.2); everything here passes them through
 *    untouched. Never re-derive or "helpfully" flip a box.
 * 2. **Evidence is a pointer, never a copy.** Every generated or organised artifact must
 *    be able to send the reader back to the page it came from, which is what makes
 *    "Show evidence →" possible (§6).
 */

import type { Asset, BBox, Manifest, Reference, Section } from "../manifest";

/** Normalized [x0, y0, x1, y1], top-left origin. Same type the manifest already uses. */
export type NormalizedBBox = BBox;

export interface PaperRef {
  /** The content hash (spec D1). Present for uploads too, unlike an arXiv id. */
  paperId: string;
  title: string;
  arxivId: string | null;
}

export interface SectionRef {
  sectionId: string;
  title: string;
  page: number;
  level: number;
}

export interface AssetRef {
  paperId: string;
  assetId: string;
  kind: Asset["kind"];
  label: string;
  page: number;
}

export interface CitationRef {
  paperId: string;
  refId: string;
  marker: string;
  arxivId: string | null;
  openable: boolean;
}

export interface MentionRef {
  paperId: string;
  /** null when the paper cites something we did not extract. Never render an affordance. */
  assetId: string | null;
  page: number;
  text: string;
  bbox?: NormalizedBBox;
}

export interface ConceptRef {
  conceptId: string;
  label: string;
}

export interface PassageRef {
  paperId: string;
  page: number;
  text: string;
  bbox?: NormalizedBBox;
  sectionId?: string;
}

/**
 * §5.2's union, plus `"algorithm"`.
 *
 * The extraction manifest produces algorithm assets, and the doc's six kinds have no way
 * to say so. Labelling an algorithm a "figure" would put a wrong label on primary source
 * material, which this product exists not to do. The addition is additive — nothing that
 * only emits the original six breaks — and TypeScript will flag any exhaustive switch
 * that needs updating rather than failing silently. Flagged for coordination.
 */
export type SourceEvidenceKind =
  | "passage"
  | "figure"
  | "table"
  | "algorithm"
  | "equation"
  | "caption"
  | "citation";

export interface SourceEvidence {
  paperId: string;
  page: number;
  kind: SourceEvidenceKind;

  text?: string;
  assetId?: string;
  /** Required for citation identity and structural validation. */
  refId?: string;
  bbox?: NormalizedBBox;

  sectionId?: string;
}

/** Bibliographic facts do not live on a PDF page and must not pretend that they do. */
export interface MetadataEvidence {
  paperId: string;
  kind: "metadata";
  field: "publication-date" | "title" | "authors";
  value: string;
  label?: string;
}

export type Evidence = SourceEvidence | MetadataEvidence;
export type EvidenceKind = Evidence["kind"];

export function canonicalPaperId(paper: Manifest | string): string {
  const value = typeof paper === "string" ? paper : paper.doc_id;
  return value.replace(/^sha256:/, "");
}

/** The digest, which is how every blob path and cache entry is keyed (spec D1). */
export function paperIdOf(manifest: Manifest): string {
  return canonicalPaperId(manifest);
}

/**
 * The only general construction path for source evidence. It canonicalizes paper identity
 * and passes normalized PDF geometry through untouched.
 */
export function createSourceEvidence(
  paper: Manifest | string,
  evidence: Omit<SourceEvidence, "paperId">,
): SourceEvidence {
  return { ...evidence, paperId: canonicalPaperId(paper) };
}

export function createMetadataEvidence(
  paper: Manifest | string,
  evidence: Omit<MetadataEvidence, "paperId" | "kind">,
): MetadataEvidence {
  return { ...evidence, paperId: canonicalPaperId(paper), kind: "metadata" };
}

export function paperRefOf(manifest: Manifest): PaperRef {
  return {
    paperId: paperIdOf(manifest),
    title: manifest.title,
    arxivId: manifest.source.arxiv_id,
  };
}

/**
 * Section ids are derived from manifest order.
 *
 * The manifest deliberately does not carry section ids, and titles are not unique (plenty
 * of papers have two "Results" headings), so position is the only stable handle. Same
 * manifest in, same id out.
 */
export function sectionIdFor(index: number): string {
  return `sec-${index}`;
}

export function sectionRefsOf(manifest: Manifest): SectionRef[] {
  return manifest.sections.map((section: Section, index: number) => ({
    sectionId: sectionIdFor(index),
    title: section.title,
    page: section.page,
    level: section.level,
  }));
}

export function assetRefOf(paperId: string, asset: Asset): AssetRef {
  return {
    paperId,
    assetId: asset.asset_id,
    kind: asset.kind,
    label: asset.label,
    page: asset.page,
  };
}

/** Evidence pointing at the asset's own region. */
export function assetEvidence(paperId: string, asset: Asset): SourceEvidence {
  return createSourceEvidence(paperId, {
    page: asset.page,
    kind: asset.kind,
    assetId: asset.asset_id,
    bbox: asset.bbox,
    text: asset.caption || undefined,
  });
}

/** Evidence pointing at the caption text, which is a different region from the asset. */
export function captionEvidence(paperId: string, asset: Asset): SourceEvidence {
  return createSourceEvidence(paperId, {
    page: asset.page,
    kind: "caption",
    assetId: asset.asset_id,
    bbox: asset.caption_bbox ?? undefined,
    text: asset.caption,
  });
}

export function citationEvidence(
  paperId: string,
  reference: Reference,
  page: number,
): SourceEvidence {
  return createSourceEvidence(paperId, {
    page,
    kind: "citation",
    refId: reference.ref_id,
    text: reference.title ?? reference.raw,
  });
}

export function passageEvidence(
  paperId: string,
  page: number,
  text: string,
  extra: { bbox?: NormalizedBBox; sectionId?: string } = {},
): SourceEvidence {
  return createSourceEvidence(paperId, { page, kind: "passage", text, ...extra });
}

/**
 * A stable identity for a piece of evidence, for deduplication and persistence.
 *
 * Includes the paper id because asset ids are only unique within a paper — every paper
 * ever written has a `fig-1`.
 */
function normalizedIdentityText(text: string | undefined): string {
  return (text ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function bboxIdentity(bbox: NormalizedBBox | undefined): string {
  return bbox?.map((value) => Number(value).toString()).join(",") ?? "";
}

function canonicalEvidenceIdentity(evidence: Evidence): string {
  const paperId = canonicalPaperId(evidence.paperId);
  if (evidence.kind === "metadata") {
    return JSON.stringify([paperId, "metadata", evidence.field, normalizedIdentityText(evidence.value)]);
  }
  switch (evidence.kind) {
    case "passage":
      return JSON.stringify([paperId, evidence.kind, evidence.page, bboxIdentity(evidence.bbox), normalizedIdentityText(evidence.text), evidence.sectionId ?? ""]);
    case "citation":
      return JSON.stringify([paperId, evidence.kind, evidence.page, evidence.refId ?? "", bboxIdentity(evidence.bbox)]);
    case "caption":
      return JSON.stringify([paperId, evidence.kind, evidence.assetId ?? "", normalizedIdentityText(evidence.text)]);
    case "figure":
    case "table":
    case "algorithm":
      return JSON.stringify([paperId, "asset", evidence.assetId ?? ""]);
    case "equation":
      return JSON.stringify([paperId, evidence.kind, evidence.page, evidence.assetId ?? "", bboxIdentity(evidence.bbox), normalizedIdentityText(evidence.text)]);
  }
}

/** Stable, synchronous paired FNV-1a identity for URLs, persistence, and dedupe. */
function hashIdentity(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ (code + index), 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

export function evidenceKey(evidence: Evidence): string {
  return `evidence-${hashIdentity(canonicalEvidenceIdentity(evidence))}`;
}

export function isSameEvidence(a: Evidence, b: Evidence): boolean {
  return evidenceKey(a) === evidenceKey(b);
}

export function isSourceEvidence(evidence: Evidence): evidence is SourceEvidence {
  return evidence.kind !== "metadata";
}
