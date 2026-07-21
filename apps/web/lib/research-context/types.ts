export type NormalizedBBox = [number, number, number, number];

export interface PaperRef {
  id: string;
  title: string;
  sourceType: "upload" | "arxiv";
  arxivId?: string;
}

export interface TextItemRange {
  itemIndex: number;
  startOffset: number;
  endOffset: number;
}

export interface SelectionContext {
  text: string;
  page: number;
  itemRanges: TextItemRange[];
  bbox?: NormalizedBBox;
}

export interface SectionRef {
  id: string;
  title: string;
  page: number;
  level: number;
}

export interface PassageRef {
  id: string;
  paperId: string;
  page: number;
  text: string;
  itemRanges: TextItemRange[];
  bbox?: NormalizedBBox;
  sectionId?: string;
}

export interface AssetRef {
  id: string;
  paperId: string;
  kind: "figure" | "table" | "algorithm" | "equation";
  label: string;
  page: number;
  bbox: NormalizedBBox;
  caption: string;
}

export interface CitationRef {
  refIds: string[];
  text: string;
  page: number;
  bbox?: NormalizedBBox;
  openable: boolean;
}

export interface MentionRef {
  assetId?: string;
  kind: string;
  number: string;
  text: string;
  page: number;
  bbox?: NormalizedBBox;
}

export interface ConceptRef {
  id: string;
  paperId: string;
  label: string;
}

export interface SourceWindow {
  before: PassageRef[];
  selected?: PassageRef;
  after: PassageRef[];
}

export interface ResearchContext {
  paper: PaperRef;
  selection?: SelectionContext;
  section?: SectionRef;
  surroundingPassages: PassageRef[];
  concepts: ConceptRef[];
  nearbyAssets: AssetRef[];
  citations: CitationRef[];
  mentions: MentionRef[];
  sourceWindow: SourceWindow;
}

export interface SourceEvidence {
  paperId: string;
  page: number;
  kind: "passage" | "figure" | "table" | "equation" | "caption" | "citation";
  text?: string;
  assetId?: string;
  bbox?: NormalizedBBox;
  sectionId?: string;
}
