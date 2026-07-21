import type { z } from "zod/v3";
import {
  VisualChallengeGenerationResponseSchema,
  VisualLearningGenerationResponseSchema,
  type VisualChallengeGenerationResponse,
  type VisualChallengeSpec,
  type VisualGenerationRequest,
  type VisualLearningGenerationResponse,
  type VisualLearningSpec,
} from "./contracts";

export class VisualSpecValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(issues.join(" "));
    this.name = "VisualSpecValidationError";
  }
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new VisualSpecValidationError(parsed.error.issues.map((issue) => `${issue.path.join(".") || "output"}: ${issue.message}`));
  }
  return parsed.data;
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

function checkEvidenceIds(ids: readonly string[], allowed: ReadonlySet<string>, at: string, issues: string[]): void {
  for (const id of ids) {
    if (!allowed.has(id)) issues.push(`${at} references unknown evidence ${id}.`);
  }
}

const LABEL_STOPWORDS = new Set(["a", "an", "the", "of", "for", "and", "or", "to", "in", "on", "with"]);

function normalizedTokens(value: string): string[] {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[‐‑–—-]/g, " ").match(/[\p{L}\p{N}]+/gu)?.filter((token) => !LABEL_STOPWORDS.has(token)) ?? [];
}

function evidenceText(ids: readonly string[], request: VisualGenerationRequest): string {
  return ids.flatMap((id) => {
    const source = request.sourceEvidence.find((item) => item.id === id)?.source;
    return source?.text ? [source.text.normalize("NFKC").toLocaleLowerCase().replace(/[‐‑–—-]/g, " ")] : [];
  }).join(" ");
}

function labelGrounded(label: string, ids: readonly string[], request: VisualGenerationRequest): boolean {
  const tokens = normalizedTokens(label);
  const text = evidenceText(ids, request);
  return tokens.length > 0 && tokens.every((token) => text.includes(token));
}

function orderedRelationshipGrounded(sourceLabel: string, targetLabel: string, ids: readonly string[], request: VisualGenerationRequest): boolean {
  const text = evidenceText(ids, request);
  const sourceTokens = normalizedTokens(sourceLabel);
  const targetTokens = normalizedTokens(targetLabel);
  const sourceAt = sourceTokens.map((token) => text.indexOf(token)).find((index) => index >= 0) ?? -1;
  const targetAt = targetTokens.map((token) => text.indexOf(token, Math.max(0, sourceAt + 1))).find((index) => index >= 0) ?? -1;
  if (sourceAt < 0 || targetAt <= sourceAt) return false;
  const window = text.slice(Math.max(0, sourceAt - 80), Math.min(text.length, targetAt + 80));
  return /\bfirst\b[\s\S]*\bsecond\b|\bfollowed\s+by\b|\bthen\b|\bafter\b|\bbefore\b|\bflows?\s+to\b|\bmaps?\s+to\b|(?:→|->)/.test(window);
}

function stateHasObjectiveAnswer(spec: VisualChallengeSpec): boolean {
  const state = spec.correctState;
  return Boolean(state && (
    (state.nodeOrder?.length ?? 0) > 0 ||
    (state.connections?.length ?? 0) > 0 ||
    Object.keys(state.placements ?? {}).length > 0 ||
    (state.selectedElementIds?.length ?? 0) > 0 ||
    Object.keys(state.classification ?? {}).length > 0 ||
    Boolean(state.choiceId) ||
    (state.expectedEvidenceIds?.length ?? 0) > 0
  ));
}

