# Stage 6 integration and acceptance audit

This audit supersedes completion claims in the earlier handoff snapshots. It was performed
against production imports and routes, not just the existence of factories or components.

Status meanings:

- **COMPLETE** — implemented, composed in production, and covered by an automated or live
  non-visual check appropriate to the feature.
- **COMPLETE WITH DOCUMENTED LIMITATION** — usable implementation exists and fails closed,
  but a stated confidence, data, or browser-acceptance limit remains.
- **UNMEASURED** — the required labelled data or accessibility tooling does not exist.
- **BLOCKED** — the acceptance action could not be performed in this environment.

## Shared/core checklist

| Feature | Status | Evidence / limitation |
|---|---|---|
| `ResearchContext` and selection context | COMPLETE | Built from pdf.js selection/page state; no server mention index. |
| `SourceEvidence` | COMPLETE | One canonical constructor path and canonical digest paper IDs. |
| Evidence ID generation | COMPLETE | Deterministic, type-specific identity; passage/citation collision regressions covered. |
| Canonical paper IDs | COMPLETE | `sha256:` is normalized at the shared boundary and in persisted migrations. |
| Metadata evidence | COMPLETE | Publication chronology is typed separately from page evidence. |
| Evidence resolver and validation | COMPLETE | Invalid page, asset, citation, kind, bbox, and unavailable paper fail closed. |
| Evidence navigation | COMPLETE | Shared href/navigation helpers carry paper, page, evidence ID, asset, and bbox. |
| Reader deep links | COMPLETE WITH DOCUMENTED LIMITATION | Hash parsing, exact page/evidence focus, reduced motion, and cross-paper links are tested; browser interaction is blocked below. |
| Provider composition | COMPLETE | Indexed cross-paper and learning providers are instantiated together in the collection production flow. |
| `ResearchGraph` | COMPLETE | Macro research views reuse the common graph model. |
| Persistence interfaces | COMPLETE | Collections, board, evidence, and learning progress use IndexedDB repositories. |
| Literal/generated/user relationship typing | COMPLETE | Citation, chronology, generated, and user-created relationships remain distinct. |
| Fail-closed behavior | COMPLETE | Invalid evidence and unsupported scored relationships render unavailable/explore-only states. |
| Generated-content policy | COMPLETE | No LLM calls were added; no generated claim is authoritative or silently scored. |

## Developer A checklist

| Feature | Status | Evidence / limitation |
|---|---|---|
| Selection/highlight intelligence | COMPLETE WITH DOCUMENTED LIMITATION | Production-mounted and source-grounded; browser selection acceptance is blocked below. |
| Selection action menu | COMPLETE WITH DOCUMENTED LIMITATION | Pin, Trace, Explain, Visualize, Play, Evidence Hunt, Copy, and Understand are mounted. |
| Pin | COMPLETE | Selection evidence is validated and persisted as canonical evidence. |
| Trace / Concepts / Concept Threads | COMPLETE | Ordered exact occurrences, section groups, nearby assets, citation landmarks, and exact links use canonical IDs. |
| Explain | COMPLETE WITH DOCUMENTED LIMITATION | Deterministic paper context only; no generated prose is presented as paper truth. |
| Visualize / micro visualizations | COMPLETE WITH DOCUMENTED LIMITATION | Controlled `MiniDiagram` data only; unsupported topology is not guessed. |
| Play | COMPLETE WITH DOCUMENTED LIMITATION | Visible challenge catalog; unsupported challenge generation is visibly unavailable. |
| “I Don’t Understand This” | COMPLETE | Deterministic break-down, prerequisite, visualize, trace, and interactive actions reuse the learning layer. |
| Learning objects | COMPLETE | Concepts, claims, experiments, passages, and source evidence are deterministic. |
| Difficulty regions and heatmap | COMPLETE | Relative deterministic signals; no absolute comprehension claim. |
| Prerequisite graph | COMPLETE WITH DOCUMENTED LIMITATION | Source-derived dependencies and suggested/generated prerequisites are labelled separately. |
| Learn Mode | COMPLETE WITH DOCUMENTED LIMITATION | Visible `Read / Learn / Quest` switch and non-invasive affordances; visual acceptance blocked. |
| Quest Mode / Paper Quest | COMPLETE WITH DOCUMENTED LIMITATION | Visible section checkpoints with bounded challenge frequency and persisted completion. |
| Challenge engine, validation, rendering shell | COMPLETE | Scored challenges require resolvable evidence; invalid specs render nothing. |
| Quick Quiz | COMPLETE WITH DOCUMENTED LIMITATION | Source-grounded multiple choice, feedback, retry, exact evidence; browser playthrough blocked. |
| Concept Match | COMPLETE WITH DOCUMENTED LIMITATION | Dedicated choice interaction and evidence path; native keyboard controls. |
| Ordering | COMPLETE WITH DOCUMENTED LIMITATION | Author section order with keyboard move controls. |
| Figure Build / Build Diagram | COMPLETE WITH DOCUMENTED LIMITATION | Controlled concept-to-source diagram; no guessed image topology. Unsupported cases fail closed. |
| Figure Detective | COMPLETE WITH DOCUMENTED LIMITATION | Uses the actual manifest crop with caption hidden and literal caption choices. |
| Evidence Hunt | COMPLETE WITH DOCUMENTED LIMITATION | Selected passage is evaluated as exact/close/incorrect with retry and expected evidence. |
| Prediction | COMPLETE WITH DOCUMENTED LIMITATION | Predict-before-reveal is intentionally unscored; reported result stays linked to source evidence. |
| Claim vs Evidence | COMPLETE WITH DOCUMENTED LIMITATION | Created only when a claim literally names a source asset. |
| Paper Check | COMPLETE WITH DOCUMENTED LIMITATION | Five categories with category feedback; fails closed if complete grounded coverage is unavailable. |
| Prerequisite Challenge | COMPLETE WITH DOCUMENTED LIMITATION | Dedicated ordered dependency mechanic; absent literal dependency is unavailable. |
| Thread Expedition | COMPLETE WITH DOCUMENTED LIMITATION | Dedicated occurrence-order mechanic tied to Concept Threads. |
| Paper vs Paper | COMPLETE WITH DOCUMENTED LIMITATION | Reachable from a collection and requires literal evidence in both papers. |
| Timeline Challenge | COMPLETE | Scored only from publication-date `MetadataEvidence`. |
| Evolution Challenge | COMPLETE WITH DOCUMENTED LIMITATION | Unsupported order is exploratory/unscored; only resolvable literal-citation provenance can score. Chronology is handled by Timeline with both dates. |
| Mastery/progress state | COMPLETE | Challenge completion, concept mastery, and current quest section persist in IndexedDB. |
| Evidence navigation and details | COMPLETE | The clicked evidence, not the first challenge item, drives both details and navigation. |
| Retry behavior | COMPLETE | Incorrect generic answers remain revisable; retry resets response state. |
| Keyboard flows | COMPLETE WITH DOCUMENTED LIMITATION | Native controls and explicit move alternatives exist; end-to-end browser keyboard audit is blocked. |

