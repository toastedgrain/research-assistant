import type { SourceEvidence } from "../evidence/source";
import type { ResearchGraph, ResearchGraphEdge } from "../explore/graph";

export type ClaimSupportStatus =
  | "direct support located"
  | "partial/qualified support located"
  | "multiple supporting sources located"
  | "no direct supporting evidence located in indexed content"
  | "evidence relationship uncertain"
  | "generated candidate relationship";

export interface EvidencePacket {
  schemaVersion: 1;
  id: string;
  paperId: string;
  claimNodeId: string;
  canonicalClaimText: string;
  claimEvidence: SourceEvidence;
  supportingEvidence: SourceEvidence[];
  reportedResults: SourceEvidence[];
  figures: SourceEvidence[];
  tables: SourceEvidence[];
  methods: SourceEvidence[];
  experiments: SourceEvidence[];
  datasetsAndBenchmarks: SourceEvidence[];
  comparators: SourceEvidence[];
  limitations: SourceEvidence[];
  citations: SourceEvidence[];
  relationships: ResearchGraphEdge[];
  supportStatus: ClaimSupportStatus;
  missingSources: string[];
  graph: ResearchGraph;
}

export interface EvidenceInterpretation {
  generated: true;
  text: string;
  evidenceIds: string[];
  qualifications: string[];
  uncertainty: string | null;
}

export interface TensionCandidate {
  id: string;
  relation: "possible-tension" | "differing-result" | "qualification" | "agreement" | "extension";
  paperAId: string;
  paperBId: string;
  paperAEvidenceIds: string[];
  paperBEvidenceIds: string[];
  reason: string;
  provenance: "generated" | "literal";
  generated: boolean;
}

export interface InvestigatorResult {
  status: "ready" | "insufficient-evidence";
  interpretation?: EvidenceInterpretation;
  reason?: string;
}
