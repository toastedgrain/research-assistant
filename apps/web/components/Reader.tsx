"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { blobUrl, digestOf, loadManifest, pdfUrl } from "../lib/api";
import { findCitations, type Citation } from "../lib/citations";
import { evidenceTarget } from "../lib/evidence/navigation";
import { createEvidenceResolver } from "../lib/evidence/resource";
import { getPaperLearningIndex } from "../lib/learning/paper-index";
import { buildConceptThread } from "../lib/learning/threads";
import type { ConceptThread } from "../lib/learning/types";
import { buildReverseIndex, findMentions, type Mention, type PageTextItem } from "../lib/mentions";
import type { Manifest } from "../lib/manifest";
import { loadPdf, pageTextItems, type PDFDocumentProxy } from "../lib/pdf";
import { buildResearchContext } from "../lib/research-context/context";
import type { ResearchContext } from "../lib/research-context/types";
import { paperIdOf, type SourceEvidence } from "../lib/evidence/source";
import type { CapturedSelection } from "../lib/selection/dom";
import OverlayCard, {
  capRailCards,
  cancelRailFrame,
  layoutRail,
  type CardState,
  type RailAnchor,
} from "./OverlayCard";
import PdfPageView from "./PdfPageView";
import SelectionActionPanel from "./selection/SelectionActionPanel";
import ReaderLearningLayer from "./learning/ReaderLearningLayer";

const MAX_PAGE_WIDTH = 760;
const MIN_PAGE_WIDTH = 560;
const MAX_PINNED_CARDS = 4;
/** Render the visible page plus one either side: a 40-page paper must not allocate 40 canvases. */
const RENDER_WINDOW = 1;

interface PageAnalysis {
  items: PageTextItem[];
  mentions: Mention[];
  citations: Citation[];
}

interface ReaderSelection extends CapturedSelection {
  menuOpen: boolean;
}

interface SelectionPanelState {
  mode: "context" | "thread";
  context: ResearchContext;
  thread?: ConceptThread;
}

