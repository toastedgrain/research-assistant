Marginalia
See how research works — not just what it says.

Scientific knowledge is published as networks of claims, evidence, figures, concepts, and citations, but consumed as flat PDFs.

Marginalia makes those hidden relationships interactive. Researchers can trace claims back to evidence, open referenced figures without losing their place, follow concepts through a paper, explore citation networks, compare research visually, and learn through interactions grounded in the original source.

Live Demo — Core Research Experience: [LIVE WEBSITE URL]
Video Demo — Full Experience + Local AI: [YOUTUBE DEMO URL]
GitHub — Source + Local Setup: https://github.com/toastedgrain/research-assistant

Judging Note — Local AI: Marginalia's Visualize and generated interactive learning games currently use local inference through Ollama and are therefore not available in the hosted deployment. The live application demonstrates Marginalia's deterministic research, evidence, navigation, graph, and workspace systems. The <3-minute demo video shows the complete experience, including Visualize and interactive learning games.

Recommended judging path

Watch the <3-minute demo first. It shows the complete Marginalia experience, including local AI generation. Then use the live deployment to directly explore the core research and evidence systems.

Run Marginalia Locally
git clone https://github.com/toastedgrain/research-assistant.git
cd research-assistant

Install dependencies:

pnpm install

[INSERT VERIFIED REMAINING SETUP COMMANDS]

Local setup enables the complete Marginalia experience, including Ollama-powered Visualize and interactive learning features.

What is Marginalia?

Marginalia is an evidence-first research environment for reading, understanding, and exploring scientific papers.

It started with a small frustration I kept having as a student trying to read research.

A paper would say:

“As shown in Figure 3…”

So I would leave the paragraph, scroll through several pages, find Figure 3, try to understand it, scroll back, lose my place, and repeat the process a few minutes later.

Citations were even more fragmented. One sentence could depend on years of previous work, yet following that connection meant leaving the paper entirely.

And whenever I couldn't understand something, the increasingly obvious solution was:

Give the PDF to AI and ask for a summary.

But I didn't want to avoid the paper.

I wanted to understand it.

The figures, experiments, definitions, citations, and evidence I needed were already there. The problem was that their relationships were trapped inside a document designed to be read page by page.

Marginalia started by making one of those relationships interactive:

Click “Figure 3.” See Figure 3. Keep reading.

Then I started asking what else a research paper was hiding.

A citation is a connection to another paper.

A claim is a connection to evidence.

A concept might begin in the introduction, become formal in the methodology, appear visually in a figure, and finally be tested in an experiment.

A paper isn't really a stack of pages.

It's an evidence network presented as one.

Marginalia reconstructs that network.

Why Marginalia?

The problem is bigger than navigating figures.

Researchers constantly reconstruct context manually:

Claim ─────────────→ Evidence
  │                    │
  │                    ├── Figure
  │                    ├── Table
  │                    └── Experiment
  │
  ├── Concept ──────→ Definition
  │
  └── Citation ─────→ Another Paper
                           │
                           └── Another Evidence Network

Marginalia turns those relationships into things you can actually interact with.

And that creates a different approach to AI for research.

Most AI research tools follow roughly this model:

Paper
  ↓
AI
  ↓
Summary / Answer

Marginalia deliberately does not.

Its model is:

                    ┌── Figures
                    ├── Tables
                    ├── Claims
Paper ── Evidence ──┼── Concepts
                    ├── Citations ──→ Papers
                    └── Experiments
                           ↑
                           │
                      AI assists

AI sits around the evidence, not between the researcher and the evidence.

The paper remains the authority.

That is the central idea behind Marginalia.


---

# What You Can Do

## 1. Read Research Without Losing Your Place

Marginalia understands references embedded in the paper.

When the text says **Figure 1**, the reader can surface the extracted Figure 1 directly in the reading context.

The same infrastructure connects:

* figures
* tables
* algorithms
* captions
* sections
* citations
* source passages

Instead of repeatedly navigating the geometry of a PDF, the interface navigates the relationships inside it.

---

## 2. Follow Citations as Paths, Not Dead Ends

Research rarely exists in one document.

