# Marginalia

### Research papers were designed to be printed. Marginalia makes them interactive.

Marginalia is an evidence-grounded research environment for reading, understanding, exploring, and learning from scientific papers.

Instead of replacing papers with AI summaries, Marginalia keeps the **original research as the source of truth** and builds an interactive layer around it:

**Read → Trace → Visualize → Build → Investigate → Explore**

A figure mentioned three pages away can open beside the paragraph discussing it. A difficult concept can become an animated diagram. A scientific claim can be traced through its evidence, experiment, results, and citations. A learner can reconstruct a methodology instead of answering another generic multiple-choice question.

The core philosophy is simple:

> **Do not replace research with a summary. Reorganize, connect, expose, and interact with the original evidence.**

And for AI:

> **AI can interpret the research, but it never becomes the authority. The paper remains the authority.**

---

# Why Marginalia?

Research PDFs contain some of the world's most important knowledge, but they are still distributed through an interface designed primarily for printing.

Reading a technical paper often means constantly:

* scrolling between a figure and the paragraph referencing it,
* searching for definitions introduced pages earlier,
* navigating dense citation chains,
* interpreting complex experimental pipelines,
* understanding how claims connect to evidence,
* comparing results across papers,
* decoding two-column layouts,
* and manually reconstructing how concepts evolve throughout a paper.

AI summarizers solve a different problem.

They often remove the reader from the primary research.

Marginalia takes the opposite approach.

It asks:

> **What if a scientific paper behaved like a modern interactive knowledge environment?**

The PDF remains present.

The evidence remains inspectable.

Marginalia adds the missing relationships.

---

# The Core Experience

Marginalia is organized around three primary actions:

## 01 — TRACE

Understand where knowledge comes from.

```text
Claim
  ↓
Evidence
  ↓
Experiment
  ↓
Result
  ↓
Citation
  ↓
Prior Work
  ↓
Original Source
```

## 02 — EXPLORE

Understand how research connects.

```text
Papers
  ↓
Concepts
  ↓
Methods
  ↓
Experiments
  ↓
Evidence
  ↓
Research Lineage
```

## 03 — LEARN

Learn by interacting with the research itself.

```text
Visualize
  ↓
Trace
  ↓
Build
  ↓
Predict
  ↓
Find Evidence
  ↓
Verify Against Source
```

Everything eventually leads back to original evidence.

---

# Demo Highlights

Marginalia contains a large research workspace, but the strongest demo experience is intentionally focused around one cohesive flow:

# READ → UNDERSTAND → TRACE → PLAY → INVESTIGATE → EXPLORE

---

## 1. Intelligent Research Reader

Open a scientific paper normally.

When the paper says:

> “As shown in Figure 2…”

Marginalia can open the referenced figure without forcing the reader to lose their reading position.

Figure and table references become contextual research interactions rather than scavenger hunts through a PDF.

Citation references can similarly connect the reader to cited research.

This is the foundation of Marginalia.

---

## 2. Select Difficult Research

Highlight a difficult passage.

Marginalia creates a bounded `ResearchContext` around the selected evidence.

The contextual interaction layer can expose actions such as:

```text
Pin | Trace | Explain | Visualize | Play
```

AI is not blindly given an entire document.

It receives controlled research context connected to canonical evidence.

---

# 3. Visualize — Don't Just Summarize

One of the largest current improvements to Marginalia is moving away from text-first AI explanations.

Instead of:

```text
Research passage
      ↓
AI summary
      ↓
A/B/C/D quiz
```

Marginalia is moving toward:

```text
Research evidence
      ↓
Extract structure
      ↓
Visualize structure
      ↓
Animate relationships
      ↓
Manipulate the concept
      ↓
Verify against source
```

For example, a passage describing attention could become:

```text
Query ──┐
        ├──→ Q × Kᵀ
Key ────┘
             ↓
           Scale
             ↓
          Softmax
             ↓
Value ─────→ Weighted Values
             ↓
           Output
```

But the diagram is not merely static.

Marginalia can progressively animate:

1. inputs appearing,
2. relationships connecting,
3. transformations activating,
4. information flowing,
5. outputs appearing.