function validateChallengeState(
  spec: VisualChallengeSpec,
  request: VisualGenerationRequest,
  issues: string[],
): void {
  const allowedEvidence = new Set(request.sourceEvidence.map((item) => item.id));
  const elements = new Set(spec.interactiveElements.map((item) => item.id));
  const elementDuplicates = duplicates(spec.interactiveElements.map((item) => item.id));
  if (elementDuplicates.length) issues.push(`Interactive element ids must be unique: ${elementDuplicates.join(", ")}.`);
  checkEvidenceIds(spec.evidenceIds, allowedEvidence, "Challenge", issues);

  for (const element of spec.interactiveElements) {
    checkEvidenceIds(element.evidenceIds, allowedEvidence, `Element ${element.id}`, issues);
    if (element.evidenceIds.length === 0 && spec.scoringMode === "scored") {
      issues.push(`Scored element ${element.id} has no direct source evidence.`);
    }
    if (spec.scoringMode === "scored" && element.kind !== "choice" && !labelGrounded(element.label, element.evidenceIds, request)) {
      issues.push(`Scored element ${element.id} has a label that is not literally grounded in its cited evidence.`);
    }
    if (element.bbox) {
      const matchingRegion = element.evidenceIds.some((id) => {
        const evidence = request.sourceEvidence.find((item) => item.id === id);
        return evidence?.source.bbox?.every((value, index) => value === element.bbox?.[index]);
      });
      if (!matchingRegion) issues.push(`Element ${element.id} uses a figure region that was not supplied as verified evidence.`);
    }
  }

  for (const hint of spec.hints) checkEvidenceIds(hint.evidenceIds, allowedEvidence, `Hint ${hint.id}`, issues);
  if (spec.sourceReveal) checkEvidenceIds(spec.sourceReveal.evidenceIds, allowedEvidence, "Source reveal", issues);

  const states = [["initialState", spec.initialState], ["correctState", spec.correctState]] as const;
  for (const [name, state] of states) {
    if (!state) continue;
    for (const id of [
      ...(state.nodeOrder ?? []),
      ...(state.hiddenElementIds ?? []),
      ...(state.selectedElementIds ?? []),
      ...Object.keys(state.placements ?? {}),
      ...Object.values(state.placements ?? {}),
      ...Object.keys(state.classification ?? {}),
      ...Object.values(state.classification ?? {}),
      ...(state.choiceId ? [state.choiceId] : []),
    ]) {
      if (!elements.has(id)) issues.push(`${name} references unknown interactive element ${id}.`);
    }
    checkEvidenceIds(state.expectedEvidenceIds ?? [], allowedEvidence, `${name} evidence`, issues);
    const connectionIds = state.connections?.map((connection) => connection.id) ?? [];
    if (duplicates(connectionIds).length) issues.push(`${name} connection ids must be unique.`);
    for (const connection of state.connections ?? []) {
      if (!elements.has(connection.sourceId) || !elements.has(connection.targetId)) {
        issues.push(`${name} connection ${connection.id} has an unknown endpoint.`);
      }
      checkEvidenceIds(connection.evidenceIds, allowedEvidence, `${name} connection ${connection.id}`, issues);
      if (name === "correctState" && spec.scoringMode === "scored" && connection.evidenceIds.length === 0) {
        issues.push(`Scored connection ${connection.id} has no direct source evidence.`);
      }
      if (name === "correctState" && spec.scoringMode === "scored") {
        const sourceElement = spec.interactiveElements.find((item) => item.id === connection.sourceId);
        const targetElement = spec.interactiveElements.find((item) => item.id === connection.targetId);
        if (sourceElement && targetElement && (!labelGrounded(sourceElement.label, connection.evidenceIds, request) || !labelGrounded(targetElement.label, connection.evidenceIds, request))) {
          issues.push(`Scored connection ${connection.id} does not cite evidence containing both endpoint labels.`);
        }
        if (sourceElement && targetElement && ["build-flow", "sequence"].includes(spec.gameType) && !orderedRelationshipGrounded(sourceElement.label, targetElement.label, connection.evidenceIds, request)) {
          issues.push(`Scored connection ${connection.id} lacks explicit source ordering.`);
        }
      }
      if (name === "correctState" && spec.scoringMode === "scored" && request.evidenceGraph?.edges.some((edge) => edge.provenance !== "literal" && edge.source === connection.sourceId && edge.target === connection.targetId)) {
        issues.push(`Scored connection ${connection.id} relies on a generated or user-created graph relationship.`);
      }
    }
  }

  if (spec.scoringMode === "scored" && !stateHasObjectiveAnswer(spec)) {
    issues.push("A scored challenge requires an objective correct state.");
  }
  if (spec.scoringMode === "exploratory" && spec.gameType === "multiple-choice") {
    issues.push("Exploratory interactions must not disguise themselves as conventional multiple choice.");
  }
  if (spec.gameType === "prediction" && spec.scoringMode !== "exploratory") {
    issues.push("Prediction must remain exploratory.");
  }
  if (spec.gameType === "multiple-choice" && spec.scoringMode === "scored") {
    const choices = spec.interactiveElements.filter((item) => item.kind === "choice");
    if (choices.length < 2) issues.push("Multiple choice requires at least two stable choices.");
    if (!spec.correctState?.choiceId || choices.filter((item) => item.id === spec.correctState?.choiceId).length !== 1) {
      issues.push("Single-answer multiple choice requires exactly one rendered correct choice id.");
    }
    const correct = choices.find((item) => item.id === spec.correctState?.choiceId);
    if (correct && !labelGrounded(correct.label, correct.evidenceIds, request)) issues.push("The correct multiple-choice label is not literally grounded in its cited evidence.");
  }
  if (["build-flow", "rebuild-architecture", "connect-concepts", "sequence"].includes(spec.gameType) && spec.scoringMode === "scored") {
    if (!spec.correctState?.connections?.length) {
      issues.push(`${spec.gameType} requires source-grounded correct connections when scored.`);
    }
  }
  if (spec.gameType === "missing-node" && spec.scoringMode === "scored" && !Object.keys(spec.correctState?.placements ?? {}).length) {
    issues.push("A scored missing-node challenge requires a verified placement.");
  }
  if (spec.gameType === "evidence-hunt" && spec.scoringMode === "scored" && !spec.correctState?.expectedEvidenceIds?.length) {
    issues.push("A scored evidence hunt requires expected verified evidence.");
  }
  if (spec.gameType === "figure-detective") {
    const regionElements = spec.interactiveElements.filter((item) => item.bbox);
    if (regionElements.length) issues.push("Figure regions are unavailable because the supplied evidence identifies whole assets, not verified internal regions.");
  }
}