## Developer B checklist

| Feature | Status | Evidence / limitation |
|---|---|---|
| Figure Atlas | COMPLETE WITH DOCUMENTED LIMITATION | Manifest assets only, graceful crop failure, observed mention counts, exact source, Pin. |
| Paper Map | COMPLETE WITH DOCUMENTED LIMITATION | Manifest sections/assets and observed citations; exact source and Pin. |
| Citation Graph | COMPLETE | Literal resolved-reference edges only on the shared graph. |
| Citation Trail | COMPLETE WITH DOCUMENTED LIMITATION | Citing sentence/page, cited metadata, other occurrences, open paper, exact source, Pin. |
| Cross-paper context provider | COMPLETE | Production collection composition supports paper, neighbours, collection papers, and evidence resolution. |
| Learning context provider consumption | COMPLETE | Collection research displays concepts/difficulty without importing Dev A UI. |
| Collections | COMPLETE WITH DOCUMENTED LIMITATION | Create, rename, add/remove papers, notes, evidence, comparison, board, and reload persistence. |
| IndexedDB persistence | COMPLETE | Canonical versioned repository with migration; no competing localStorage path. |
| Pinboard / evidence pinning | COMPLETE WITH DOCUMENTED LIMITATION | Verified source nodes and user notes are separate; invalid sources lose active links. |
| Comparison | COMPLETE | Only resolved originals are labelled verified; notes/generated/unavailable remain distinct. |
| Collection search | COMPLETE | Bounded lexical search over title, sections, text, captions, references, and asset labels. |
| Dataset / benchmark browser | COMPLETE WITH DOCUMENTED LIMITATION | Literal lexical evidence only; no metric normalization beyond extraction confidence. |
| Research lineage | COMPLETE | Literal citation provenance and non-literal edge types remain distinct. |
| Paper / figure timeline | COMPLETE | Publication metadata and original assets; unknown dates remain explicit. |
| Constellation | COMPLETE | Shared graph with no inferred importance claim. |
| Author network | COMPLETE WITH DOCUMENTED LIMITATION | Observed names only; no identity reconciliation beyond safe literal strings. |
| Method network | COMPLETE WITH DOCUMENTED LIMITATION | Explicit paper-local method headings only; no method-equivalence inference. |
| Research workspace | COMPLETE WITH DOCUMENTED LIMITATION | Visible Collections, Pinboard, Compare, Search/Research routes. |
| Reflow | COMPLETE WITH DOCUMENTED LIMITATION | Semantic source order, exact return bbox, figure/citation links; ambiguous order fails closed. |
| Typography / contrast / reading width | COMPLETE WITH DOCUMENTED LIMITATION | Visible controls; browser visual acceptance blocked. |
| Responsive reader | COMPLETE WITH DOCUMENTED LIMITATION | Resize-driven page width and overlay scaling are unit/build checked; viewport walkthrough blocked. |
| Reduced motion | COMPLETE | Shared preference helper removes smooth evidence/page navigation. |
| Keyboard navigation | COMPLETE WITH DOCUMENTED LIMITATION | Native controls plus overlay/board arrow movement; browser-only focus audit blocked. |
| Semantic/screen-reader structure | COMPLETE WITH DOCUMENTED LIMITATION | Headings, regions, labels, status/live output, dialog semantics; assistive-tech audit unmeasured. |
| Read aloud | COMPLETE WITH DOCUMENTED LIMITATION | Feature-detected Speech Synthesis consumes reflow paragraphs; audible QA blocked. |
| Source navigation | COMPLETE | All production research surfaces use the shared evidence navigation path. |
| Route discoverability | COMPLETE WITH DOCUMENTED LIMITATION | Reader exposes `Read / Explore / Workspace / Reflow`; visual walkthrough blocked. |