The goal is:

> **Don't explain something with a paragraph when the learner can see it move.**

---

# 4. Visual Learning Canvas

Generated visual learning experiences use a controlled structured representation rather than allowing the model to generate arbitrary application code.

Conceptually:

```text
Selected SourceEvidence
        ↓
Bounded ResearchContext
        ↓
AI / deterministic generation
        ↓
VisualLearningSpec
        ↓
Schema validation
        ↓
Evidence validation
        ↓
React renderer
        ↓
React Flow + SVG + Motion
        ↓
Interactive visual experience
```

The model determines **what should be represented**.

Marginalia determines **how it can safely be rendered**.

This keeps generated learning experiences inside controlled application primitives.

---

# 5. Explore → Trace → Build → Challenge

Visual learning is organized around four understandable interactions.

## Explore

> Show me what this is.

Users can inspect components, concepts, evidence, and relationships.

## Trace

> Show me how this works.

Marginalia progressively animates a process or evidence path.

## Build

> Let me reconstruct it.

Users manipulate the visual structure themselves.

## Challenge

> Make me prove I understand it.

Marginalia chooses an evidence-appropriate visual interaction.

This makes the same underlying visualization reusable across multiple learning experiences.

---

# 6. Visual Games

Marginalia's game layer is being redesigned around manipulating research rather than answering generic quizzes.

The original challenge architecture includes:

* Quick Quiz
* Concept Match
* Build Figure / Diagram
* Figure Detective
* Evidence Hunt
* Predict Before Reveal
* Claim vs Evidence
* Paper Check
* Paper vs Paper
* Timeline Challenge
* Evolution Challenge

Multiple choice remains available as a fallback, but it is no longer intended to dominate the learning experience.

---

## Build the Diagram

A verified process:

```text
Input → Encoder → Attention → Output
```

can become:

```text
[Attention]          [Input]

       [Output]       [Encoder]
```

The learner reconstructs the system.

Correct relationships receive visual feedback.

Incorrect relationships remain editable and can provide source-grounded hints.

---

## Connect Concepts

Instead of selecting from dropdowns:

```text
Query          Requested information

Key            Matching representation

Value          Retrieved information
```

the learner physically connects related concepts.

The relationships themselves become the game.

---

## Missing Component

Marginalia can remove a verified part of a process:

```text
Tokens
  ↓
Embedding
  ↓
   ?
  ↓
Output
```

The learner places the missing component into the structure.

---

## Reconstruct the Experiment

Experimental methodology can become an interactive pipeline:

```text
Dataset
   ↓
Preprocessing
   ↓
Model
   ↓
Evaluation
   ↓
Results
```

The learner reconstructs the experiment using source-backed steps.

---

## Figure Detective

Figure Detective uses the actual extracted research figure.

When reliable figure-region evidence exists, Marginalia can:

* spotlight regions,
* zoom into relevant components,
* ask the learner to identify a component,
* reveal the correct source region,
* connect the result to the authors' explanation.

Marginalia does not fabricate figure regions when reliable region information is unavailable.

---

## Evidence Hunt

The PDF itself becomes the game surface.

Example:

> Find where the authors explain why multiple attention heads are useful.

Instead of selecting A/B/C/D, the learner searches the actual research and identifies the supporting passage.

The interaction teaches research navigation and evidence literacy simultaneously.

---

## Predict Before Reveal

The learner sees the experiment before the result.

They may:

* predict a trend,
* rank expected outcomes,
* place an endpoint,
* or make another appropriate visual prediction.

Then:

```text
REVEAL PAPER RESULT
```

The actual source result appears.

Prediction is generally exploratory rather than falsely treated as source truth.

---

# 7. Concept Threads

Research concepts rarely appear once.

A concept might be:

introduced,
defined,
used in a method,
shown in a figure,
tested experimentally,
and discussed again in the conclusion.

Marginalia's Concept Thread system follows deterministic occurrences of a concept throughout a paper.

The visual direction turns this into a research journey:

```text
INTRO ●──────● DEFINITION
                \
                 ● METHOD
                    \
                     ● FIGURE
                       \
                        ● EXPERIMENT
                           \
                            ● CONCLUSION
```