Marginalia resolves supported citations and allows cited research to become part of the reading environment instead of forcing the reader to abandon their current context.

Those relationships can then power a larger **Citation Graph**.

```text
Current Paper
     │
     ├──── cites ──── Paper B
     │                   │
     │                   └──── cites ──── Paper D
     │
     └──── cites ──── Paper C
```

Literal citations remain literal citations.

Generated semantic relationships are represented separately rather than being disguised as bibliographic fact.

---

## 3. See the Structure of a Paper

**Paper Map** reconstructs the paper as an explorable structure of:

* sections
* figures
* tables
* references
* relationships

Instead of treating a 20-page document as twenty independent pages, Marginalia exposes the architecture underneath them.

---

## 4. Browse the Evidence Visually

**Figure Atlas** turns extracted figures, tables, and algorithms into a visual index of the paper.

Researchers can skim the visual evidence, inspect captions, see where an asset occurs, and jump directly back to its source context.

For visually dense research, this provides an entirely different entry point into the paper.

---

## 5. Trace an Idea Through the Paper

Research concepts rarely appear once.

They are introduced, defined, referenced, visualized, tested, and discussed.

**Concept Threads** reconstruct that path.

```text
Self-attention
      ↓
Introduction
      ↓
Definition
      ↓
Figure 2
      ↓
Experiment
      ↓
Conclusion
```

Instead of asking an AI to summarize what a concept means, researchers can inspect how the authors themselves develop it.

---

## 6. Ask for Help Without Abandoning the Source

When a passage becomes difficult, Marginalia can create a local `ResearchContext` around it.

That context understands the selected passage together with nearby:

* sections
* figures
* tables
* concepts
* citations
* source passages

From one selection, a researcher can:

**Pin · Trace · Explain · Visualize · Play**

The goal is not to send the entire paper to a model whenever someone clicks.

Marginalia constructs the smallest useful evidence window around the interaction.

---

## 7. Turn Difficult Ideas Into Visual Structures

**Visualize This** transforms suitable concepts and processes into controlled micro-diagrams.

For example:

```text
Tokens
   ↓
Q / K / V
   ↓
Attention Scores
   ↓
Weighted Values
```

Generated systems return structured diagram data rather than arbitrary executable UI.

The application remains responsible for how that information is rendered.

---

## 8. Learn Actively From the Actual Paper

Marginalia includes an optional learning system built around source-grounded interactions.

Rather than generating generic questions about the topic, the challenge engine works from research objects such as:

* concepts
* claims
* evidence
* figures
* tables
* definitions
* experiments

These can become:

* Quick Quiz
* Concept Match
* Evidence Hunt
* Figure Detective
* Build the Diagram
* Predict Before Reveal
* Claim vs. Evidence
* Paper Quest
* Paper Check
* Paper vs. Paper
* Timeline Challenges

Every scored challenge must pass validation and contain source evidence.

A generated challenge without sufficient evidence is rejected rather than shown.

**You can always go back to the paper.**

---

## 9. Read in Three Different Ways

### Read

For researchers who want the paper with better navigation.

Minimal interruption. Figures, citations, source navigation, notes, and accessibility.

### Learn

Adds concept tracing, difficulty indicators, prerequisites, explanations, visualizations, and optional checkpoints.

### Quest

Turns the paper into an active learning path while keeping the original research at the center.

Marginalia does not force gamification onto serious reading.

The reader decides how much assistance they want.

---

## 10. Build a Research Workspace

Research does not end when one PDF closes.

Marginalia extends outward into a workspace containing:

* Research Collections
* Citation Graph
* Research Lineage
* Paper Timeline
* Figure Timeline
* Constellation View
* Cross-paper Search
* Dataset / Benchmark Browser
* Cross-paper Comparison
* Research Pinboard

Evidence can become persistent research objects rather than screenshots and disconnected notes.

A pinned figure still knows which paper and page it came from.

A passage still knows its source.

A connection can distinguish whether it was:

* present in the source,
* inferred,
* or manually created by the researcher.

---

# Evidence Is a First-Class Data Type

One of the most important architectural decisions in Marginalia is that evidence is not merely text displayed underneath an AI response.

It has its own contract.

