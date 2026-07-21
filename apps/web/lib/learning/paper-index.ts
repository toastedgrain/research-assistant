import type { Citation } from "../citations";
import { paperIdOf, sectionRefsOf } from "../evidence/source";
import type { Manifest } from "../manifest";
import { flattenPage, type Mention, type PageTextItem } from "../mentions";
import {
  buildPagePassages,
  type PageContextData,
} from "../research-context/context";
import type { PassageRef, SelectionContext } from "../research-context/types";

export interface PaperLearningPage extends PageContextData {
  items: PageTextItem[];
  mentions: Mention[];
  citations: Citation[];
}

export interface PaperLearningIndex {
  paperId: string;
  manifest: Manifest;
  pages: readonly PaperLearningPage[];
  pageText: readonly string[];
  passages: readonly PassageRef[];
  passagesByPage: ReadonlyMap<number, readonly PassageRef[]>;
  passageById: ReadonlyMap<string, PassageRef>;
  assetsByPage: ReadonlyMap<number, readonly Manifest["assets"][number][]>;
  citationsByPage: ReadonlyMap<number, readonly Citation[]>;
  normalizedTermLookup: ReadonlyMap<string, readonly PassageRef[]>;
}

const cache = new WeakMap<Manifest, WeakMap<object, PaperLearningIndex>>();

function normalizedTerm(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u2010\u2011]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function passageMatchesSelection(passage: PassageRef, selection: SelectionContext): boolean {
  if (passage.page !== selection.page) return false;
  const selectedItems = new Set(selection.itemRanges.map((range) => range.itemIndex));
  return passage.itemRanges.some((range) => selectedItems.has(range.itemIndex));
}

function freezePageMap<T>(entries: [number, readonly T[]][]): ReadonlyMap<number, readonly T[]> {
  return new Map(entries.map(([page, values]) => [page, Object.freeze([...values])]));
}

function buildIndex(manifest: Manifest, pages: readonly PaperLearningPage[]): PaperLearningIndex {
  const paperId = paperIdOf(manifest);
  const passages = pages.flatMap((page, pageIndex) =>
    buildPagePassages(paperId, pageIndex, page.items, manifest.sections),
  );
  const passagesByPage = new Map<number, PassageRef[]>();
  for (const passage of passages) {
    const bucket = passagesByPage.get(passage.page) ?? [];
    bucket.push(passage);
    passagesByPage.set(passage.page, bucket);
  }
  const assetsByPage = new Map<number, Manifest["assets"][number][]>(pages.map((_, page) => [page, []]));
  for (const asset of manifest.assets) {
    const bucket = assetsByPage.get(asset.page) ?? [];
    bucket.push(asset);
    assetsByPage.set(asset.page, bucket);
  }
  const normalizedTermLookup = new Map<string, PassageRef[]>();
  for (const passage of passages) {
    const term = normalizedTerm(passage.text);
    if (!term) continue;
    const bucket = normalizedTermLookup.get(term) ?? [];
    bucket.push(passage);
    normalizedTermLookup.set(term, bucket);
  }

  return {
    paperId,
    manifest,
    pages,
    pageText: pages.map((page) => flattenPage(page.items).text),
    passages: Object.freeze(passages),
    passagesByPage: freezePageMap([...passagesByPage.entries()]),
    passageById: new Map(passages.map((passage) => [passage.id, passage])),
    assetsByPage: freezePageMap([...assetsByPage.entries()]),
    citationsByPage: freezePageMap(pages.map((page, index) => [index, page.citations])),
    normalizedTermLookup,
  };
}

/**
 * Deterministic paper-level cache. The same manifest/page-analysis objects always produce
 * the same index; a new analysis object receives a new index rather than stale text.
 */
export function getPaperLearningIndex(
  manifest: Manifest,
  pages: readonly PaperLearningPage[],
): PaperLearningIndex {
  let byPages = cache.get(manifest);
  if (!byPages) {
    byPages = new WeakMap<object, PaperLearningIndex>();
    cache.set(manifest, byPages);
  }
  const pageIdentity = pages as object;
  const existing = byPages.get(pageIdentity);
  if (existing) return existing;

  const index = buildIndex(manifest, pages);
  byPages.set(pageIdentity, index);
  return index;
}

export function passageForSelection(
  index: PaperLearningIndex,
  selection: SelectionContext,
): PassageRef | undefined {
  return index.passagesByPage
    .get(selection.page)
    ?.find((passage) => passageMatchesSelection(passage, selection));
}

export function boundedSourceWindow(
  index: PaperLearningIndex,
  selection: SelectionContext,
  radius = 2,
): { before: PassageRef[]; selected?: PassageRef; after: PassageRef[] } {
  const selected = passageForSelection(index, selection);
  if (!selected) return { before: [], after: [] };
  const selectedIndex = index.passages.findIndex((passage) => passage.id === selected.id);
  return {
    before: index.passages.slice(Math.max(0, selectedIndex - radius), selectedIndex),
    selected,
    after: index.passages.slice(selectedIndex + 1, selectedIndex + radius + 1),
  };
}

export function passagesForNormalizedTerm(
  index: PaperLearningIndex,
  term: string,
): readonly PassageRef[] {
  return index.normalizedTermLookup.get(normalizedTerm(term)) ?? [];
}

export function clearPaperLearningIndexForTests(): void {
  // WeakMap intentionally has no delete-all. A fresh Manifest object is used in each test.
}

export function indexedSections(index: PaperLearningIndex) {
  return sectionRefsOf(index.manifest);
}