Each node can return directly to the corresponding source occurrence.

This makes the evolution of an idea through a paper visible.

---

# 8. Prerequisite Maps

When a learner encounters a difficult concept, Marginalia can expose the concepts needed to understand it.

Example:

```text
             Multi-Head Attention
                      │
                  Attention
                  /       \
          Dot Product     Softmax
                \          /
                   Vectors
```

The architecture distinguishes between:

* source-derived relationships,
* AI-suggested prerequisites.

Generated suggestions are never silently presented as literal paper relationships.

---

# The Evidence Graph

The newest architectural expansion makes **scientific evidence relationships** a central product primitive.

Previously, evidence grounding primarily protected features such as navigation and challenge validation.

Marginalia now pushes that architecture further.

Scientific papers are not collections of isolated facts.

They contain networks of:

```text
Claims
  ↓
Evidence
  ↓
Methods
  ↓
Experiments
  ↓
Results
  ↓
Citations
  ↓
Prior Research
```

PDFs flatten those relationships into pages.

Marginalia reconstructs them.

---

# Why Add More Evidence Architecture?

This change is important because scientific research requires nuance.

A model should not simply read two paragraphs and announce:

> “Paper B disproves Paper A.”

Scientific results can differ because of:

* experimental conditions,
* datasets,
* metrics,
* populations,
* baselines,
* methodology,
* assumptions,
* limitations,
* or scope.

Likewise, failing to automatically locate evidence does not mean a scientific claim is false.

Marginalia therefore uses careful evidence states such as:

* direct support located,
* partial or qualified support located,
* multiple supporting sources located,
* no confident direct support located in indexed content,
* evidence relationship uncertain,
* generated candidate relationship.

This preserves nuance.

The system is designed to say:

> “No confident direct supporting relationship was located in the currently indexed evidence.”

rather than:

> “This claim is false.”

That distinction is fundamental to responsible research tooling.

---

# SourceEvidence

At the center of the architecture is a canonical `SourceEvidence` representation.

Evidence can point back to structures such as:

* paper,
* page,
* passage,
* figure,
* table,
* equation,
* caption,
* citation,
* bounding region.

This allows generated experiences to remain connected to the research.

A core invariant is:

> **No scored generated challenge should be treated as correct unless its expected answer is grounded by resolvable SourceEvidence.**

When confidence is low:

> **Render less, not more.**

---

# Evidence Graph

The Evidence Graph can represent relationships such as:

```text
Paper
 │
 ├── Claim
 │     │
 │     ├── Evidence
 │     │      ├── Figure
 │     │      ├── Table
 │     │      └── Passage
 │     │
 │     ├── Method
 │     │
 │     └── Experiment
 │
 ├── Result
 │
 └── Citation
        │
        ↓
      Paper
```

Relationships remain explicitly typed.

Examples include:

* supports
* reports-result
* produced-by
* uses-method
* evaluated-on
* compares-against
* cites
* contains
* mentions
* qualifies
* user-connected
* generated-related

Most importantly:

```text
LITERAL SOURCE RELATIONSHIP
≠
GENERATED / INFERRED RELATIONSHIP
≠
USER-CREATED RELATIONSHIP
```

They must never silently collapse into the same meaning.

---

# Trace This Claim

A scientific claim can become an evidence trail.

Example:

```text
                         CLAIM
                           │
             ┌─────────────┴─────────────┐
             ↓                           ↓
          TABLE 2                     FIGURE 4
             │                           │
             └─────────────┬─────────────┘
                           ↓
                       EXPERIMENT
                           │
                         DATASET
                           │
                         METHOD
                           │
                      COMPARATORS
                           │
                       CITATIONS
```

Users can inspect each node and return to the original research.

This turns evidence provenance into something visible and explorable.

---

# Evidence Packets

Marginalia can assemble bounded evidence packets around a research question or claim.

An Evidence Packet may contain:

* canonical claim text,
* supporting evidence,
* reported results,
* figures,
* tables,
* experimental setup,
* methodology,
* dataset or benchmark,
* baselines,
* limitations,
* citations,
* exact source locations.

