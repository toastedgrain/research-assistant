import { sectionRefsOf } from "../evidence/source";
import type { ConceptRef } from "../research-context/types";
import type { PaperLearningIndex } from "./paper-index";
import type { ConceptObject, DifficultySignal, LearningObject, LearningRegion } from "./types";

function bounded(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function words(value: string): string[] {
  return value.match(/[\p{L}\p{N}]+/gu) ?? [];
}

function sectionRange(index: PaperLearningIndex, start: number, end: number) {
  return index.passages.filter((passage) => passage.page >= start && passage.page <= end);
}

function signalsFor(
  index: PaperLearningIndex,
  passages: ReturnType<typeof sectionRange>,
  pageStart: number,
  pageEnd: number,
  definitionCount: number,
): DifficultySignal[] {
  const text = passages.map((passage) => passage.text).join(" ");
  const sentenceCount = Math.max(1, text.split(/[.!?]+/).filter(Boolean).length);
  const wordCount = words(text).length;
  const citations = Array.from({ length: pageEnd - pageStart + 1 }, (_, offset) =>
    index.citationsByPage.get(pageStart + offset)?.length ?? 0,
  ).reduce((sum, count) => sum + count, 0);
  const mentions = Array.from({ length: pageEnd - pageStart + 1 }, (_, offset) =>
    index.pages[pageStart + offset]?.mentions.length ?? 0,
  ).reduce((sum, count) => sum + count, 0);
  const symbols = (text.match(/[=+*/<>∑∏√≈≤≥]/g) ?? []).length;
  const parentheticals = (text.match(/\([^)]{1,80}\)/g) ?? []).length;
  const technical = new Set(words(text).filter((word) => word.length >= 10).map((word) => word.toLocaleLowerCase())).size;
  const candidates: Array<[DifficultySignal["kind"], string, number]> = [
    ["sentence-complexity", "long sentences", bounded(wordCount / sentenceCount / 30)],
    ["symbol-density", "symbol density", bounded(symbols / Math.max(1, wordCount) * 12)],
    ["citation-density", "citation density", bounded(citations / Math.max(1, passages.length * 2))],
    ["introduced-term-density", "introduced terms", bounded(definitionCount / Math.max(1, passages.length))],
    ["technical-term-density", "technical terms", bounded(technical / Math.max(1, wordCount) * 9)],
    ["parenthetical-density", "parenthetical detail", bounded(parentheticals / Math.max(1, sentenceCount))],
    ["asset-dependency", "figure/table references", bounded(mentions / Math.max(1, passages.length))],
  ];
  return candidates.filter(([, , value]) => value > 0).map(([kind, label, value]) => ({ kind, label, value }));
}

/** Stable relative difficulty within this paper; callers should not display more precision. */
export function buildDifficultyRegions(index: PaperLearningIndex, objects: readonly LearningObject[]): LearningRegion[] {
  const sections = sectionRefsOf(index.manifest);
  const definitions = objects.filter((object): object is ConceptObject => object.kind === "concept");
  const unscaled = sections.map((section, position) => {
    const pageEnd = (sections[position + 1]?.page ?? index.manifest.page_count) - 1;
    const passages = sectionRange(index, section.page, Math.max(section.page, pageEnd));
    const concepts = definitions
      .filter((concept) => concept.occurrences.some((occurrence) => occurrence.page >= section.page && occurrence.page <= pageEnd))
      .map<ConceptRef>((concept) => ({ conceptId: concept.id, paperId: concept.paperId, label: concept.label }));
    const reasons = signalsFor(index, passages, section.page, Math.max(section.page, pageEnd), concepts.length);
    return {
      id: `${index.paperId}:region:${section.sectionId}`,
      sectionId: section.sectionId,
      pageStart: section.page,
      pageEnd: Math.max(section.page, pageEnd),
      reasons,
      concepts,
      assets: index.manifest.assets
        .filter((asset) => asset.page >= section.page && asset.page <= pageEnd)
        .map((asset) => ({
          paperId: index.paperId,
          assetId: asset.asset_id,
          kind: asset.kind,
          label: asset.label,
          page: asset.page,
          bbox: asset.bbox,
          caption: asset.caption,
        })),
      raw: reasons.reduce((total, signal) => total + signal.value, 0),
    };
  });
  const minimum = Math.min(...unscaled.map((region) => region.raw), 0);
  const maximum = Math.max(...unscaled.map((region) => region.raw), 0);
  return unscaled.map(({ raw, ...region }) => ({
    ...region,
    difficulty: maximum === minimum ? 0.5 : bounded((raw - minimum) / (maximum - minimum)),
  }));
}