```ts
interface SourceEvidence {
  paperId: string;
  page: number;

  kind:
    | "passage"
    | "figure"
    | "table"
    | "equation"
    | "caption"
    | "citation";

  text?: string;
  assetId?: string;
  bbox?: NormalizedBBox;
  sectionId?: string;
}
```

That object can travel through the application.

```text
PDF
 ↓
Extraction
 ↓
SourceEvidence
 ↓
ResearchContext
 ↓
Learning / Exploration
 ↓
Interaction
 ↓
Back to SourceEvidence
```

This makes provenance part of the architecture rather than a citation added to the end of generated prose.

---

# Architecture

Marginalia deliberately separates document truth, browser interaction, exploration, and generated intelligence.

```text
                         PDF / arXiv
                              │
                              ▼
                 Python Extraction Pipeline
              figures · tables · captions
              sections · refs · geometry
                              │
                              ▼
                     Static Manifest
                              │
                              ▼
                    pdf.js Research Reader
                   /                     \
                  /                       \
                 ▼                         ▼
        ResearchContext              ResearchGraph
               │                          │
        Learning Objects             Exploration
               │                          │
               ▼                          ▼
        Challenge Engine        Maps · Atlas · Graphs
               │                Timeline · Workspace
               ▼
        Validation Layer
               │
               ▼
         Learn / Quest
               │
               └──────────────→ Source Evidence
```

The separation is intentional.

**Python owns document extraction.**

**TypeScript owns browser interaction.**

**The learning layer owns interpretation.**

**The exploration layer owns relationships and workspace navigation.**

No second AI extraction pipeline was introduced simply because a model could parse the PDF again.

---

# Technical Stack

## Frontend

* **Next.js**
* **React**
* **TypeScript**
* **pdf.js**
* componentized reader, exploration, learning, game, and accessibility layers

The browser owns interactions that depend on rendered PDF text, including mention detection, citation interaction, selection context, and evidence hotspots.

---

## Document Intelligence

### Python extraction pipeline

Python handles paper-intrinsic extraction:

* PDF ingestion
* figure extraction
* table extraction
* algorithm regions
* captions
* sections
* references
* arXiv resolution
* PDF geometry normalization
* static manifest generation

The application uses a single normalized coordinate contract so evidence overlays, highlights, figures, game targets, and annotations do not independently reinterpret PDF geometry.

---

## Research Graph

Marginalia uses a generalized graph representation for:

* papers
* sections
* concepts
* figures
* tables
* authors
* datasets

Relationships explicitly retain their meaning:

```text
cites
contains
mentions
uses
user-connected
generated-related
```

A generated relationship is not silently presented as a citation.

---

## Learning Intelligence

Research interactions flow through:

```text
ResearchContext
      ↓
Learning Objects
      ↓
Challenge Candidate
      ↓
Deterministic Builder
        OR
GPT-5.6 Generation
      ↓
ChallengeSpec
      ↓
Validation
      ↓
Renderer
      ↓
Evidence
```

This allows deterministic and generated interactions to share the same interface.

The renderer does not need to trust where a challenge came from.

It only receives a validated contract.

---

# OpenAI Build Week: Why Codex Was the Right Tool

Marginalia was built during OpenAI Build Week using **Codex and GPT-5.6** not simply as autocomplete, but as engineering collaborators across a system with unusually strict boundaries.

The challenge was not generating a large quantity of code.

The challenge was changing a working PDF research system quickly **without destroying the invariants that made it trustworthy.**

Marginalia contains multiple systems that need to agree:

```text
Python extraction
        ↕
JSON contracts
        ↕
TypeScript
        ↕
pdf.js
        ↕
Reader
        ↕
Evidence system
        ↕
Graphs
        ↕
Learning engine
        ↕
Workspace
```

A “small” change could easily break figure coordinates, paper identifiers, source navigation, or another feature several layers away.

That made Codex particularly useful.

---

# How I Collaborated With Codex

## Codex as an implementation agent

I used Codex to work directly against the repository rather than asking for isolated code snippets and manually stitching them together.

For larger features, the workflow was closer to:

```text
Product intent
      ↓
Architecture / invariants
      ↓
Codex repository inspection
      ↓
Implementation
      ↓
Tests
      ↓
Integration audit
      ↓
Fix discovered cross-feature failures
```