This creates a safer foundation for AI interpretation.

Instead of asking a model:

> “Is this claim correct?”

Marginalia can first construct:

```text
CLAIM
 ↓
SUPPORTING EVIDENCE
 ↓
EXPERIMENTAL CONDITIONS
 ↓
COMPARATORS
 ↓
RESULT
 ↓
LIMITATIONS
 ↓
CITATIONS
```

and only then request an interpretation.

---

# Marginalia Research Investigator

This evidence architecture enables a more genuinely agentic research workflow.

Example question:

> Why do the authors believe this method works?

Marginalia does not need to immediately produce a generic AI response.

The Research Investigator can instead:

```text
Locate relevant claims
        ↓
Inspect supporting passages
        ↓
Inspect referenced figures
        ↓
Inspect supporting tables
        ↓
Inspect experiment context
        ↓
Follow relevant citations
        ↓
Construct Evidence Graph
        ↓
Assemble Evidence Packet
        ↓
Generate interpretation
        ↓
Attach interpretation to sources
```

The interface can transparently expose progress such as:

```text
Locating claims…
Inspecting Figure 3…
Checking Table 2…
Following citation [12]…
Building evidence chain…
Preparing interpretation…
```

No fake percentages are required.

---

# Source vs Interpretation

Marginalia explicitly separates research evidence from generated interpretation.

Example:

### SOURCE

Table 3 reports the result under the stated evaluation conditions.

### AI INTERPRETATION

The reported evidence appears consistent with the authors' claim under those conditions.

Generated interpretation never silently becomes source evidence.

---

# Why?

Users can challenge an interpretation by asking:

```text
WHY?
```

Marginalia does not expose private model chain-of-thought.

Instead it exposes structured provenance:

```text
AI Interpretation
       ↓
     Claim
       ↓
    Evidence
       ↓
   Experiment
       ↓
     Method
       ↓
  Prior Paper
       ↓
Original Evidence
```

This provides explainability through evidence rather than hidden reasoning.

---

# Cross-Paper Evidence

Marginalia can extend evidence reasoning across multiple papers.

Instead of automatically claiming contradiction, the system can surface:

* possible tension,
* differing reported result,
* potential qualification,
* agreement,
* extension,
* evidence worth comparing.

The user then inspects the original evidence from both papers.

This is intentionally conservative.

Semantic similarity is not treated as a citation.

Chronology is not treated as causation.

A generated relationship is not treated as a literal relationship.

---

# Trace to Origin

Citation relationships can become research provenance.

```text
CURRENT PAPER
      │
      ↓
   PAPER B
      │
      ↓
   PAPER A
      │
      ↓
 ORIGINAL METHOD
      │
      ↓
   FIGURE 2
      │
      ↓
  EXPERIMENT
```

This transforms citation exploration from a decorative network into an explanation of where research ideas originated.

---

# Research Explorer

Marginalia's Explore layer provides multi-paper research navigation.

Major surfaces include:

## Figure Atlas

Browse extracted figures and tables across a paper.

Figures remain connected to:

* captions,
* source pages,
* observed mentions,
* original paper locations.

## Paper Map

Visualize the structural organization of a paper using its sections, assets, and research relationships.

## Citation Graph

Explore literal citation relationships.

## Citation Trail

Follow citations while maintaining reading context.

## Research Lineage

Explore how papers and research artifacts connect over time.

## Paper Timeline

Explore chronological research structure where publication metadata supports it.

## Figure Timeline

Explore research figures across papers and time.

## Constellation View

Navigate broader research relationships.

## Author / Method Networks

Explore bounded networks while avoiding unsupported entity reconciliation or semantic inference.

---

# Workspace

Marginalia also provides persistent research organization.

Features include:

* Collections
* Pinboard
* verified evidence pinning
* cross-paper comparison
* collection search
* dataset / benchmark browsing
* research notes
* evidence persistence

IndexedDB provides the primary browser persistence layer for workspace state.

Evidence pins preserve canonical source relationships rather than requiring users to manually reconstruct unsupported source pointers.

---

# Read Mode

