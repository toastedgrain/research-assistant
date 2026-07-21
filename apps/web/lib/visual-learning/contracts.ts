import { z } from "zod/v3";
import { zodToJsonSchema } from "zod-to-json-schema";

export const VISUAL_LEARNING_SCHEMA_VERSION = "1" as const;

const StableIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9:_-]*$/);
const ConciseLabelSchema = z.string().trim().min(1).max(96);
const EvidenceIdSchema = z.string().min(1).max(160);
const EvidenceIdsSchema = z.array(EvidenceIdSchema).max(16);
const BBoxSchema = z.tuple([
  z.number().min(0).max(1),
  z.number().min(0).max(1),
  z.number().min(0).max(1),
  z.number().min(0).max(1),
]).refine(([x0, y0, x1, y1]) => x0 < x1 && y0 < y1, "Bounding box must have positive normalized area.");

export const VisualizationTypeSchema = z.enum([
  "flow",
  "architecture",
  "process",
  "concept-map",
  "hierarchy",
  "comparison",
  "timeline",
  "equation",
  "figure-explainer",
]);

export const VisualNodeSchema = z.object({
  id: StableIdSchema,
  label: ConciseLabelSchema,
  description: z.string().trim().max(240),
  semanticType: z.enum([
    "concept",
    "input",
    "process",
    "output",
    "equation",
    "dataset",
    "model",
    "result",
    "method",
    "evidence",
  ]),
  evidenceIds: EvidenceIdsSchema,
}).strict();

export const VisualEdgeSchema = z.object({
  id: StableIdSchema,
  source: StableIdSchema,
  target: StableIdSchema,
  label: z.string().trim().max(72).optional(),
  relationshipType: z.enum([
    "flows-to",
    "transforms",
    "depends-on",
    "produces",
    "uses",
    "compares-with",
    "contains",
    "leads-to",
  ]),
  evidenceIds: EvidenceIdsSchema,
}).strict();

export const AnimationStepSchema = z.object({
  id: StableIdSchema,
  action: z.enum([
    "show-node",
    "highlight-node",
    "draw-edge",
    "pulse-edge",
    "dim-others",
    "reveal-explanation",
    "reveal-result",
    "focus-region",
  ]),
  targetIds: z.array(StableIdSchema).min(1).max(8),
  explanationStepId: StableIdSchema.optional(),
  durationMs: z.number().int().min(0).max(5000).optional(),
}).strict();

export const ExplanationStepSchema = z.object({
  id: StableIdSchema,
  title: ConciseLabelSchema.optional(),
  text: z.string().trim().min(1).max(320),
  evidenceIds: EvidenceIdsSchema,
}).strict();

export const VisualInteractionSchema = z.object({
  id: StableIdSchema,
  type: z.enum(["focus-node", "select-node", "step-through", "show-evidence"]),
  instruction: z.string().trim().min(1).max(180),
  targetIds: z.array(StableIdSchema).min(1).max(8),
  evidenceIds: EvidenceIdsSchema,
}).strict();

export const VisualGameTypeSchema = z.enum([
  "build-flow",
  "rebuild-architecture",
  "connect-concepts",
  "missing-node",
  "sequence",
  "figure-detective",
  "evidence-hunt",
  "prediction",
  "compare",
  "thread-expedition",
  "classification",
  "multiple-choice",
]);

export const InteractiveElementSchema = z.object({
  id: StableIdSchema,
  kind: z.enum(["node", "choice", "slot", "figure", "evidence-target", "category"]),
  label: ConciseLabelSchema,
  description: z.string().trim().max(180).optional(),
  semanticType: z.enum([
    "concept",
    "input",
    "process",
    "output",
    "equation",
    "dataset",
    "model",
    "result",
    "method",
    "evidence",
  ]).optional(),
  evidenceIds: EvidenceIdsSchema,
  assetId: StableIdSchema.optional(),
  bbox: BBoxSchema.optional(),
}).strict();

export const VisualConnectionSchema = z.object({
  id: StableIdSchema,
  sourceId: StableIdSchema,
  targetId: StableIdSchema,
  label: z.string().trim().max(72).optional(),
  evidenceIds: EvidenceIdsSchema,
}).strict();

export const VisualChallengeStateSchema = z.object({
  nodeOrder: z.array(StableIdSchema).max(12).optional(),
  connections: z.array(VisualConnectionSchema).max(20).optional(),
  hiddenElementIds: z.array(StableIdSchema).max(6).optional(),
  placements: z.record(StableIdSchema).optional(),
  selectedElementIds: z.array(StableIdSchema).max(12).optional(),
  classification: z.record(StableIdSchema).optional(),
  choiceId: StableIdSchema.optional(),
  expectedEvidenceIds: EvidenceIdsSchema.optional(),
}).strict();