This mattered enormously as Marginalia expanded from a figure-first reader into a research environment.

Codex could inspect existing interfaces before implementing new behavior, follow dependencies through the repository, modify multiple coordinated modules, run tests, and investigate failures in the context of the actual codebase.

---

## Codex as a parallel engineering system

The expansion was intentionally decomposed into separate engineering domains.

One development track focused on **Learning & Interaction**:

* selection intelligence
* `ResearchContext`
* learning objects
* concept threads
* difficulty analysis
* prerequisite graphs
* micro visualizations
* challenge engine
* Learn mode
* Quest mode

Another focused on **Exploration, Workspace & Accessibility**:

* Figure Atlas
* Paper Map
* Citation Graph
* collections
* pinboard
* comparison
* lineage
* timelines
* constellation
* reflow
* accessibility

The tracks communicated through explicit contracts rather than reaching into one another's UI.

Codex was especially valuable here because implementation could proceed across independent feature surfaces while shared interfaces remained narrow.

---

## Codex for integration auditing

One of the most useful parts of the process happened **after features existed**.

Instead of assuming that passing unit tests meant the product was integrated, Codex was used to audit the actual end-to-end paths.

That exposed problems such as inconsistent paper identifiers and source links whose URLs looked correct but did not navigate to the intended evidence inside the reader.

Those are exactly the failures that become easy to miss in a rapidly expanding codebase.

Codex was useful not just for:

> “Build this feature.”

but also:

> “Prove that these systems actually work together.”

That distinction made Marginalia materially stronger.

---

# GPT-5.6: Intelligence Behind the Interaction, Not the Source of Truth

GPT-5.6 is used where generative reasoning actually improves the research experience.

Examples include user-triggered:

* explanations
* prerequisite suggestions
* structured micro-visualizations
* learning interactions
* challenge generation
* cross-paper reasoning

But the model operates behind an evidence boundary.

A generated scored challenge passes through validation before reaching the user.

Validation checks include:

* Does source evidence exist?
* Does the expected answer exist?
* Does the page actually exist?
* Are answer choices structurally valid?
* Are choices distinct?
* Is the answer ambiguous?
* Does the interaction meet the required confidence threshold?

Failure does not mean “show the model output anyway.”

Marginalia can fall back to a deterministic interaction or display nothing.

That is intentional.

---

# Multi-Agent Development

Marginalia's development mirrored its architecture.

Instead of treating one AI conversation as an infinitely long developer session, responsibilities were decomposed around explicit ownership and contracts.

Agents could work on:

* extraction-aware features
* learning systems
* exploration systems
* integration auditing
* test repair
* product polish

without each independently redesigning the core architecture.

The human role remained important.

I decided what Marginalia should be, which problems mattered, what behavior was acceptable, where generated intelligence belonged, and—equally importantly—where it did **not** belong.

Codex accelerated implementation and made broader repository-level reasoning practical within the Build Week timeframe.

It did not make the product decisions for me.

---

# Skills and Agentic Workflow

The development process used reusable instructions and structured engineering workflows so agents could operate with more context than a single prompt.

Instead of repeatedly explaining Marginalia's rules, the repository establishes invariants such as:

* preserve the Python/TypeScript boundary
* normalize coordinates once
* prioritize precision over recall
* keep generated content optional
* preserve source evidence
* validate generated challenges
* do not silently invent graph semantics
* do not regress the existing reader

This made agentic development significantly more reliable.

The important insight was that better agents did not remove the need for architecture.

**They made architecture more valuable.**

---

# Why This Is Technically Non-Trivial

Marginalia is not a chat interface wrapped around a model call.

It combines:

* PDF ingestion
* document extraction
* figure and table cropping
* geometry normalization
* browser PDF rendering
* text-layer analysis
* mention detection
* citation resolution
* source navigation
* evidence contracts
* graph construction
* cross-paper relationships
* persistent research objects
* accessibility/reflow
* concept analysis
* challenge generation
* challenge validation
* multiple research interaction modes

while maintaining a fundamental invariant:

> **Every interaction should preserve the researcher's ability to return to the original evidence.**