## Extraction and evaluation status

| Item | Status | Evidence / limitation |
|---|---|---|
| Attention Table 2/3 crop extent | COMPLETE WITH DOCUMENTED LIMITATION | Conservative real-geometry row growth fixes the reproduced truncation; both crops were rendered and inspected. |
| Figure-region IoU | UNMEASURED | No hand-labelled bounding boxes. |
| Caption-attachment accuracy | UNMEASURED | No hand-labelled attachment set. |
| Mention precision/recall | COMPLETE WITH DOCUMENTED LIMITATION | 100% / 100% on two labelled pages of one paper; this is only a smoke test. |
| Product metrics | UNMEASURED | No product instrumentation or user study. |

## Verification snapshot

- Web: **45 files, 215 tests passed**.
- API/extraction: **152 tests passed**, with one upstream deprecation warning.
- TypeScript: `npx tsc --noEmit` passed with no output.
- Production build: Next.js 16.2.10 build passed; all reader, explore, reflow, workspace,
  board, comparison, and research routes were generated.
- Live process checks: API health, Attention manifest, Reader deep-link URL, Explore,
  Reflow, paper Workspace, and Workspace index returned HTTP 200.
- Extraction eval on the locally available Attention fixture: 9/9 caption openers found,
  1.2s normalized 15-page wall time, IoU UNMEASURED.
- Mention eval: 14/14 observed mentions resolved; 100% precision/recall on the two labelled
  pages only.
- There is no lint script in `apps/web/package.json`.

## Required 1–77 browser acceptance

The in-app browser controller returned **“No browser is available”**, and its browser list
was empty even after the required bootstrap troubleshooting. The browser skill forbids
substituting an unrelated standalone automation stack. Therefore the actual visual and
interactive walkthrough for steps **1–77 is BLOCKED** in this environment. Route HTTP 200,
unit tests, typecheck, build, source inspection, and rendered extraction crops are supporting
evidence, but they are not represented as a completed browser walkthrough.

The next acceptance run must execute all 77 steps in a real browser, including keyboard-only,
focus, Escape, reduced-motion, narrow viewport, IndexedDB reload, dual-paper navigation, and
screen-reader-semantic inspection. Do not change this status to complete based only on the
automated gates above.

## Stage 7 — Visual Learning & Evidence Graph acceptance

Implemented and automated/live-service verified:

- provider-neutral local generation boundary and availability UX;
- structured `VisualLearningSpec` / `VisualChallengeSpec` generation, cache, repair, and
  deterministic fallback;
- stable-ID multiple-choice scoring regression across every answer position;
- React Flow + Motion visual runtime, keyboard alternatives, reduced-motion behavior, and
  Mermaid secondary rendering;
- dynamic visual-game generation from bounded `ResearchContext`, with multiple choice only a
  fallback;
- literal-label and explicit-order validation for scored generated components/flows;
- evidence-native `ResearchGraph`, conservative claim detection, `EvidencePacket`, Trace Claim,
  Evidence Coverage, Investigator, provenance display, evidence-chain persistence, and bounded
  cross-paper tension candidates;
- Claim vs Evidence, Evidence Hunt, Reconstruct Experiment, and exploratory Compare Evidence
  games using the canonical graph.

Live probes used the locally installed configured model. A source-described encoder request
returned a scored `build-flow` only after validation removed invented Input/Output nodes. A rich
Attention EvidencePacket produced a concise interpretation citing three packet evidence IDs; an
insufficient packet returned `insufficient-evidence`. Stopping both local runtime processes made
AI status report `service-unavailable` while Reader continued returning 200; service was then
restarted successfully.

Current gates: **53 web files / 251 tests**, **152 Python tests**, TypeScript clean, production
build passed, no lint script. `npm audit` reports two moderate findings in Next's bundled PostCSS;
the proposed force fix is an invalid breaking downgrade and was not applied.

Browser acceptance for both the original 1–77 flow and the new 1–21 evidence workflow remains
**BLOCKED**: browser discovery returned an empty list. HTTP 200, tests, source inspection, and
live model calls do not prove visual animation, focus order, drag behavior, mobile layout, or
reload persistence in an actual browser.