const VisualChallengeBaseSchema = z.object({
  schemaVersion: z.literal(VISUAL_LEARNING_SCHEMA_VERSION),
  id: StableIdSchema,
  gameType: VisualGameTypeSchema,
  title: ConciseLabelSchema,
  learningObjective: z.string().trim().min(1).max(220),
  prompt: z.string().trim().min(1).max(320),
  instructions: z.string().trim().min(1).max(320),
  evidenceIds: z.array(EvidenceIdSchema).min(1).max(20),
  interactiveElements: z.array(InteractiveElementSchema).min(1).max(12),
  initialState: VisualChallengeStateSchema,
  hints: z.array(z.object({
    id: StableIdSchema,
    text: z.string().trim().min(1).max(240),
    evidenceIds: EvidenceIdsSchema,
  }).strict()).max(4),
  successFeedback: z.string().trim().min(1).max(240),
  sourceReveal: z.object({
    label: ConciseLabelSchema,
    evidenceIds: z.array(EvidenceIdSchema).min(1).max(8),
  }).strict().optional(),
  generated: z.boolean(),
}).strict();

export const VisualChallengeSpecSchema = z.discriminatedUnion("scoringMode", [
  VisualChallengeBaseSchema.extend({
    scoringMode: z.literal("scored"),
    correctState: VisualChallengeStateSchema,
  }).strict(),
  VisualChallengeBaseSchema.extend({
    scoringMode: z.literal("exploratory"),
    correctState: VisualChallengeStateSchema.optional(),
  }).strict(),
]);

export const VisualLearningSpecSchema = z.object({
  schemaVersion: z.literal(VISUAL_LEARNING_SCHEMA_VERSION),
  id: StableIdSchema,
  title: ConciseLabelSchema,
  learningGoal: z.string().trim().min(1).max(220),
  visualizationType: VisualizationTypeSchema,
  nodes: z.array(VisualNodeSchema).min(1).max(12),
  edges: z.array(VisualEdgeSchema).max(20),
  animationSteps: z.array(AnimationStepSchema).max(24),
  explanationSteps: z.array(ExplanationStepSchema).max(12),
  interactions: z.array(VisualInteractionSchema).max(12),
  evidenceIds: z.array(EvidenceIdSchema).min(1).max(20),
  challenge: VisualChallengeSpecSchema.optional(),
  generated: z.boolean(),
}).strict();

export const InsufficientEvidenceSchema = z.object({
  status: z.literal("insufficient-evidence"),
  reason: z.string().trim().min(1).max(240),
}).strict();

export const VisualLearningGenerationResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ready"), spec: VisualLearningSpecSchema }).strict(),
  InsufficientEvidenceSchema,
]);

export const VisualChallengeGenerationResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ready"), spec: VisualChallengeSpecSchema }).strict(),
  InsufficientEvidenceSchema,
]);

export const VerifiedSourceEvidenceSchema = z.object({
  id: EvidenceIdSchema,
  reason: z.string().trim().min(1).max(320),
  source: z.object({
    paperId: z.string().min(1).max(128),
    page: z.number().int().min(0),
    kind: z.enum(["passage", "figure", "table", "algorithm", "equation", "caption", "citation"]),
    text: z.string().max(3000).optional(),
    assetId: z.string().max(128).optional(),
    refId: z.string().max(128).optional(),
    bbox: BBoxSchema.optional(),
    sectionId: z.string().max(128).optional(),
  }).strict(),
}).strict();