export function validateVisualChallengeResponse(
  value: unknown,
  request: VisualGenerationRequest,
): VisualChallengeGenerationResponse {
  const parsed = parseOrThrow(VisualChallengeGenerationResponseSchema, value);
  if (parsed.status === "insufficient-evidence") return parsed;
  const issues: string[] = [];
  if (!parsed.spec.generated) issues.push("Model-generated visual challenges must retain the generated label.");
  validateChallengeState(parsed.spec, request, issues);
  if (issues.length) throw new VisualSpecValidationError(issues);
  return parsed;
}

function validateLearningSpec(
  spec: VisualLearningSpec,
  request: VisualGenerationRequest,
  issues: string[],
): void {
  const allowedEvidence = new Set(request.sourceEvidence.map((item) => item.id));
  const nodeIds = spec.nodes.map((node) => node.id);
  const edgeIds = spec.edges.map((edge) => edge.id);
  const explanationIds = spec.explanationSteps.map((step) => step.id);
  if (duplicates(nodeIds).length) issues.push("Visual node ids must be unique.");
  if (duplicates(edgeIds).length) issues.push("Visual edge ids must be unique.");
  if (duplicates(explanationIds).length) issues.push("Explanation step ids must be unique.");
  const nodes = new Set(nodeIds);
  const edges = new Set(edgeIds);
  const explanations = new Set(explanationIds);
  checkEvidenceIds(spec.evidenceIds, allowedEvidence, "Visualization", issues);
  for (const node of spec.nodes) {
    checkEvidenceIds(node.evidenceIds, allowedEvidence, `Node ${node.id}`, issues);
    if (!node.evidenceIds.length) issues.push(`Node ${node.id} has no source evidence.`);
    else if (!labelGrounded(node.label, node.evidenceIds, request)) issues.push(`Node ${node.id} has a label that is not literally grounded in its cited evidence.`);
  }
  for (const edge of spec.edges) {
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) issues.push(`Edge ${edge.id} has an unknown endpoint.`);
    checkEvidenceIds(edge.evidenceIds, allowedEvidence, `Edge ${edge.id}`, issues);
    if (!edge.evidenceIds.length) issues.push(`Edge ${edge.id} has no source evidence.`);
    else {
      const source = spec.nodes.find((node) => node.id === edge.source);
      const target = spec.nodes.find((node) => node.id === edge.target);
      if (source && target && (!labelGrounded(source.label, edge.evidenceIds, request) || !labelGrounded(target.label, edge.evidenceIds, request))) issues.push(`Edge ${edge.id} does not cite evidence containing both endpoint labels.`);
    }
  }
  for (const step of spec.explanationSteps) checkEvidenceIds(step.evidenceIds, allowedEvidence, `Explanation ${step.id}`, issues);
  for (const interaction of spec.interactions) {
    checkEvidenceIds(interaction.evidenceIds, allowedEvidence, `Interaction ${interaction.id}`, issues);
    for (const target of interaction.targetIds) {
      if (!nodes.has(target) && !edges.has(target) && !explanations.has(target)) issues.push(`Interaction ${interaction.id} targets unknown item ${target}.`);
    }
  }
  for (const animation of spec.animationSteps) {
    for (const target of animation.targetIds) {
      if (!nodes.has(target) && !edges.has(target) && !explanations.has(target)) issues.push(`Animation ${animation.id} targets unknown item ${target}.`);
    }
    if (animation.explanationStepId && !explanations.has(animation.explanationStepId)) {
      issues.push(`Animation ${animation.id} references an unknown explanation step.`);
    }
  }
  if (spec.challenge) validateChallengeState(spec.challenge, request, issues);
}

export function validateVisualLearningResponse(
  value: unknown,
  request: VisualGenerationRequest,
): VisualLearningGenerationResponse {
  const parsed = parseOrThrow(VisualLearningGenerationResponseSchema, value);
  if (parsed.status === "insufficient-evidence") return parsed;
  const issues: string[] = [];
  if (!parsed.spec.generated) issues.push("Model-generated visual learning output must retain the generated label.");
  validateLearningSpec(parsed.spec, request, issues);
  if (issues.length) throw new VisualSpecValidationError(issues);
  return parsed;
}
