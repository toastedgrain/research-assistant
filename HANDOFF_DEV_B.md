# Developer B handoff — Exploration, Workspace & Accessibility

**Status:** Phases 1–2 complete and merged to `main`. Phase 3 not started.
**Last commit:** `9fa290b` — *Merge explore/figure-atlas: Figure Atlas and explore route*
**Working tree:** clean, `main` in sync with `origin/main`, no servers running.

This document hands off the Developer B track to whoever picks it up next. It assumes you
have not seen this repo before.

---

## 1. Read these first, in this order

| File | Why |
|---|---|
| `AGENTS.md` | The project map: architecture, conventions, dangerous areas, and a list of non-obvious library behaviours that each cost real debugging time. **Non-optional.** |
| `MARGINALIA_EXPANSION_ARCHITECTURE_AND_DEV_SPLIT (1).md` | The spec for this whole effort. Defines the A/B split, the contracts, the staging, and the invariants. Section numbers below (§) refer to this file. |
| `PROJECT_SPEC_1.md` | The original product spec. Owns *why*. |
| `SHIP_PLAN.md` | The original 30-hour plan. Owns what the base product deliberately does and does not do. |
| `HANDOFF.md` | Status of the base product (pre-expansion), including how to run and what is unmeasured. |

---

## 2. What the product is, in one paragraph

Marginalia is a PDF reader for arXiv AI/ML papers. A sentence on page 3 says "as shown in
Figure 1"; Figure 1 is on page 7. Clicking the mention opens the figure in place, in a card
that stays while you keep scrolling, and shows every other page that references it.
Citations can open the cited paper side-by-side. **It does not summarize, and the core
contains zero LLM calls.** That is a product decision (spec §2), not an omission: the
target reader is the least LLM-error-tolerant audience there is.

The expansion adds four surfaces: Research Reader (exists), Research Explorer, Learning
Layer, and Game Layer. The guiding principle is:

> Do not replace research with a summary. Reorganize, connect, expose, and interact with
> the original evidence.

---

## 3. Which half is ours

**We are Developer B: Exploration, Workspace & Reader Accessibility.**

We own: cross-paper citation navigation, citation graph, Figure Atlas, Paper Map,
collections/spaces, cross-paper search, figure/table comparison, research lineage,
timelines, constellation view, pinboard, workspace persistence, dataset/benchmark browser,
the cross-paper context provider, reader reflow, and all accessibility work.

**Developer A owns** selection intelligence, concepts, difficulty detection, prerequisites,
micro-visualizations, Learn/Quest modes, and the entire challenge/game engine. Do not build
these, and do not import their UI. The user has been explicit: **do not touch Developer A's
work — it will conflict.**

### A useful consequence

Nothing in Developer B's scope needs an LLM. Atlas, map, graph, collections, reflow and
accessibility are deterministic reads of the existing manifest plus pdf.js text. **The §6
generation policy never binds us.** If you find yourself wanting to generate text, you have
probably wandered into Developer A's lane.

---

## 4. Hard invariants — breaking any of these is a defect

These come from §1 of the expansion doc and from `AGENTS.md`. They are not style
preferences.

1. **Do not add `mentions[]` to the server manifest.** Mention detection is client-side,
   permanently. A server-side index would need byte-identical text normalization in Python
   and TypeScript, which is a permanent drift bug source.
