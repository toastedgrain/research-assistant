import type {
  AssetRef,
  ConceptRef,
  PassageRef,
  SectionRef,
  SourceEvidence,
} from "../research-context/types";

export type LearningObjectKind =
  | "concept"
  | "claim"
  | "evidence"
  | "figure"
  | "table"
  | "equation"
  | "definition"
  | "experiment";

export interface LearningObjectBase {
  id: string;
  kind: LearningObjectKind;
  paperId: string;
  label: string;
  evidence: SourceEvidence[];
  confidence: number;
}

export interface ConceptObject extends LearningObjectBase {
  kind: "concept";
  aliases: string[];
  prerequisites: string[];
  occurrences: PassageRef[];
}

export interface ClaimObject extends LearningObjectBase {
  kind: "claim";
  claimText: string;
  supportingEvidenceIds: string[];
}

export interface ExperimentObject extends LearningObjectBase {
  kind: "experiment";
  hypothesis?: string;
  methodEvidence: SourceEvidence[];
  resultEvidence: SourceEvidence[];
}

export interface EvidenceObject extends LearningObjectBase {
  kind: "evidence";
}

export interface FigureObject extends LearningObjectBase {
  kind: "figure";
  asset: AssetRef;
}

export interface TableObject extends LearningObjectBase {
  kind: "table";
  asset: AssetRef;
}

export interface EquationObject extends LearningObjectBase {
  kind: "equation";
}

export interface DefinitionObject extends LearningObjectBase {
  kind: "definition";
  definitionText: string;
}

export type LearningObject =
  | ConceptObject
  | ClaimObject
  | EvidenceObject
  | FigureObject
  | TableObject
  | EquationObject
  | DefinitionObject
  | ExperimentObject;

export interface ConceptOccurrence {
  id: string;
  page: number;
  passage: PassageRef;
  evidence: SourceEvidence;
  nearbyAssets: AssetRef[];
}

export interface ConceptThreadGroup {
  section?: SectionRef;
  occurrences: ConceptOccurrence[];
}

export interface ConceptThread {
  id: string;
  paperId: string;
  concept: ConceptRef;
  occurrences: ConceptOccurrence[];
  groups: ConceptThreadGroup[];
}

export type DifficultySignalKind =
  | "sentence-complexity"
  | "symbol-density"
  | "citation-density"
  | "introduced-term-density"
  | "technical-term-density"
  | "parenthetical-density"
  | "asset-dependency";

export interface DifficultySignal {
  kind: DifficultySignalKind;
  label: string;
  value: number;
}

/** A relative reading-aid signal, never a claim about research quality. */
export interface LearningRegion {
  id: string;
  sectionId: string;
  pageStart: number;
  pageEnd: number;
  difficulty: number;
  reasons: DifficultySignal[];
  concepts: ConceptRef[];
  assets: AssetRef[];
}

export type PrerequisiteNodeKind = "source-derived" | "suggested";

export interface PrerequisiteNode {
  id: string;
  label: string;
  kind: PrerequisiteNodeKind;
  generated: boolean;
  source: SourceEvidence[];
}

export interface PrerequisiteEdge {
  from: string;
  to: string;
  kind: PrerequisiteNodeKind;
  generated: boolean;
  source: SourceEvidence[];
}

export interface PrerequisiteGraph {
  rootConceptId: string;
  nodes: PrerequisiteNode[];
  edges: PrerequisiteEdge[];
  generated: boolean;
  source: SourceEvidence[];
}

export interface DiagramNode {
  id: string;
  label: string;
  kind: "concept" | "source" | "asset";
  evidence: SourceEvidence[];
}

export interface DiagramEdge {
  from: string;
  to: string;
  label: string;
  evidence: SourceEvidence[];
}

/** Controlled, renderer-owned diagram data. Never executable generated UI. */
export interface MiniDiagram {
  id: string;
  label: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  source: SourceEvidence[];
}