export default function Reader({ digest }: { digest: string }) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [analysis, setAnalysis] = useState<PageAnalysis[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(0);
  const [cards, setCards] = useState<CardState[]>([]);
  const [railPositions, setRailPositions] = useState<Record<string, number>>({});
  const [anchorVisibility, setAnchorVisibility] = useState<Record<string, boolean>>({});
  const [scrollDrivenLayout, setScrollDrivenLayout] = useState(false);
  const [cueAsset, setCueAsset] = useState<string | null>(null);
  const [hairlinePath, setHairlinePath] = useState<string | null>(null);
  const [sheetAsset, setSheetAsset] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState(MAX_PAGE_WIDTH);
  const [focused, setFocused] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [autoDock, setAutoDock] = useState(true);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [split, setSplit] = useState<{ digest: string; title: string } | null>(null);
  const [selection, setSelection] = useState<ReaderSelection | null>(null);
  const [selectionPanel, setSelectionPanel] = useState<SelectionPanelState | null>(null);
  const [activeEvidence, setActiveEvidence] = useState<SourceEvidence | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLElement | null>(null);
  const railFrameRef = useRef<number | null>(null);
  const railPositionsRef = useRef<Record<string, number>>({});
  const cardOrderRef = useRef(0);

  // Load the manifest and the PDF, then analyse every page's text once. The reverse
  // index has to exist before the first click, and scanning text (without rendering) is
  // fast enough to do up front (spec D3: no server round trips while reading).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadManifest(digest);
        const pdf = await loadPdf(pdfUrl(digest));
        if (cancelled) return;
        setManifest(loaded);
        setDoc(pdf);

        const perPage: PageAnalysis[] = [];
        for (let index = 0; index < pdf.numPages; index += 1) {
          const page = await pdf.getPage(index + 1);
          const items = await pageTextItems(page);
          perPage.push({
            items,
            mentions: findMentions(items, { page: index, assets: loaded.assets }),
            citations: findCitations(items, { references: loaded.references }),
          });
        }
        if (!cancelled) setAnalysis(perPage);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [digest]);

  const assetsById = useMemo(
    () => new Map((manifest?.assets ?? []).map((asset) => [asset.asset_id, asset])),
    [manifest],
  );

  const reverseIndex = useMemo(
    () => buildReverseIndex(analysis.flatMap((page) => page.mentions)),
    [analysis],
  );

  const learningIndex = useMemo(
    () => (manifest && analysis.length === manifest.page_count ? getPaperLearningIndex(manifest, analysis) : null),
    [analysis, manifest],
  );

  const evidenceResolver = useMemo(
    () => (learningIndex ? createEvidenceResolver([learningIndex]) : null),
    [learningIndex],
  );

  const researchContext = useMemo(() => {
    if (!manifest || !selection) return null;
    return buildResearchContext({ manifest, selection: selection.context, pages: analysis, ...(learningIndex ? { index: learningIndex } : {}) });
  }, [analysis, learningIndex, manifest, selection]);

  const openCard = useCallback((assetId: string, hard: boolean, anchorMentionId: string | null = null) => {
    setCards((previous) => {
      const existing = previous.find((card) => card.assetId === assetId);
      if (existing) {
        return previous.map((card) =>
          card.assetId === assetId
            ? {
                ...card,
                hard: card.hard || hard,
                anchorMentionId: anchorMentionId ?? card.anchorMentionId,
              }
            : card,
        );
      }
      const kept = hard ? previous : previous.filter((card) => card.hard);
      const next = [
        ...kept,
        {
          assetId,
          anchorMentionId,
          hard,
          order: cardOrderRef.current++,
        },
      ];
      return capRailCards(next, MAX_PINNED_CARDS);
    });
    setFocused(assetId);
  }, []);

  const closeCard = useCallback((assetId: string) => {
    setCards((previous) => previous.filter((card) => card.assetId !== assetId));
    setFocused((current) => (current === assetId ? null : current));
  }, []);

  const measureRail = useCallback(
    (fromScroll: boolean) => {
      railFrameRef.current = null;
      const rail = railRef.current;
      const scroll = scrollRef.current;
      if (!rail || !scroll) return;

      const railRect = rail.getBoundingClientRect();
      const scrollRect = scroll.getBoundingClientRect();
      const previousPositions = railPositionsRef.current;
      const reads = cards.map((card) => {
        const cardNode = rail.querySelector<HTMLElement>(
          `[data-rail-card="${CSS.escape(card.assetId)}"]`,
        );
        const candidates = Array.from(
          scroll.querySelectorAll<HTMLElement>(
            `[data-mention-asset="${CSS.escape(card.assetId)}"]`,
          ),
        ).map((node) => ({ node, rect: node.getBoundingClientRect() }));
        const visible = candidates.filter(
          ({ rect }) => rect.bottom > scrollRect.top && rect.top < scrollRect.bottom,
        );
        const anchored =
          visible.find(({ node }) => node.dataset.mentionId === card.anchorMentionId) ?? visible[0];
        return {
          card,
          cardHeight: cardNode?.getBoundingClientRect().height || 160,
          mentionRect: anchored?.rect ?? null,
        };
      });

      const anchors: RailAnchor[] = reads.map(({ card, cardHeight, mentionRect }) => ({
        cardId: card.assetId,
        anchorY: mentionRect
          ? mentionRect.top + mentionRect.height / 2 - railRect.top
          : (previousPositions[card.assetId] ?? 16) + cardHeight / 2,
        height: cardHeight,
      }));
      const positions = layoutRail(anchors, railRect.height);
      const nextPositions = Object.fromEntries(positions);
      const nextVisibility = Object.fromEntries(
        reads.map(({ card, mentionRect }) => [card.assetId, mentionRect !== null]),
      );

      let nextHairline: string | null = null;
      if (cueAsset) {
        const active = reads.find(({ card }) => card.assetId === cueAsset);
        const y = positions.get(cueAsset);
        if (active?.mentionRect && y !== undefined) {
          const startX = railRect.left;
          const startY = railRect.top + y + active.cardHeight / 2;
          const endX = active.mentionRect.right;
          const endY = active.mentionRect.top + active.mentionRect.height / 2;
          const pull = Math.min(160, Math.max(32, Math.abs(startX - endX) * 0.35));
          nextHairline = `M ${startX} ${startY} C ${startX - pull} ${startY}, ${endX + pull} ${endY}, ${endX} ${endY}`;
        }
      }

      setScrollDrivenLayout(fromScroll);
      railPositionsRef.current = nextPositions;
      setRailPositions(nextPositions);
      setAnchorVisibility(nextVisibility);
      setHairlinePath(nextHairline);
    },
    [cards, cueAsset],
  );

  const scheduleRailLayout = useCallback(
    (fromScroll: boolean) => {
      if (railFrameRef.current !== null) return;
      railFrameRef.current = window.requestAnimationFrame(() => measureRail(fromScroll));
    },
    [measureRail],
  );

  useEffect(() => {
    scheduleRailLayout(false);
  }, [cards, pageWidth, scheduleRailLayout]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const onScroll = () => scheduleRailLayout(true);
    scroll.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      scroll.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [scheduleRailLayout]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const observer = new ResizeObserver(() => scheduleRailLayout(false));
    rail.querySelectorAll("[data-rail-card]").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [cards, scheduleRailLayout]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const updateWidth = () => {
      setPageWidth(Math.min(MAX_PAGE_WIDTH, Math.max(MIN_PAGE_WIDTH, scroll.clientWidth - 16)));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(scroll);
    return () => observer.disconnect();
  }, [doc]);

  useEffect(
    () => () => {
      cancelRailFrame(railFrameRef, window.cancelAnimationFrame);
    },
    [],
  );

  const scrollToPage = useCallback((page: number) => {
    const node = scrollRef.current?.querySelector(`[data-page="${page}"]`);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    node?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, []);

  const focusPaperSelection = useCallback(() => {
    const page = selection?.context.page ?? currentPage;
    scrollToPage(page);
    window.requestAnimationFrame(() => {
      const root = scrollRef.current?.querySelector<HTMLElement>(`[data-page="${page}"] .pdf-text-layer`);
      root?.focus();
    });
  }, [currentPage, scrollToPage, selection]);

  const navigateToEvidence = useCallback(
    (evidence: SourceEvidence) => {
      if (!manifest) return;
      const target = evidenceTarget(evidence, { [paperIdOf(manifest)]: manifest.page_count });
      if (!target || target.paperId !== paperIdOf(manifest)) return;
      setActiveEvidence(evidence);
      scrollToPage(target.page);
      if (target.assetId && assetsById.has(target.assetId)) openCard(target.assetId, true);
    },
    [assetsById, manifest, openCard, scrollToPage],
  );

  const openSelectionContext = useCallback(() => {
    if (!researchContext) return;
    setSelectionPanel({ mode: "context", context: researchContext });
    setSelection((current) => (current ? { ...current, menuOpen: false } : null));
  }, [researchContext]);

  const openConceptThread = useCallback(() => {
    if (!manifest || !researchContext || !selection) return;
    const thread = buildConceptThread({
      paperId: manifest.doc_id,
      concept: selection.context.text,
      pages: analysis,
      sections: manifest.sections,
      assets: manifest.assets,
    });
    setSelectionPanel({ mode: "thread", context: researchContext, thread });
    setSelection((current) => (current ? { ...current, menuOpen: false } : null));
  }, [analysis, manifest, researchContext, selection]);

  const openCitation = useCallback(
    async (citation: Citation) => {
      if (!manifest) return;
      const reference = manifest.references.find((r) => citation.refIds.includes(r.ref_id));
      if (!reference?.arxiv_id) return;

      setSplit({ digest: "", title: reference.title ?? reference.raw });
      try {
        const response = await fetch(`${blobUrl("/api/papers")}`, {
          method: "POST",
          body: (() => {
            const form = new FormData();
            form.append("arxiv_id", reference.arxiv_id as string);
            return form;
          })(),
        });
        if (!response.ok) throw new Error(await response.text());
        const cited: Manifest = await response.json();
        setSplit({ digest: digestOf(cited), title: cited.title || (reference.title ?? "") });
      } catch {
        setSplit({ digest: "", title: `Could not load ${reference.arxiv_id}` });
      }
    },
    [manifest],
  );

  // Track the page at the viewport centre, for reverse-link highlighting and auto-dock.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !doc) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setCurrentPage(Number(visible.target.getAttribute("data-page")));
      },
      { root: container, threshold: [0.25, 0.5, 0.75] },
    );

    container.querySelectorAll("[data-page]").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [doc, analysis.length]);

  // Auto-dock: soft-pin whatever the current page references. This is the retention bet
  // in spec section 13 - it makes the value passive instead of requiring a click.
  useEffect(() => {
    if (!autoDock) return;
    const first = analysis[currentPage]?.mentions.find((m) => m.assetId !== null);
    if (first?.assetId) openCard(first.assetId, false);
  }, [autoDock, analysis, currentPage, openCard]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target instanceof HTMLElement && event.target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "Escape") {
        if (selection?.menuOpen) {
          setSelection((current) => (current ? { ...current, menuOpen: false } : null));
        } else if (selectionPanel) setSelectionPanel(null);
        else if (activeEvidence) setActiveEvidence(null);
        else if (expanded) setExpanded(null);
        else if (split) setSplit(null);
        else if (focused) closeCard(focused);
        return;
      }
      if (event.key === "\\") {
        setOutlineOpen((open) => !open);
        return;
      }
      if (event.key === "f") {
        const next = analysis[currentPage]?.mentions.find((m) => m.assetId !== null);
        if (next?.assetId) openCard(next.assetId, true);
        return;
      }
      if (/^[1-9]$/.test(event.key)) {
        const card = cards[Number(event.key) - 1];
        if (card) {
          setFocused(card.assetId);
          setExpanded(card.assetId);
        }
        return;
      }
      if ((event.key === "[" || event.key === "]") && focused) {
        const list = reverseIndex.get(focused) ?? [];
        if (list.length === 0) return;
        const position = list.findIndex((m) => m.page >= currentPage);
        const target =
          event.key === "]"
            ? list[Math.min(list.length - 1, Math.max(0, position + 1))]
            : list[Math.max(0, position - 1)];
        if (target) scrollToPage(target.page);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeEvidence, analysis, cards, closeCard, currentPage, expanded, focused, openCard, reverseIndex, scrollToPage, selection, selectionPanel, split]);

  if (error) {
    return <p className="p-8 text-red-600">Could not open this paper: {error}</p>;
  }
  if (!manifest || !doc) {
    return <p className="p-8 opacity-60">Loading paperâ€¦</p>;
  }

  const expandedAsset = expanded ? assetsById.get(expanded) : null;

  return (
    <div className={`flex h-screen flex-col ${dark ? "dark bg-neutral-950 text-neutral-100" : "bg-neutral-100"}`}>
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-300 px-4 py-2 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => setOutlineOpen((open) => !open)}
          className="rounded px-2 py-1 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800"
          title="Toggle outline (\\)"
        >
          â˜°
        </button>
        <h1 className="flex-1 truncate text-sm font-medium">{manifest.title || "Untitled paper"}</h1>
        <span className="text-xs opacity-60">
          p.{currentPage + 1} / {manifest.page_count}
        </span>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={autoDock} onChange={(e) => setAutoDock(e.target.checked)} />
          auto-dock
        </label>
        <button
          type="button"
          onClick={() => setDark((on) => !on)}
          className="rounded px-2 py-1 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800"
        >
          {dark ? "â˜€" : "â˜¾"}
        </button>
      </header>

      <div
        className={`grid min-h-0 flex-1 gap-x-8 overflow-x-auto ${
          outlineOpen
            ? "grid-cols-[minmax(560px,1fr)_56px] min-[901px]:grid-cols-[240px_minmax(560px,1fr)_56px] min-[1280px]:grid-cols-[240px_minmax(560px,1fr)_400px]"
            : "grid-cols-[minmax(560px,1fr)_56px] min-[1280px]:grid-cols-[minmax(560px,1fr)_400px]"
        }`}
      >
        {outlineOpen && (
          <nav className="hidden w-60 overflow-y-auto border-r border-neutral-300 p-3 text-sm min-[901px]:block dark:border-neutral-800">
            {manifest.sections.length === 0 && <p className="opacity-50">No outline found.</p>}
            {manifest.sections.map((section, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollToPage(section.page)}
                className="block w-full truncate rounded px-2 py-1 text-left hover:bg-neutral-200 dark:hover:bg-neutral-800"
                style={{ paddingLeft: 8 + (section.level - 1) * 12 }}
                title={section.title}
              >
                {section.title}
              </button>
            ))}
            <hr className="my-3 border-neutral-300 dark:border-neutral-800" />
            <p className="mb-1 px-2 text-xs uppercase tracking-wide opacity-50">Figures</p>
            {manifest.assets.map((asset) => (
              <button
                key={asset.asset_id}
                type="button"
                onClick={() => openCard(asset.asset_id, true)}
                className="block w-full truncate rounded px-2 py-1 text-left hover:bg-neutral-200 dark:hover:bg-neutral-800"
                title={asset.caption}
              >
                {asset.label}
              </button>
            ))}
          </nav>
        )}

        <div
          ref={scrollRef}
          className="min-w-[560px] overflow-y-auto px-2 py-6"
          onScroll={() =>
            setSelection((current) =>
              current?.menuOpen ? { ...current, menuOpen: false } : current,
            )
          }
        >
          {Array.from({ length: manifest.page_count }, (_, index) => (
            <PdfPageView
              key={index}
              doc={doc}
              pageIndex={index}
              width={pageWidth}
              active={Math.abs(index - currentPage) <= RENDER_WINDOW}
              dark={dark}
              mentions={analysis[index]?.mentions ?? []}
              citations={analysis[index]?.citations ?? []}
              textItems={analysis[index]?.items ?? []}
              onOpenAsset={(assetId, mentionId) => openCard(assetId, true, mentionId)}
              onMentionCue={setCueAsset}
              onOpenCitation={openCitation}
              onTextSelection={(captured) => {
                setSelection({ ...captured, menuOpen: true });
                setSelectionPanel(null);
                setActiveEvidence(null);
              }}
              highlightedAssetId={focused}
              cueAssetId={cueAsset}
              evidenceBBox={activeEvidence?.page === index ? activeEvidence.bbox : undefined}
            />
          ))}
        </div>

        <aside
          ref={railRef}
          aria-label="Pinned figures"
          className="relative overflow-hidden border-l border-neutral-900/10 bg-neutral-100/80 px-2 dark:border-white/10 dark:bg-neutral-950/80 min-[1280px]:px-0"
        >
          <div className="hidden h-full min-[1280px]:block">
            {cards.map((card) => {
              const asset = assetsById.get(card.assetId);
              if (!asset) return null;
              return (
                <OverlayCard
                  key={card.assetId}
                  asset={asset}
                  card={card}
                  focused={focused === card.assetId}
                  reciprocal={cueAsset === card.assetId}
                  anchorVisible={anchorVisibility[card.assetId] ?? false}
                  positioned={railPositions[card.assetId] !== undefined}
                  y={railPositions[card.assetId] ?? 16}
                  scrollDriven={scrollDrivenLayout}
                  compact={cards.length >= 3}
                  currentPage={currentPage}
                  mentions={reverseIndex.get(card.assetId) ?? []}
                  onClose={() => closeCard(card.assetId)}
                  onFocus={() => setFocused(card.assetId)}
                  onHoverChange={(hovered) => {
                    setCueAsset(hovered ? card.assetId : null);
                    if (hovered) setFocused(card.assetId);
                  }}
                  onExpand={() => setExpanded(card.assetId)}
                  onJumpToMention={(mention) => {
                    setCards((previous) =>
                      previous.map((item) =>
                        item.assetId === card.assetId
                          ? {
                              ...item,
                              anchorMentionId: `${mention.assetId}:p${mention.page}:m${mention.index}`,
                            }
                          : item,
                      ),
                    );
                    scrollToPage(mention.page);
                  }}
                />
              );
            })}
          </div>

          <div className="flex h-full flex-col items-center gap-2 py-4 min-[1280px]:hidden">
            {cards.map((card) => {
              const asset = assetsById.get(card.assetId);
              if (!asset) return null;
              return (
                <button
                  key={card.assetId}
                  type="button"
                  onClick={() => setSheetAsset(card.assetId)}
                  className={`h-12 w-12 overflow-hidden rounded-md border bg-white p-1 ${
                    focused === card.assetId ? "border-sky-500" : "border-neutral-900/10"
                  }`}
                  aria-label={`Open ${asset.label}`}
                >
                  <img src={blobUrl(asset.image_url)} alt="" className="h-full w-full object-contain" />
                </button>
              );
            })}
          </div>
        </aside>

        {split && (
          <aside className="fixed inset-y-0 right-0 z-50 flex w-1/2 flex-col border-l border-neutral-300 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center gap-2 border-b border-neutral-300 px-3 py-2 dark:border-neutral-800">
              <span className="flex-1 truncate text-sm">{split.title}</span>
              <button type="button" onClick={() => setSplit(null)} aria-label="Close split view">
                Ã—
              </button>
            </div>
            {split.digest ? (
              <iframe title={split.title} src={pdfUrl(split.digest)} className="flex-1" />
            ) : (
              <p className="p-4 text-sm opacity-60">Fetching the cited paperâ€¦</p>
            )}
          </aside>
        )}
      </div>

      {hairlinePath && (
        <svg aria-hidden="true" className="pointer-events-none fixed inset-0 z-20 h-screen w-screen">
          <path d={hairlinePath} fill="none" stroke="rgb(14 165 233)" strokeWidth="1" />
        </svg>
      )}

      {selectionPanel && (
        <SelectionActionPanel
          mode={selectionPanel.mode}
          context={selectionPanel.context}
          thread={selectionPanel.thread}
          onNavigateEvidence={navigateToEvidence}
          onOpenAsset={(assetId) => openCard(assetId, true)}
          onClose={() => setSelectionPanel(null)}
        />
      )}

      <ReaderLearningLayer
        selection={selection}
        context={researchContext}
        index={learningIndex}
        resolver={evidenceResolver}
        onSelectionMenuOpenChange={(open) => setSelection((current) => (current ? { ...current, menuOpen: open } : null))}
        onOpenContext={openSelectionContext}
        onOpenTrace={openConceptThread}
        onCopy={() => {
          if (selection) void navigator.clipboard?.writeText(selection.context.text);
          setSelection((current) => (current ? { ...current, menuOpen: false } : null));
        }}
        onNavigateEvidence={(evidence) => navigateToEvidence(evidence.source)}
        onFocusPaper={focusPaperSelection}
        onRestorePaperPage={scrollToPage}
      />

      {sheetAsset && assetsById.get(sheetAsset) && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/35 p-4 min-[1280px]:hidden">
          <div className="mx-auto w-full max-w-3xl">
            {(() => {
              const card = cards.find((item) => item.assetId === sheetAsset);
              const asset = assetsById.get(sheetAsset);
              if (!card || !asset) return null;
              return (
                <OverlayCard
                  asset={asset}
                  card={card}
                  variant="sheet"
                  focused
                  reciprocal={false}
                  anchorVisible
                  positioned
                  y={0}
                  scrollDriven={false}
                  currentPage={currentPage}
                  mentions={reverseIndex.get(card.assetId) ?? []}
                  onClose={() => setSheetAsset(null)}
                  onFocus={() => setFocused(card.assetId)}
                  onHoverChange={() => undefined}
                  onExpand={() => setExpanded(card.assetId)}
                  onJumpToMention={(mention) => {
                    setSheetAsset(null);
                    scrollToPage(mention.page);
                  }}
                />
              );
            })()}
          </div>
        </div>
      )}

      {expandedAsset && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-8"
          onClick={() => setExpanded(null)}
        >
          <img
            src={blobUrl(expandedAsset.image_url)}
            alt={expandedAsset.caption}
            className="max-h-[80vh] max-w-full bg-white object-contain"
          />
          <p className="mt-3 max-w-3xl text-center text-sm text-neutral-200">
            {expandedAsset.caption}
          </p>
        </div>
      )}
    </div>
  );
}