Read mode keeps Marginalia focused on serious research reading.

It includes:

* PDF reader
* figure/table interactions
* reverse mentions
* citation navigation
* side-by-side cited papers
* keyboard navigation
* pins and notes
* selection actions
* accessibility controls

Games do not automatically interrupt reading.

---

# Learn Mode

Learn mode adds optional understanding tools:

* difficulty indicators
* concept markers
* “I don't understand this”
* prerequisite maps
* Concept Threads
* explanations
* visualizations
* learning activities
* section checkpoints

The source paper remains visible.

---

# Quest Mode

Quest mode turns the paper into an active learning experience.

It can include:

* progression checkpoints
* visual challenges
* concept mastery
* Paper Quest paths
* evidence-based activities
* Paper Check

Quest layers interaction over the original research rather than replacing it with a separate lesson.

---

# Reflow & Accessibility

Research PDFs are often difficult accessibility surfaces.

Marginalia includes a semantic Reflow experience designed around:

* improved reading order,
* typography controls,
* spacing,
* contrast,
* keyboard interaction,
* screen-reader structure,
* reduced motion,
* read-aloud support where available.

The accessibility work is not merely cosmetic.

It addresses a fundamental problem:

> Scientific knowledge should not become harder to access simply because it is trapped inside a print-oriented PDF.

---

# UI Guardian Agent

Marginalia includes a dedicated architecture for an in-application **UI Guardian Agent**.

Its responsibility is not scientific reasoning.

Its goal is to protect the quality of dynamically generated interfaces.

The Guardian observes visual events such as:

```text
visual generated
game generated
evidence graph generated
graph expanded
viewport changed
theme changed
```

and follows:

```text
OBSERVE
   ↓
INSPECT
   ↓
DECIDE
   ↓
ACT
   ↓
VERIFY
```

It evaluates:

* graph overlap,
* node density,
* edge routing,
* text overflow,
* responsiveness,
* visual hierarchy,
* accessibility,
* game UI consistency,
* motion quality.

Safe presentation improvements can be applied automatically.

Scientific semantics cannot.

The invariant is:

> **UI improvement must never change research truth.**

The Guardian may adjust:

* node positions,
* spacing,
* edge routing,
* label wrapping,
* panel dimensions,
* animation timing.

It may never automatically change:

* SourceEvidence,
* correct answers,
* claims,
* experimental results,
* citations,
* literal scientific relationships.

---

# Local AI with Ollama

Marginalia's expanded visual-learning architecture supports local model execution through Ollama.

The current development setup uses an Ollama-hosted Gemma model for structured generation and experimentation.

The local model can assist with tasks such as:

* visual structure generation,
* candidate concept relationships,
* visual-learning specifications,
* challenge generation,
* optional UI critique,
* bounded evidence interpretation.

Local generation provides a path for experimentation without requiring every visual interaction to incur an external API cost.

However, local model output follows the same rule as any external model:

> **Generated content is not source evidence.**

---

# GPT-5.6

GPT-5.6 is used where stronger reasoning can materially improve the research experience.

The important point is not simply:

> “Marginalia uses GPT-5.6.”

The important part is what the model is asked to do.

Potential GPT-5.6 responsibilities include:

### Research interpretation

Interpret bounded Evidence Packets rather than blindly answering from general model knowledge.

### Visual structure generation

Transform difficult source-grounded research into controlled `VisualLearningSpec` structures.

### Challenge generation

Create candidate evidence-grounded learning interactions that must pass application validation before being displayed or scored.

### Research investigation

Assist the Research Investigator in reasoning across bounded:

* claims,
* evidence,
* methods,
* experiments,
* results,
* citations,
* limitations.

### Cross-paper analysis

Surface candidate:

* agreement,
* qualification,
* differing results,
* possible tension,

while preserving provenance and uncertainty.

GPT-5.6 is therefore used as a **reasoning layer over evidence**, not as a replacement for evidence.

---

# ChatGPT

ChatGPT has been used throughout Marginalia's product and architecture development for:

* feature ideation,
* research-workflow design,
* evidence architecture,
* game design,
* UX planning,
* system architecture,
* development prompts,
* acceptance criteria,
* debugging strategy,
* Dev A / Dev B integration review,
* demo planning,
* technical differentiation,
* safety and provenance design.

The project was iteratively designed through human + AI collaboration rather than generated from a single prompt.

---

# Codex CLI

Codex CLI has been a major implementation tool throughout development.

It has been used to:

* inspect the repository,
* implement staged architecture work,
* coordinate Dev A / Dev B integration,
* modify React / TypeScript application code,
* implement Python extraction changes,
* build tests,
* run TypeScript verification,
* run production builds,
* inspect Git state,
* debug integration problems,
* implement evidence contracts,
* repair routing and source navigation,
* improve game architecture,
* integrate visual-learning infrastructure,
* implement persistent application agents.

Codex was given architecture-level implementation briefs rather than isolated “write this component” requests.

This allowed development to remain aligned with Marginalia's system invariants.

---

# AI-Assisted Development Workflow

The development process follows approximately:

```text
Product problem
      ↓
ChatGPT architecture / UX exploration
      ↓
Detailed implementation specification
      ↓
Codex CLI repository inspection
      ↓
Implementation
      ↓
Tests
      ↓
TypeScript verification
      ↓
Production build
      ↓
Integration audit
      ↓
Targeted repair
      ↓
Acceptance QA
```

This workflow is particularly important because Marginalia contains multiple interacting systems:

* PDF extraction,
* browser PDF rendering,
* evidence navigation,
* visual learning,
* games,
* cross-paper graphs,
* persistence,
* accessibility,
* AI generation.

Changes cannot safely be treated as isolated UI tasks.

---

# Previous Development Agents / Roles

Marginalia's expansion was intentionally decomposed into specialized development responsibilities.

## Developer A — Learning & Interaction

Focused on turning research into interactive learning.

Responsibilities included:

* ResearchContext
* selection intelligence
* selection menu
* evidence navigation
* learning objects
* Concept Threads
* difficulty regions
* prerequisite graph
* Learn mode
* Quest mode
* challenge engine
* challenge rendering
* game types
* mastery / progress
* evidence-backed feedback
* cross-paper challenge logic

---

## Developer B — Exploration, Workspace & Accessibility

Focused on turning research into a connected workspace.

Responsibilities included:

* Figure Atlas
* Paper Map
* Citation Graph
* Citation Trail
* cross-paper context
* Collections
* Pinboard
* comparison
* research search
* dataset / benchmark browsing
* lineage
* timelines
* constellation
* author / method networks
* Reflow
* typography accessibility
* screen-reader structure
* read aloud
* persistence

The two developers were intentionally prevented from importing each other's UI.

They integrate through shared contracts and providers.

---

# Shared Contracts

Important shared architecture includes:

* `SourceEvidence`
* `ResearchContext`
* `ResearchGraph`
* `LearningObject`
* `ChallengeSpec`
* persistence interfaces
* cross-paper providers
* evidence navigation

Keeping these contracts explicit prevents the learning system, workspace, and research explorer from becoming tightly coupled.

---

# Precision-First Architecture

Marginalia deliberately prioritizes precision over recall.

Examples:

```text
Unmatched figure mention
→ no hotspot

Unresolved citation
→ no active citation navigation

Uncertain figure region
→ no clickable region target

Ambiguous challenge answer
→ do not score

Low-confidence evidence relationship
→ omit or label generated/inferred
```

This philosophy is particularly important because Marginalia operates over scientific research.

An incomplete interface is preferable to a confidently misleading one.

---

# Extraction Architecture

Marginalia preserves a strict language boundary.

## Python owns

* PDF ingestion
* figure/table/algorithm extraction
* PNG crops
* captions
* sections
* references
* arXiv resolution
* PDF geometry normalization
* static manifest generation

## TypeScript owns

* browser `pdf.js` text interactions
* figure/table mention detection
* citation marker detection
* hotspots
* reverse mentions
* reader interaction
* learning state
* visual learning
* games
* cross-paper client navigation

This prevents duplicate extraction pipelines from drifting apart.

---

# Coordinate Integrity

PDF geometry is normalized exactly once.

Any feature involving:

