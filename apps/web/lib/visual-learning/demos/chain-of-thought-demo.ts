import { challengeEvidence, type ChallengeEvidence } from "../../challenges/contracts";
import { assetEvidence, passageEvidence } from "../../evidence/source";
import type { Manifest } from "../../manifest";
import type { PaperLearningIndex } from "../../learning/paper-index";

export const CHAIN_OF_THOUGHT_DEMO_ARXIV_ID = "2201.11903";
export const CHAIN_OF_THOUGHT_DEMO_CHALLENGE_ID = "demo-cot-build-reasoning";

export interface ChainOfThoughtDemoStep {
  id: string;
  eyebrow: string;
  label: string;
  shortLabel: string;
  description: string;
  tone: "question" | "input" | "reasoning" | "calculation" | "answer";
}

export interface ChainOfThoughtDemoEvidence {
  mechanism: ChallengeEvidence | null;
  result: ChallengeEvidence | null;
}

export const CHAIN_OF_THOUGHT_DEMO_STEPS: readonly ChainOfThoughtDemoStep[] = [
  {
    id: "question",
    eyebrow: "Question",
    label: "Roger has 5 tennis balls and buys 2 cans with 3 balls each.",
    shortLabel: "Question",
    description: "The task the model needs to solve.",
    tone: "question",
  },
  {
    id: "starting-balls",
    eyebrow: "Known amount",
    label: "5 starting tennis balls",
    shortLabel: "5 tennis balls",
    description: "Begin with the quantity Roger already has.",
    tone: "input",
  },
  {
    id: "new-cans",
    eyebrow: "New amount",
    label: "2 cans × 3 balls each",
    shortLabel: "2 cans × 3 balls",
    description: "Translate the two new cans into an arithmetic step.",
    tone: "reasoning",
  },
  {
    id: "additional-balls",
    eyebrow: "Intermediate result",
    label: "6 additional tennis balls",
    shortLabel: "6 additional balls",
    description: "The intermediate calculation makes the added quantity explicit.",
    tone: "reasoning",
  },
  {
    id: "combine",
    eyebrow: "Combine",
    label: "5 + 6 = 11",
    shortLabel: "5 + 6",
    description: "Combine the starting amount with the newly calculated amount.",
    tone: "calculation",
  },
  {
    id: "final-answer",
    eyebrow: "Final answer",
    label: "11 tennis balls",
    shortLabel: "Answer: 11",
    description: "The final output follows the visible intermediate reasoning sequence.",
    tone: "answer",
  },
] as const;

export const CHAIN_OF_THOUGHT_DEMO_INITIAL_ORDER = [
  "combine",
  "question",
  "additional-balls",
  "final-answer",
  "starting-balls",
  "new-cans",
] as const;

export const CHAIN_OF_THOUGHT_RESULT_BARS = [
  { id: "gpt3", label: "Finetuned GPT-3 175B", value: 33, emphasis: false },
  { id: "prior-best", label: "Prior best", value: 55, emphasis: false },
  { id: "palm-standard", label: "PaLM 540B · standard prompting", value: 18, emphasis: false },
  { id: "palm-cot", label: "PaLM 540B · chain-of-thought prompting", value: 57, emphasis: true },
] as const;

export const CHAIN_OF_THOUGHT_DEMO_HINTS = [
  "Start with what Roger already has.",
  "How many tennis balls are in the two new cans?",
  "Combine the starting amount with the new balls.",
] as const;

function canonicalArxivId(value: string | null | undefined): string | null {
  const canonical = value?.trim().replace(/^arxiv:/i, "").replace(/v\d+$/i, "") ?? "";
  return canonical || null;
}

/** The demo override is tied to source identity, never to editable display text. */
export function isChainOfThoughtDemoPaper(manifest: Pick<Manifest, "source">): boolean {
  return canonicalArxivId(manifest.source.arxiv_id) === CHAIN_OF_THOUGHT_DEMO_ARXIV_ID;
}

function passageEvidenceFor(
  index: PaperLearningIndex,
  reason: string,
  predicate: (text: string, page: number) => boolean,
): ChallengeEvidence | null {
  const passage = index.passages.find((candidate) => predicate(candidate.text, candidate.page));
  if (!passage) return null;
  return challengeEvidence(
    passageEvidence(index.paperId, passage.page, passage.text, {
      ...(passage.bbox ? { bbox: passage.bbox } : {}),
      ...(passage.sectionId ? { sectionId: passage.sectionId } : {}),
    }),
    reason,
    { kind: "passage", resourceId: passage.id },
  );
}

/**
 * Resolves the fixture back to the loaded paper. Figure 2 is deliberately resolved via
 * its literal caption passage because the precision-first extractor can drop its crop;
 * a missing crop must never be replaced with a made-up asset pointer.
 */
export function createChainOfThoughtDemoEvidence(index: PaperLearningIndex): ChainOfThoughtDemoEvidence {
  const figureOne = index.manifest.assets.find((asset) => asset.kind === "figure" && asset.number === "1");
  const mechanism = figureOne
    ? challengeEvidence(
        assetEvidence(index.paperId, figureOne),
        "Figure 1 contains the paper's prompting comparison and worked chain-of-thought example.",
      )
    : passageEvidenceFor(
        index,
        "The paper defines a chain of thought as intermediate natural-language reasoning steps leading to the final output.",
        (text, page) => page <= 2 && /series of intermediate natural[-\s]language reasoning steps/i.test(text),
      );

  const result = passageEvidenceFor(
    index,
    "Figure 2 reports the GSM8K comparison used by this result view.",
    (text, page) => page === 1 && /Figure\s*2/i.test(text) && /GSM8K/i.test(text),
  ) ?? passageEvidenceFor(
    index,
    "The paper describes Figure 2's reported GSM8K comparison.",
    (text, page) => page === 1 && /GSM8K/i.test(text) && /chain[-\s]of[-\s]thought prompting/i.test(text),
  );

  return { mechanism, result };
}

export function evaluateChainOfThoughtOrder(order: readonly string[]): boolean {
  return order.length === CHAIN_OF_THOUGHT_DEMO_STEPS.length
    && CHAIN_OF_THOUGHT_DEMO_STEPS.every((step, index) => order[index] === step.id);
}

export function correctChainPrefixLength(order: readonly string[]): number {
  let count = 0;
  for (const [index, step] of CHAIN_OF_THOUGHT_DEMO_STEPS.entries()) {
    if (order[index] !== step.id) break;
    count += 1;
  }
  return count;
}

export function moveChainStep(order: readonly string[], stepId: string, targetIndex: number): string[] {
  if (!order.includes(stepId)) return [...order];
  const without = order.filter((id) => id !== stepId);
  const boundedTarget = Math.max(0, Math.min(without.length, targetIndex));
  return [...without.slice(0, boundedTarget), stepId, ...without.slice(boundedTarget)];
}
