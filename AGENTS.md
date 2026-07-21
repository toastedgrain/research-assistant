# Marginalia — figure-first paper reader

## What this is

A PDF reader for arXiv AI/ML papers that keeps figures, tables, and references visible next
to the text that references them. A sentence on page 3 says "as shown in Figure 1"; Figure 1
is on page 7. This tool resolves that in place so the reader never loses their sentence.

**It does not summarize.** See `PROJECT_SPEC_1.md` §2 — the non-goals are load-bearing, not
placeholders. The target user reads papers in full and is the least LLM-error-tolerant
audience that exists; one wrong generated claim and they churn permanently.

**Design rule:** a feature that *invents* text is off by default and clearly labeled. A
feature that *relocates* text already in the paper can be on by default.

**Currently: zero LLM calls in this codebase.** The only sanctioned future one is
reference-string → structured data (spec §7a step 3), because the output is validated
structured data, not prose shown to the reader as fact. Justify any new one against §2.

## Status

All eight phases of `SHIP_PLAN.md` are built and the loop runs end to end: paste an arXiv
id, read the paper, click a figure mention, get the figure in place.

- **Extraction** (`apps/api/extract/`) — figures, tables, crops, captions, sections,
  references, arXiv resolution. CLI: `uv run python -m extract paper.pdf`.
- **API** (`apps/api/main.py`) — upload/arXiv ingest, manifest, blob store.
- **Reader** (`apps/web/`) — pdf.js viewer, hotspots, overlay cards, reverse links,
  side-by-side citations, outline, keyboard, dark mode, auto-dock.
- **Eval** (`eval/`) — figure coverage and timing in Python, mentions in Node.

Verified on *Attention Is All You Need*, *ResNet* and *BERT*: 5/5, 7/7 and 3/5 figures;
4/4, 14/14 and 6/8 tables. Everything not detected is dropped with a warning and renders
no affordance.

**Known gaps, in priority order.** Figure-region IoU and caption-attachment accuracy are
unmeasured — there are no hand-labelled bounding boxes, and `eval/` reports that as
UNMEASURED rather than inventing a number. Mention precision/recall are measured on two
labelled pages of one paper, which is a smoke test with a percentage attached, not the
30-paper golden set spec §11 asks for. Pins do not persist across sessions, and spec §3's
product metrics are not instrumented.

Two source-of-truth documents:

- `PROJECT_SPEC_1.md` — the full product spec (M0→M5). Owns *why*.
- `SHIP_PLAN.md` — the approved 30-hour ship plan. Owns *what we're actually building
  now*. **Read this before starting work.**

The plan deliberately deviates from the spec in three places, all agreed with the user.
Do not "fix" the code back toward the spec without checking the plan first:

1. **Overlay, not dock rail.** Spec §8's three-column layout is replaced by draggable
   translucent cards floating over the PDF. Clicking a citation opens the cited paper
   **side-by-side** in a second pane.
2. **Mention detection is client-side.** Spec §6 Stage 5 (shared Python/TS text
   normalization contract) is deleted — the spec authorizes this escape hatch itself. See
   Architecture below.
3. **Caption-anchored heuristic is the primary figure backend**, not the fallback.
   PDFFigures2 needs a JVM and `java` is not installed; Docling pulls multi-GB torch models.

## Stack

- Python 3.12 (pinned via `.python-version`), uv-managed — **not** the system 3.14
- PyMuPDF (`import fitz`) for all PDF work: render, crop, text, vector drawings
- FastAPI, single process, inline extraction with SSE progress — no worker queue
- Next.js App Router + TypeScript + Tailwind + `pdfjs-dist` (*planned*)
- **No database.** Filesystem blob store at `data/<sha256>/`
- Local only — no deploy, no accounts, no auth

Spec §9 calls for Postgres + Redis + arq + S3. All cut; the plan documents why.

## Architecture

Extraction runs once per unique PDF, keyed by SHA-256 of its bytes (spec D1 — this is what
makes the unit economics work; the hundredth reader of *Attention Is All You Need* gets an
instant load). Output is a single static JSON manifest. The client is a dumb renderer over
that manifest with no server round-trips while reading (spec D3).

```
arXiv ID / upload → FastAPI → extract/ → data/<sha256>/{paper.pdf, manifest.json, crops/*.png}
                                              ↓
                                    Next.js + pdf.js renders it
```

**The language boundary is the most important thing to understand here:**

| Side | Owns |
|---|---|
| Python | figure/table regions, PNG crops, captions, sections, reference parsing, arXiv resolution |
| TypeScript | mention detection, citation markers, hotspots, reverse index |

