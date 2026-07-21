# Developer B Expansion Completion Audit (historical snapshot)

> **Superseded by `STAGE_6_INTEGRATION_ACCEPTANCE.md`.** The earlier audit checked library
> coverage but overstated live-browser verification and did not prove that every surface was
> composed into the product. Stage 6 re-audited production routes, shared evidence identity,
> provider composition, persistence, and fail-closed behavior. The full browser walkthrough
> remains blocked because no in-app browser was available.

Audited against `MARGINALIA_EXPANSION_ARCHITECTURE_AND_DEV_SPLIT (1).md` Developer B
primary ownership and detailed sections B1–B12 / 10 / 11 / 12.

| Requirement | Implementation |
|---|---|
| Cross-paper citation navigation | Lazy open/ingest/expand in `CitationGraph`; literal source trails |
| Citation graph / trail | Shared `ResearchGraph`, observed openable edges only, sentence/page provenance |
| Figure Atlas | Explore Figures tab, original crops/captions/reverse mentions/source links |
| Paper Map | Manifest section hierarchy, assets, observed citations, source links |
| Collections / persistence | Versioned `WorkspaceRepository` over one IndexedDB store; v1→v2 migration |
| Cross-paper search | Collection lexical index over all six specified source fields |
| Figure/table/passages comparison | User-selected `SourceEvidence` side-by-side; no generated claims |
| Research lineage | User-selected subgraph; literal/generated edge semantics retained |
| Paper / figure timelines | Deterministic arXiv chronology, unknown dates explicit, original figures |
| Constellation | Shared graph, literal citation edges, fixed node radius with no importance claim |
| Research pinboard | Persisted source nodes, positions, keyboard/drag movement, user-only edges |
| Dataset / benchmark browser | User-term lexical browsing of original mentions/tables/captions; no metric normalization |
| Author / method networks | Observed-reference coauthors; paper-local explicit method headings only |
| Cross-paper context provider | UI-independent paper/neighbour/collection/evidence contract |
| Reader reflow | Geometry-gated semantic headings/paragraphs; uncertain order falls back to PDF |
| Typography / contrast / motion | Independent visible controls in semantic reader |
| Screen-reader semantics | Native hierarchy, captions, figure/source labels, pages, live status |
| Read aloud | Feature-detected Speech Synthesis over reflow paragraphs only |
| General keyboard accessibility | Native controls, J/K paragraph navigation, non-drag board movement |

## Current verification snapshot

- Web: 45 Vitest files, 215 tests passed
- API/extraction: 152 Pytest tests passed
- TypeScript: `tsc --noEmit` passed
- Next.js: production build passed
- Live HTTP: API health/manifest and Reader, Explore, Reflow, and Workspace routes returned 200
- Live browser: **BLOCKED** — the in-app browser backend reported no available browser

The shared reader routing slot is no longer untouched: Reader now visibly exposes Explore,
Workspace, Reflow, and `Read / Learn / Quest`, and it consumes exact evidence deep links.
This document must not be used to claim visual completion; see the current audit for the
per-feature status and remaining acceptance gate.
