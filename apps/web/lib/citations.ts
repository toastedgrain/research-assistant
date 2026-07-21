/**
 * Inline citation markers.
 *
 * Spec section 7a step 4. Python parses the bibliography into entries; the client finds
 * the markers in the body text and links them, because that needs the same pdf.js text
 * layer mention detection already works over.
 *
 * Author-year markers are matched *from the bibliography outward*: we look only for
 * surname/year pairs we already hold an entry for, rather than trying to recognise
 * citations generically. That makes an unknown pair a non-match by construction, which
 * is the precision-first behaviour spec section 11 asks for.
 */

import { flattenPage, rectForRange, type BBox, type PageTextItem } from "./mentions";

export interface CitationReference {
  ref_id: string;
  marker: string;
  arxiv_id: string | null;
  openable: boolean;
}

export interface Citation {
  refIds: string[];
  text: string;
  rect: BBox | null;
  /** True when at least one cited entry resolved to a paper we can actually open. */
  openable: boolean;
}

const NUMERIC_GROUP_RE = /\[(\d+(?:\s*[,;]\s*\d+|\s*[-–]\s*\d+)*)\]/g;
/** A citation group spanning more than this is a typo, not a reference list. */
const MAX_RANGE_SPAN = 40;
/** How far after a surname the year may appear: "Devlin et al., 2018". */
const AUTHOR_YEAR_WINDOW = 24;

function expandNumericGroup(body: string): string[] {
  const markers: string[] = [];
  for (const token of body.split(/\s*[,;]\s*/)) {
    const range = token.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (to < from || to - from > MAX_RANGE_SPAN) return [];
      for (let n = from; n <= to; n += 1) markers.push(String(n));
    } else if (/^\d+$/.test(token.trim())) {
      markers.push(token.trim());
    }
  }
  return markers;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "Devlin et al., 2018" -> surname and year, for building a body-text matcher. */
function splitAuthorYear(marker: string): { surname: string; year: string } | null {
  const match = marker.match(/^([^,]+?),\s*(\d{4})[a-z]?$/);
  if (!match) return null;
  const surname = match[1].replace(/\s+et al\.?$/i, "").trim();
  if (!/^[A-Z][\p{L}'-]*$/u.test(surname)) return null;
  return { surname, year: match[2] };
}

export function findCitations(
  items: PageTextItem[],
  options: { references: CitationReference[] },
): Citation[] {
  const { references } = options;
  const { text, owners } = flattenPage(items);

  const byMarker = new Map(references.map((r) => [r.marker, r]));
  const citations: Citation[] = [];
  const claim = (refIds: string[], surface: string, start: number, end: number) => {
    if (refIds.length === 0) return;
    citations.push({
      refIds,
      text: surface,
      rect: rectForRange(items, owners, start, end),
      openable: refIds.some((id) => references.find((r) => r.ref_id === id)?.openable),
    });
  };

  for (const match of text.matchAll(NUMERIC_GROUP_RE)) {
    const start = match.index ?? 0;
    const refIds = expandNumericGroup(match[1])
      .map((marker) => byMarker.get(marker)?.ref_id)
      .filter((id): id is string => Boolean(id));
    claim(refIds, match[0], start, start + match[0].length);
  }

  for (const reference of references) {
    const parts = splitAuthorYear(reference.marker);
    if (!parts) continue;
    const pattern = new RegExp(
      // The gap between surname and year is "et al., " or " and Chang, ", which contains
      // periods and commas. Restricting the character class instead of the length is what
      // keeps this from spanning a sentence boundary.
      String.raw`\(?\b${escapeRegExp(parts.surname)}\b[\s\w.,&'-]{0,${AUTHOR_YEAR_WINDOW}}?\(?${parts.year}\)?`,
      "g",
    );
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      claim([reference.ref_id], match[0], start, start + match[0].length);
    }
  }

  return citations.sort((a, b) => (a.rect?.[1] ?? 0) - (b.rect?.[1] ?? 0) || (a.rect?.[0] ?? 0) - (b.rect?.[0] ?? 0));
}