* evidence highlights,
* figure regions,
* hotspots,
* annotations,
* game targets,
* bounding boxes,

must consume the canonical coordinate model.

The application must not apply an additional “helpful” coordinate conversion.

---

# Research Graph

Marginalia uses a general graph architecture instead of creating unrelated graph formats for every feature.

The graph can represent entities such as:

* paper
* section
* concept
* claim
* evidence
* figure
* table
* experiment
* method
* dataset
* citation

This shared graph can power:

* Evidence Graph
* Citation Graph
* Paper Map
* Research Lineage
* Concept relationships
* cross-paper exploration
* games

---

# Technology

## Frontend

* Next.js
* React
* TypeScript
* PDF.js
* React Flow / `@xyflow/react`
* Motion
* Mermaid where appropriate
* Zod
* JSON-schema-driven validation

## Backend / Extraction

* Python
* PDF extraction pipeline
* canonical manifest generation
* normalized PDF geometry

## Persistence

* IndexedDB

## AI / Generation

* GPT-5.6
* Ollama
* Gemma
* structured generation
* evidence-grounded prompting

## Development

* Codex CLI
* ChatGPT
* Git / GitHub
* automated TypeScript tests
* Python tests
* production build verification

---

# Current Visual Improvement Priorities

Marginalia already has a broad feature architecture.

The current priority is not adding another 20 buttons.

It is making the strongest existing interactions **beautiful, visual, understandable, and reliable**.

These are the primary demo-quality UI targets.

---

## 🔴 Priority 1 — Visualize

This should be one of Marginalia's biggest wow moments.

The experience should feel like an animated scientific whiteboard.

Improve:

* graph layout,
* animation sequencing,
* node hierarchy,
* concise labels,
* evidence interactions,
* playback controls,
* responsive behavior.

The user should immediately understand:

> “Marginalia turned the research into something I can see.”

---

## 🔴 Priority 2 — Evidence Graph / Trace Claim

This should become the visual centerpiece of the evidence architecture.

Improve:

* clear Claim node hierarchy,
* evidence expansion,
* method / experiment relationships,
* edge provenance,
* progressive disclosure,
* smooth expansion animation,
* exact source interaction.

Avoid graph spaghetti.

The initial graph should be intentionally bounded.

---

## 🔴 Priority 3 — Build / Reconstruct Games

These should demonstrate that Marginalia does not merely ask questions.

Improve:

* draggable nodes,
* obvious drop/connection affordances,
* professional game canvas,
* visual feedback,
* retry behavior,
* animated completion,
* evidence reveal.

The user should feel like they are manipulating the research structure itself.

---

## 🔴 Priority 4 — Concept Threads / Thread Expedition

Turn the existing concept occurrence system into a visual research journey.

Improve:

* animated path,
* selected occurrence,
* section landmarks,
* figure landmarks,
* smooth source navigation,
* readable hierarchy.

This is one of the clearest examples of something a normal PDF reader cannot do.

---

## 🔴 Priority 5 — Figure Detective

Use the actual scientific figure.

Improve:

* figure presentation,
* spotlight interactions,
* zoom,
* region selection where verified,
* subtle correct/incorrect motion,
* exact source explanation.

Do not fabricate figure regions.

---

## 🔴 Priority 6 — Evidence Hunt

Make the PDF itself become the challenge.

Improve:

* prompt presentation,
* active search state,
* selected evidence interaction,
* retry behavior,
* source validation,
* completion feedback.

This strongly demonstrates Marginalia's evidence-literacy focus.

---

## 🔴 Priority 7 — Research Investigator

The Investigator should visually communicate that AI is actually investigating rather than instantly producing a paragraph.

Improve:

```text
Locating claim…
        ↓
Inspecting evidence…
        ↓
Checking Figure 3…
        ↓
Checking Table 2…
        ↓
Following citation…
        ↓
Building evidence chain…
        ↓
Interpretation
```

Then show:

Evidence Graph + concise answer.

Not:

giant AI response.

---

## 🟠 Priority 8 — Paper Map / Citation Graph

These are major Explore-mode demo surfaces.

Improve:

* graph layout,
* labels,
* progressive expansion,
* meaningful edge types,
* paper selection,
* exact navigation,
* provenance.

The user should understand WHY two nodes are connected.

---

## 🟠 Priority 9 — Paper vs Paper

Make comparison visual.

Show two structures side-by-side.

Allow:

* concept correspondence,
* evidence comparison,
* method differences,
* result differences,
* source inspection.

Do not lead with large comparison paragraphs.

---

## 🟠 Priority 10 — Prerequisite Graph

Make it feel like a professional research skill tree.

Users should be able to understand:

```text
What do I need to understand first?
```

without reading another generated essay.

---

# UI Quality Standard

Every major visual should satisfy:

```text
NO overlapping nodes

NO graph spaghetti

NO giant AI paragraphs

NO clipped controls

NO broken responsive layout

NO meaningless animation

NO raw generated JSON

NO inaccessible drag-only interactions

NO semantic changes made purely for aesthetics
```

Marginalia should visually feel like:

> **a premium scientific research environment**

not:

* a developer graph demo,
* a generic AI chatbot,
* a dashboard full of cards,
* or a children's educational game.

Motion should explain.

Graphs should communicate.

Games should teach.

Evidence should remain inspectable.

---

# Golden Demo Flow

For demonstrations, prioritize this sequence:

```text
OPEN PAPER
     ↓
CLICK FIGURE REFERENCE
     ↓
FIGURE OPENS IN CONTEXT
     ↓
SELECT DIFFICULT PASSAGE
     ↓
VISUALIZE
     ↓
ANIMATED SCIENTIFIC DIAGRAM
     ↓
TRACE CONCEPT
     ↓
CONCEPT THREAD
     ↓
BUILD / PLAY
     ↓
RECONSTRUCT THE IDEA
     ↓
SHOW EVIDENCE
     ↓
EXACT ORIGINAL PDF SOURCE
     ↓
TRACE CLAIM
     ↓
EVIDENCE GRAPH
     ↓
ASK WHY
     ↓
RESEARCH INVESTIGATOR
     ↓
FOLLOW CITATION
     ↓
CROSS-PAPER EXPLORATION
```

This demonstrates the entire Marginalia philosophy without requiring every feature in the application to receive equal demo time.

---

# What Makes Marginalia Different?

Marginalia is not trying to become:

> another chatbot that reads PDFs.

Its differentiation comes from combining:

### Source-aware reading

Figures, tables, citations, and passages remain navigable.

### Evidence-native AI

Generated interpretations are attached to source evidence.

### Visual understanding

Complex research becomes diagrams, flows, timelines, and interactive structures.

### Active learning

Users reconstruct concepts rather than only answering quizzes.

### Research provenance

Claims can be traced through evidence and prior work.

### Cross-paper exploration

Research relationships become explorable without silently turning semantic similarity into fact.

### Accessibility

Print-oriented research becomes a more usable modern reading environment.

### Agentic investigation

AI can traverse bounded research artifacts before producing an interpretation.

---

# Guiding Principles

## The paper remains the authority.

AI supplements research. It does not replace it.

## Every important generated interaction should return to evidence.

Source navigation is part of the experience, not a footnote.

## When confidence is low, render less.

Precision matters more than generating something impressive-looking.

## Literal and generated relationships are different.

Never silently merge them.

## Don't explain something with a paragraph when the learner can see it move.

Use visual structure.

## Don't ask what someone understood when they can rebuild the idea themselves.

Use interaction.

## Games should teach research reasoning.

Not arbitrary gamification.

## Motion should explain.

Not decorate.

## Complex research deserves nuance.

Evidence relationships should preserve conditions, limitations, and uncertainty.

---

# Vision

Scientific papers should not feel like static archives.

They should behave like living knowledge environments.

Marginalia is building toward a research experience where a reader can:

**read the original work,**

**see difficult ideas move,**

**trace concepts through a paper,**

**reconstruct experiments,**

**investigate claims,**

**follow evidence to its origin,**

**compare research across papers,**

and always return to:

# the original evidence.

---

**Marginalia — read the research, trace the evidence, and interact with the ideas.**