2. **Coordinates convert exactly once**, in `apps/api/extract/geometry.py`. The manifest
   stores normalized top-left `[0,1]`. Never apply a second "helpful" flip. Reuse
   `NormalizedBBox` (which is an alias of the schema's `BBox`) rather than defining a
   parallel box type — a parallel type is how a second conversion sneaks in.
3. **Precision over recall.** When confidence is low, render nothing. No dangling graph
   edge, no dead link, no broken image, no affordance that promises something that does not
   work.
4. **Schema changes start in `packages/schema/manifest.schema.json`**, then regenerate TS
   types with `npm run gen:schema` from `apps/web`. Never hand-edit the generated file. But
   **do not put session or workspace state into the extraction manifest** — the manifest
   describes the document, not the user.
5. **The existing reader must not regress.** §1.5 lists the nine behaviours to re-verify
   before merging anything significant. See §9 below for how.
6. **Avoid concurrent edits to `Reader.tsx`, the route shell, shared schema, and mention
   detection** (§18). This is the single most important rule for staying out of Developer
   A's way. Everything shipped so far obeys it — see §6.
7. **This repo names no AI vendor.** Not in filenames, file contents, or commit messages.
   That is why this document is addressed to "you" rather than to a named tool. Agent
   guidance goes in `AGENTS.md`; harness-specific files stay untracked via
   `.git/info/exclude`, never `.gitignore`.
8. **Never add a `Co-Authored-By` trailer or any self-attribution to commits.** The user
   has asked for this twice and history was rewritten once to remove it.

---

## 5. Decisions already made, and why

Do not silently reverse these; they were deliberate.

| Decision | Rationale |
|---|---|
| **Feature branch per phase**, merged to `main` when green | §18's convention. Developer A never pulls half-finished work, and conflicts surface one phase at a time. Chosen by the user. |
| **IndexedDB for workspace persistence**, behind a repository interface | §B8 requires ONE canonical store. IndexedDB needs zero changes to `apps/api/main.py`, which Developer A also needs for progress persistence, so there is no shared-file conflict. §12 mandates the repository interface anyway, so it can be swapped for the filesystem later without touching UI. Chosen by the user. **Not yet implemented — this is Phase 4.** |
| **`paperId` is the content hash, not the arXiv id** | An uploaded paper has no arXiv id but always has a digest, and the digest is what every blob path and cache entry is keyed by (spec D1). |
| **Section ids derive from manifest order** (`sec-0`, `sec-1`, …) | The manifest carries no section ids, and section titles are not unique within a paper, so position is the only stable handle. |
| **`SourceEvidenceKind` adds `"algorithm"`** to §5.2's six kinds | The manifest produces algorithm assets and the original union cannot express them. The alternative was labelling an algorithm a "figure" — a wrong label on primary source material, which is the one thing this product exists not to do. Additive, so nothing that emits only the original six breaks, and TypeScript flags any exhaustive switch rather than failing silently. **This is a shared contract: Developer A should be told.** |
| **Exploration lives on its own route** (`/explore/<digest>`), not inside the reader | Keeps `Reader.tsx` untouched per §18. |
| **Duplicated load-and-scan orchestration** in `lib/explore/analysis.ts` | Hoisting it out of `Reader.tsx` would mean editing `Reader.tsx`. The *detection logic* is still shared (`findMentions`, `pageTextItems`); only ~10 lines of orchestration repeat. Deliberate trade. |

---

## 6. What is built (Phases 1–2)

### Phase 1 — `explore/shared-contracts` → merged (`2bb3b14`, `52a3651`)

Stage 0 contracts. Small on purpose so it merged fast and unblocked Developer A.

- **`apps/web/lib/evidence/source.ts`** — the object both developers pass across the A/B
  boundary. `SourceEvidence`, `PaperRef`, `SectionRef`, `AssetRef`, `CitationRef`,
  `MentionRef`, `ConceptRef`, `PassageRef`, `NormalizedBBox`, plus constructors
  (`assetEvidence`, `captionEvidence`, `citationEvidence`, `passageEvidence`) and
  `evidenceKey` / `isSameEvidence` for dedupe and persistence.
  Evidence is a **pointer, never a copy**: every entry carries paper, page and region, which
  is what makes "Show evidence →" possible.
- **`apps/web/lib/explore/graph.ts`** — the single graph model behind citation graph,
  lineage, timeline and constellation (§16). Pure functions: `emptyGraph`, `addNode`,
  `addEdge`, `edgesOf`, `neighbors`, `nodeById`.
  Edge identity is `(source, target, type)`, so a citation and a user-drawn line between the
  same two papers stay two distinct edges. An edge with a missing endpoint is **dropped, not
  drawn**. This enforces §16's critical rule that literal, inferred and user-created
  relationships must never look identical.

### Phase 2 — `explore/figure-atlas` → merged (`5a1bc40`, `9fa290b`)

Figure Atlas at `/explore/<digest>`, grouped by type or by section.

- **`apps/web/lib/explore/atlas.ts`** — pure data from manifest + reverse mention index.
  `buildAtlasEntries`, `groupByKind`, `groupBySection`, `sectionForPage`.
- **`apps/web/lib/explore/analysis.ts`** — loads manifest + PDF, builds the reverse mention
  index, cached per digest (§21).
- **`apps/web/components/explore/ExploreShell.tsx`** — tabbed host. Tabs are added as
  surfaces are built; a surface that does not exist is **not listed**, rather than shown
  disabled.
- **`apps/web/components/explore/FigureAtlas.tsx`** — the cards.
- **`apps/web/app/explore/[digest]/page.tsx`** — route, loaded with `ssr: false`.

Behaviours pinned by tests (§19 requires the first two):
- every card maps to a real manifest asset — the atlas cannot invent an entry;
- an asset with **no usable crop still appears** showing its caption, rather than rendering
  an `<img>` pointed at nothing (also falls back on a runtime image error);
- reverse links list **distinct** pages (two mentions on one page is one place to jump to);
- section grouping assigns an asset to the last section starting at or before its page, and
  refuses to guess for pages before the first heading (those group under "Unsectioned").

**Verified in a browser** against *Attention Is All You Need*: all 9 assets render with
crops, captions, pages and reverse links; section grouping puts Figure 1 under "Attention"
and Figure 2 under "Multi-Head Attention".

---

## 7. Current state

```
main  9fa290b  (= origin/main, clean)
├── explore/shared-contracts   merged, pushed
└── explore/figure-atlas       merged, pushed
```

Tests: **79 web** (vitest) + **151 Python** (pytest), all green. Typecheck clean.
No background processes; ports 8000 and 3003 are free.

Files added by Developer B so far:

```
apps/web/lib/evidence/source.ts          + source.test.ts
apps/web/lib/explore/graph.ts            + graph.test.ts
apps/web/lib/explore/atlas.ts            + atlas.test.ts
apps/web/lib/explore/analysis.ts
apps/web/components/explore/ExploreShell.tsx
apps/web/components/explore/FigureAtlas.tsx
apps/web/app/explore/[digest]/page.tsx
```

Nothing else in the repo was modified. `Reader.tsx` has not been touched.

---

## 8. What is next — the remaining phase plan

Follows the doc's Dev B staging (§17). One branch per phase; merge to `main` when green.

### Phase 3 — `explore/paper-map` (§B2)
Structural view of one paper: sections → nested assets → references. Fully deterministic
from `manifest.sections`, `manifest.assets`, the client reverse index, and citations. **No
AI required** — the doc says so explicitly. Add it as a second tab in `ExploreShell`.
Reuse `sectionForPage` from `atlas.ts` rather than re-deriving section assignment.

### Phase 4 — `workspace/collections` (§B8, §12)
The persistence layer. Define `WorkspaceRepository` (and later `ProgressRepository`,
`AnalysisRepository`) and implement over IndexedDB. **One canonical store — do not scatter
state across localStorage and IndexedDB.** Required test (§19): a pinned source reference
survives a persistence round-trip, and a deleted paper is handled gracefully.
Store `SourceEvidence` references, **not detached copies** of content (§B9).

### Phase 5 — `accessibility/reflow` (§10.1)
Reflow two-column PDF text into a semantic reading layout: heading hierarchy, paragraphs,
inline figure references that open the real assets, citation affordances. **Always preserve
a jump back to the original PDF location.** If reading order is uncertain, offer the
original PDF rather than silently presenting a broken order (§22). Required tests: section
order stable, headings semantic, figure references still linked.

### Phase 6 — `explore/citation-graph` (§B3, §B4) + the cross-paper provider (§11)
Start with the current paper plus directly openable cited papers; expand lazily as the user
explores. **Do not load an enormous academic graph by default** (§21). A citation edge may
only be created from an actually resolved reference (§19). Then expose:

```ts
interface CrossPaperContextProvider {
  getPaper(paperId: string): PaperRef | null;
  getConnectedPapers(paperId: string): PaperRef[];
  getCollectionPapers(collectionId: string): PaperRef[];
  findEvidence(query: EvidenceQuery): SourceEvidence[];
}
```

This is what unblocks Developer A's cross-paper games, so land it before Stage 4.

### Phase 7 — `workspace/pinboard` (§B9) + comparison (§B10)
Canvas for organizing figures, tables, passages, citations. Connections are user-created
unless clearly labelled generated. Comparison is user-selected evidence in Phase 1, not
automated claim generation.

### Phase 8 — lineage, timelines, constellation (§B5–B7)
All on the shared `ResearchGraph`. Generated lineage edges must be visually distinct from
literal citation edges. Do not imply bibliometric importance from node size unless you
define it.

### Phase 9 — accessibility hardening (§10.2–10.5)
Typography controls, keyboard completeness, screen-reader semantics, optional read-aloud
consuming reflow text (never inferring reading order from canvas pixels).

### Deferred, needs coordination
**Entry point from the reader into `/explore/<digest>`, and honouring the `#page=` fragment
so a card can jump to a page.** Both need a small `Reader.tsx` change. §18 says to do this
as a slot (`<ReaderOverlayLayer />`) in a dedicated commit rather than by editing the reader
repeatedly. Atlas links already carry `#page=` for a future reader to honour, and their
labels deliberately only promise what works today. **Coordinate with Developer A before
touching `Reader.tsx`.** Until then `/explore/<digest>` is reached by URL.

---

## 9. How to run and verify

Prerequisites: `uv`, Node 20+. **Keep the repo out of OneDrive** — sync locks files
mid-install and breaks both `uv` and `node_modules`.

```bash
# API (terminal 1)
cd apps/api && uv sync && uv run uvicorn main:app --port 8000

# Reader (terminal 2)
cd apps/web && npm install && npm run dev     # takes the next free port if 3000 is busy
```

Then open `/explore/<digest>`. To get a digest, open a paper at `/` (paste `1706.03762`)
and copy it from the `/read/<digest>` URL, or:

```bash
ls data/            # each directory name is a digest
```

### Checks before merging any phase

```bash
cd apps/web && npm test && npx tsc --noEmit    # 79 tests today
cd apps/api && uv run pytest -q                # 151 tests today
```

Plus the §1.5 reader regression walk, by hand, at `/read/<digest>`:
open `1706.03762` → click a Figure 1 mention → correct crop opens → card survives scrolling
→ reverse links navigate → a citation opens pane 2 → dark mode does not invert crops →
keyboard still works.

### Eval harness (unchanged by this work)

```bash
cd apps/api && uv run python -m eval.figures
cd apps/web && npm run eval:mentions
```

`fixtures/papers/` is gitignored; `eval/README.md` documents how to fetch the PDFs and what
is currently unmeasured.

---

## 10. Conventions to keep

- **Test first.** Every module in this repo was built that way. Write the test, watch it
  fail for the right reason, then implement. Colocated `*.test.ts` next to the source.
- **Commit messages explain reasoning**, not just what changed. Look at `01335e3` for the
  house style — it documents four defects that only real papers exposed.
- **Comments explain why, not what.** The existing code comments are mostly load-bearing
  warnings about non-obvious library behaviour; keep that bar.
- Do not add a dependency without saying why.
- Do not refactor working extraction for aesthetic reasons (§24). It has real-paper
  verification history.

---

## 11. Known issues found but deliberately not fixed

- **Some table crops are truncated.** The Figure Atlas made this visible at a glance:
  in *Attention Is All You Need*, the Table 2 and Table 3 crops show only the first row or
  two rather than the full table. This is an **extraction-quality** issue in
  `apps/api/extract/figures.py`, not an atlas bug. It was left alone on purpose: extraction
  is core/shared rather than Developer B's lane, §24 forbids refactoring working extraction
  without tests and eval evidence, and there are still no hand-labelled bounding boxes to
  prove a change helps. Worth raising with whoever owns extraction.
- **Figure-region IoU remains UNMEASURED** across the whole project — no hand-labelled
  boxes exist, and `eval/figures.py` reports it honestly rather than inventing a number.
  Mention precision/recall are measured on two labelled pages of one paper only. See
  `eval/README.md`.
- **Reader clutter.** Separately from the expansion, the reader's overlay cards accumulate:
  auto-dock fires on every page change and picks the first mention on the page regardless of
  where you are reading (`Reader.tsx`, the auto-dock effect), and pinned cards cascade from
  a fixed origin with no cap, so they march across the page and cover the outline. This was
  raised by the user and is unresolved. It sits in the reader, so it needs coordination
  before anyone edits it.