---

# What Makes Marginalia Different?

There are many AI research tools.

Most begin with:

```text
Paper
  ↓
LLM
  ↓
Summary / Chat
```

Marginalia begins somewhere else:

```text
                  ┌── Figure
                  │
                  ├── Table
                  │
Paper ─ Evidence ─┼── Claim
                  │
                  ├── Concept
                  │
                  ├── Citation ──→ Paper
                  │
                  └── Experiment
```

Then it asks:

**What interfaces become possible if those relationships are interactive?**

That leads to a fundamentally different product.

The output is not primarily another piece of generated text.

The output is a better way to interact with research itself.

---

# Designed for Researchers, Useful Far Beyond One Discipline

The initial audience for Marginalia is academic researchers and people who regularly work with scientific literature.

But the underlying problem is global.

Researchers around the world publish across disciplines, institutions, languages, and levels of specialization.

The volume of literature makes understanding connections increasingly difficult.

Marginalia does not claim to solve scientific discovery.

It targets something narrower and practical:

**reduce the friction between encountering scientific evidence and actually understanding how it connects.**

A researcher entering a neighboring field should be able to follow the lineage of an idea.

A student beginning research should be able to trace unfamiliar concepts instead of immediately replacing the paper with a summary.

A researcher comparing methods should be able to put original figures and evidence beside one another.

A reader with accessibility needs should have an alternative to the rigid visual structure of a PDF.

The same evidence-first architecture can serve all of them.

---

# Design Philosophy

Marginalia follows five rules.

### 1. Source before summary

The original paper remains available and central.

### 2. Precision before spectacle

If a relationship cannot be established confidently, Marginalia would rather omit it.

### 3. Generated ≠ authoritative

Generated relationships and source relationships are visually and structurally distinct.

### 4. Assistance should be optional

A researcher can use Marginalia simply as a better reader.

### 5. Every abstraction should have an escape hatch

Graphs, learning activities, explanations, figures, and workspace objects should lead back to evidence.

---

# Failure Is Part of the Architecture

Research software should be able to say “I don't know.”

Marginalia explicitly defines failure behavior.

If generation is unavailable, the deterministic reader continues working.

If a challenge cannot be grounded, it is not displayed.

If a citation cannot be resolved, it remains ordinary citation text.

If a figure is unavailable, Marginalia does not create a figure-dependent interaction.

If a prerequisite is inferred rather than stated, it is labeled as suggested.

If reflow cannot confidently preserve reading order, the original PDF remains available.

**Rendering less is better than fabricating certainty.**

---

# Built During OpenAI Build Week

Marginalia was meaningfully expanded during OpenAI Build Week using Codex and GPT-5.6.

The Build Week work transformed the project beyond its original figure-first PDF reader into a connected research environment spanning:

* research exploration
* source-grounded learning
* interactive evidence
* cross-paper navigation
* research graphs
* workspaces
* accessibility
* active learning

The repository's commit history and Codex session history document that development.

**Primary Codex Session ID:** `[CODEX SESSION ID]`

---

# Judging Marginalia

If you only have a few minutes:

### 1. Open the live application

`[LIVE WEBSITE URL]`

### 2. Watch the demo

`[YOUTUBE DEMO URL]`

### 3. Try the evidence-first reader

Open a research paper and click a figure reference.

### 4. Follow the network

Open a citation, Paper Map, Figure Atlas, or Citation Graph.

### 5. Select something difficult

Use the selection actions to trace, visualize, explain, or interact with the concept.

### 6. Follow it back

Use **Show Evidence** or source navigation to return to the paper.

That final step is the point.

---

# The Bigger Idea

The web changed documents from isolated pages into networks.

Scientific publishing largely did not.

We still distribute some of humanity's most complex knowledge in a format where the connections between claims, figures, experiments, concepts, citations, and neighboring work must be reconstructed manually by every reader.

Large language models make it tempting to solve that problem by skipping the document.

Marginalia asks a different question:

**What if AI helped us go deeper into the source instead?**

Not another answer box.

Not another paper summary.

A research environment built around the evidence itself.

---

## Marginalia

**Read the paper. Follow the evidence. See the connections.**

