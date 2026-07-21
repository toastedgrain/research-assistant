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