export const VisualGenerationRequestSchema = z.object({
  paper: z.object({
    paperId: z.string().min(1).max(128).refine((value) => !value.startsWith("sha256:"), "Paper id must use the canonical representation."),
    title: z.string().trim().min(1).max(500),
    arxivId: z.string().max(64).nullable(),
  }).strict(),
  intent: z.enum([
    "explain",
    "visualize",
    "build-game",
    "concept-match",
    "figure-detective",
    "process-game",
    "prerequisite-map",
    "thread-expedition",
  ]),
  learningObjective: z.string().trim().min(1).max(240),
  difficulty: z.enum(["easy", "medium", "hard"]),
  learningMode: z.enum(["learn", "play", "quest"]),
  selection: z.object({
    text: z.string().trim().min(1).max(4000),
    page: z.number().int().min(0),
  }).strict(),
  section: z.object({ id: z.string().max(128), title: z.string().max(500), page: z.number().int().min(0) }).strict().optional(),
  sourceWindow: z.array(z.object({
    id: z.string().max(256),
    page: z.number().int().min(0),
    text: z.string().trim().min(1).max(4000),
    sectionId: z.string().max(128).optional(),
  }).strict()).min(1).max(7),
  concepts: z.array(z.object({ id: z.string().max(128), label: ConciseLabelSchema }).strict()).max(16),
  conceptThread: z.object({
    concept: ConciseLabelSchema,
    occurrences: z.array(z.object({ id: z.string().max(256), page: z.number().int().min(0), text: z.string().max(1200), evidenceId: EvidenceIdSchema }).strict()).max(12),
  }).strict().optional(),
  assets: z.array(z.object({
    id: z.string().max(128),
    kind: z.enum(["figure", "table", "algorithm", "equation"]),
    label: ConciseLabelSchema,
    page: z.number().int().min(0),
    caption: z.string().max(2000),
    evidenceIds: z.array(EvidenceIdSchema).min(1).max(4),
    imageUrl: z.string().max(1000).optional(),
  }).strict()).max(8),
  citations: z.array(z.object({ refIds: z.array(z.string().max(128)).max(16), text: z.string().max(1000), page: z.number().int().min(0) }).strict()).max(12),
  sourceEvidence: z.array(VerifiedSourceEvidenceSchema).min(1).max(32),
  evidenceGraph: z.object({
    rootClaimId: StableIdSchema,
    nodes: z.array(z.object({
      id: StableIdSchema,
      type: z.enum(["claim", "evidence", "passage", "figure", "table", "equation", "method", "experiment", "result", "dataset", "benchmark", "citation", "concept", "limitation"]),
      label: z.string().trim().min(1).max(500),
      evidenceIds: EvidenceIdsSchema,
    }).strict()).min(1).max(24),
    edges: z.array(z.object({
      id: StableIdSchema,
      source: StableIdSchema,
      target: StableIdSchema,
      type: z.enum(["supports", "reports-result", "produced-by", "uses-method", "evaluated-on", "compares-against", "cites", "extends", "contains", "mentions", "qualifies", "contradicts-candidate", "agrees-candidate", "generated-related"]),
      provenance: z.enum(["literal", "generated", "user"]),
      evidenceIds: EvidenceIdsSchema,
      reason: z.string().trim().min(1).max(500),
    }).strict()).max(40),
  }).strict().optional(),
  existingVisualLearningSpec: VisualLearningSpecSchema.optional(),
}).strict().superRefine((request, context) => {
  const evidenceIds = request.sourceEvidence.map((item) => item.id);
  if (new Set(evidenceIds).size !== evidenceIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceEvidence"], message: "Source evidence ids must be unique." });
  }
  request.sourceEvidence.forEach((item, index) => {
    if (item.source.paperId !== request.paper.paperId || item.source.paperId.startsWith("sha256:")) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceEvidence", index, "source", "paperId"], message: "Source evidence must use the request's canonical paper id." });
    }
  });
  const knownEvidence = new Set(evidenceIds);
  request.assets.forEach((asset, index) => {
    if (asset.evidenceIds.some((id) => !knownEvidence.has(id))) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["assets", index, "evidenceIds"], message: "Asset references unknown source evidence." });
    }
  });
  request.evidenceGraph?.nodes.forEach((node, index) => {
    if (node.evidenceIds.some((id) => !knownEvidence.has(id))) context.addIssue({ code: z.ZodIssueCode.custom, path: ["evidenceGraph", "nodes", index, "evidenceIds"], message: "Evidence graph node references unknown evidence." });
  });
  request.evidenceGraph?.edges.forEach((edge, index) => {
    if (edge.evidenceIds.some((id) => !knownEvidence.has(id))) context.addIssue({ code: z.ZodIssueCode.custom, path: ["evidenceGraph", "edges", index, "evidenceIds"], message: "Evidence graph edge references unknown evidence." });
  });
});

export type VisualLearningSpec = z.infer<typeof VisualLearningSpecSchema>;
export type VisualChallengeSpec = z.infer<typeof VisualChallengeSpecSchema>;
export type VisualGenerationRequest = z.infer<typeof VisualGenerationRequestSchema>;
export type VisualLearningGenerationResponse = z.infer<typeof VisualLearningGenerationResponseSchema>;
export type VisualChallengeGenerationResponse = z.infer<typeof VisualChallengeGenerationResponseSchema>;
export type VerifiedSourceEvidence = z.infer<typeof VerifiedSourceEvidenceSchema>;

export const visualLearningJsonSchema = zodToJsonSchema(
  VisualLearningGenerationResponseSchema,
  { name: "VisualLearningGenerationResponse", $refStrategy: "none" },
);

export const visualChallengeJsonSchema = zodToJsonSchema(
  VisualChallengeGenerationResponseSchema,
  { name: "VisualChallengeGenerationResponse", $refStrategy: "none" },
);
