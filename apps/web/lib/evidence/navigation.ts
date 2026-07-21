import {
  canonicalPaperId,
  evidenceKey,
  isSourceEvidence,
  type Evidence,
  type NormalizedBBox,
  type SourceEvidence,
} from "./source";

export interface EvidenceTarget {
  paperId: string;
  page: number;
  assetId?: string;
  bbox?: NormalizedBBox;
}

export interface EvidenceDeepLink extends EvidenceTarget {
  evidenceId?: string;
}

export function evidenceTarget(
  evidence: SourceEvidence,
  paperPageCounts: Record<string, number>,
): EvidenceTarget | null {
  const paperId = canonicalPaperId(evidence.paperId);
  const pageCount = paperPageCounts[paperId];
  if (evidence.page < 0 || pageCount === undefined || evidence.page >= pageCount) return null;
  return {
    paperId,
    page: evidence.page,
    ...(evidence.assetId ? { assetId: evidence.assetId } : {}),
    ...(evidence.bbox ? { bbox: evidence.bbox } : {}),
  };
}

export function sourceEvidenceHref(evidence: Evidence): string {
  const paperId = encodeURIComponent(canonicalPaperId(evidence.paperId));
  if (!isSourceEvidence(evidence)) return `/read/${paperId}`;
  const params = new URLSearchParams({ page: String(evidence.page), evidence: evidenceKey(evidence) });
  if (evidence.assetId) params.set("asset", evidence.assetId);
  if (evidence.bbox) params.set("bbox", evidence.bbox.join(","));
  return `/read/${paperId}#${params.toString()}`;
}

export function paperHref(paperId: string): string {
  return `/read/${encodeURIComponent(canonicalPaperId(paperId))}`;
}

/** Shared page-only fallback for observed locations that do not carry a precise bbox. */
export function sourcePageHref(paperId: string, page: number): string {
  const base = paperHref(paperId);
  return Number.isInteger(page) && page >= 0 ? `${base}#page=${page}` : base;
}

export function parseEvidenceHash(hash: string, pageCount?: number): EvidenceDeepLink | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const rawPage = params.get("page");
  if (rawPage === null || !/^\d+$/.test(rawPage)) return null;
  const page = Number(rawPage);
  if (!Number.isInteger(page) || page < 0 || (pageCount !== undefined && page >= pageCount)) return null;
  const bboxText = params.get("bbox");
  let bbox: NormalizedBBox | undefined;
  if (bboxText) {
    const values = bboxText.split(",").map(Number);
    if (
      values.length === 4 &&
      values.every((value) => Number.isFinite(value) && value >= 0 && value <= 1) &&
      values[0] <= values[2] &&
      values[1] <= values[3]
    ) bbox = values as NormalizedBBox;
  }
  return {
    paperId: "",
    page,
    ...(params.get("asset") ? { assetId: params.get("asset") as string } : {}),
    ...(bbox ? { bbox } : {}),
    ...(params.get("evidence") ? { evidenceId: params.get("evidence") as string } : {}),
  };
}

interface NavigateOptions {
  currentPaperId: string;
  currentPageCount: number;
  onCurrent(target: EvidenceTarget, evidence: SourceEvidence): void;
  onCrossPaper?(href: string, evidence: Evidence): void;
}

/** One navigation decision for Reader, learning, exploration, and workspace surfaces. */
export function navigateToEvidence(evidence: Evidence, options: NavigateOptions): boolean {
  if (isSourceEvidence(evidence) && canonicalPaperId(evidence.paperId) === canonicalPaperId(options.currentPaperId)) {
    const target = evidenceTarget(evidence, { [canonicalPaperId(options.currentPaperId)]: options.currentPageCount });
    if (!target) return false;
    options.onCurrent(target, evidence);
    return true;
  }
  const href = sourceEvidenceHref(evidence);
  if (options.onCrossPaper) options.onCrossPaper(href, evidence);
  else if (typeof window !== "undefined") window.location.assign(href);
  return true;
}