The manifest has **no `mentions[]` array**. The client already holds pdf.js
`textContent.items`, so it runs the mention regex over those directly and builds the reverse
index in-browser at load time. This is deliberate: a server-side mention index would require
a byte-identical text-normalization rule on both sides, and keeping two implementations in
two languages in sync is a permanent bug source. Do not add server-side mention detection.

Consequence: mention-accuracy eval runs in Node; figure-region eval runs in Python.

## Folder structure

- `apps/api/` — FastAPI app + the `extract/` package (the extraction pipeline)
- `packages/schema/` — `manifest.schema.json` is the contract between Python and TS; TS types
  are generated from it. Change the schema here first, never in one side only.
- `fixtures/` — golden test papers + hand-labeled ground truth. PDFs are gitignored, labels
  are tracked.
- `eval/` — accuracy harness (spec §11). Exists from M0, not bolted on later.
- `data/` — gitignored blob store, content-hash keyed

## Commands

```bash
# Python deps (run from apps/api)
uv sync

# extraction CLI — the M0 deliverable
uv run python -m extract paper.pdf > manifest.json

# API dev server
uv run fastapi dev

# tests
uv run pytest

# web (planned)
cd apps/web && npm run dev
```

## Conventions

- **Coordinates.** PDF native origin is bottom-left, y up. pdf.js viewport is top-left, y
  down. The manifest stores **normalized top-left `[0,1]`**. Convert exactly once, in
  `extract/geometry.py`. Any coordinate bug in this project will be a failure to convert
  exactly once. The test for this is written *before* the conversion.
- **Precision over recall, everywhere.** When confidence is low, render nothing. A hotspot
  that opens the wrong figure is worse than no hotspot; a tool that silently does less is
  trusted, a tool that is confidently wrong is uninstalled.
- **Never render a dead affordance.** Unmatched mention → keep in manifest with
  `asset_id: null` and log a warning, but no clickable hotspot. Unresolved reference →
  plain text, no open button.
- Schema changes start in `packages/schema/manifest.schema.json`, then regenerate TS types
  with `npm run gen:schema` from `apps/web`. Never edit the generated `manifest.ts`.
- **This repo names no AI vendor.** It is a hackathon entry. Agent guidance belongs in this
  file; harness-specific files (`CLAUDE.md`, `.cursorrules`) stay untracked via
  `.git/info/exclude`, not `.gitignore`, so even the ignore rules name nobody. Commit
  messages included.
- Don't add features not in the spec or the plan. If something seems obviously missing,
  raise it as an open question rather than building it (spec §14).

## Dangerous areas

- **`extract/geometry.py`** — the single coordinate conversion. Double-converting or
  half-converting produces figures that render plausibly but in the wrong place, which is
  hard to spot by eye. Always covered by the top-half-of-page fixture test.
- **Caption self-reference exclusion** — the caption "Figure 1: Overview…" is *not* a mention
  of Figure 1. Without suppression, every figure gets a spurious self-mention and the reverse
  index becomes wrong on every paper.
- **arXiv API** — be polite: identify the client, rate-limit, cache every lookup. Getting
  blocked mid-build costs the deadline.
- **Do not put this repo back in OneDrive.** See below.

## Known edge cases

- **OneDrive breaks Python and Node installs.** This repo previously lived under
  `C:\Users\andzh\OneDrive\...` and uv failed with `os error 396` (hardlink unsupported) and
  `os error 32` (file locked mid-write) because OneDrive syncs files while installers write
  them. `node_modules` would be far worse. The repo was moved to `C:\dev\research-assistant`
  for this reason. Keep it out of synced folders.
- **System Python is 3.14**, which may lack PyMuPDF wheels. The project pins 3.12. If
  `import fitz` fails, check `.python-version` before debugging anything else.
- Mention text hazards, each a real bug report: ranges ("Figures 2–4" → three mentions),
  hyphenation across line breaks ("Fig-\nure 3"), ligatures (`ﬁ` → `fi`), appendix numbering
  ("Figure S3", "Figure A.1") — and appendix figures can **restart numbering**, so a bare
  `(kind, number)` key can collide with a body figure.
- Subfigures: `3a` is a distinct asset with `parent_id: "fig-3"`. If subregion detection
  fails, fall back to the parent crop rather than rendering nothing.
- Dark mode must invert the page canvas but **not** figure crops — inverting a
  white-background plot makes it unreadable and inverting a photo destroys it.

## Keeping this file current

When a session gets corrected, discovers a non-obvious detail, or finds this file wrong,
update the relevant section — see the `capturing-lessons` skill.
