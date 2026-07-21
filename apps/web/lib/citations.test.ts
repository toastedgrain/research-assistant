/**
 * Citation markers, detected client-side alongside mentions.
 *
 * This is spec section 7a step 4 - linking inline markers to bibliography entries -
 * living in TypeScript because it needs the same text layer mention detection uses.
 */

import { describe, expect, it } from "vitest";
import { findCitations } from "./citations";
import type { PageTextItem } from "./mentions";

function line(words: string[], y = 0.5): PageTextItem[] {
  return words.map((str, i) => {
    const x = 0.1 + i * 0.026;
    return { str, hasEOL: i === words.length - 1, rect: [x, y, x + 0.02, y + 0.012] as never };
  });
}

const REFERENCES = [
  { ref_id: "ref-1", marker: "1", arxiv_id: "1607.06450", openable: true },
  { ref_id: "ref-2", marker: "2", arxiv_id: null, openable: false },
  { ref_id: "ref-3", marker: "3", arxiv_id: "1409.0473", openable: true },
  { ref_id: "ref-4", marker: "4", arxiv_id: "1512.03385", openable: true },
  {
    ref_id: "ref-devlin-et-al-2018",
    marker: "Devlin et al., 2018",
    arxiv_id: "1810.04805",
    openable: true,
  },
];

const detect = (items: PageTextItem[]) => findCitations(items, { references: REFERENCES });

describe("numeric markers", () => {
  it("links a single bracketed marker", () => {
    const citations = detect(line(["as", "shown", "by", "[1]", "the"]));
    expect(citations).toHaveLength(1);
    expect(citations[0].refIds).toEqual(["ref-1"]);
    expect(citations[0].openable).toBe(true);
  });

  it("splits a comma list into several references", () => {
    expect(detect(line(["prior", "work", "[1,", "3]"]))[0].refIds).toEqual(["ref-1", "ref-3"]);
  });

  it("expands a range", () => {
    expect(detect(line(["prior", "work", "[1-4]"]))[0].refIds).toEqual([
      "ref-1",
      "ref-2",
      "ref-3",
      "ref-4",
    ]);
  });

  it("ignores a marker with no matching entry", () => {
    // Spec section 11: never render a dead affordance.
    expect(detect(line(["see", "[97]"]))).toHaveLength(0);
  });

  it("is not openable when no cited entry resolved to a paper", () => {
    const citation = detect(line(["see", "[2]"]))[0];
    expect(citation.refIds).toEqual(["ref-2"]);
    expect(citation.openable).toBe(false);
  });

  it("is openable when at least one entry in a group resolved", () => {
    expect(detect(line(["see", "[1,", "2]"]))[0].openable).toBe(true);
  });
});

describe("author-year markers", () => {
  it("links a parenthesised author-year citation", () => {
    const citations = detect(line(["shown", "by", "(Devlin", "et", "al.,", "2018)"]));
    expect(citations[0]?.refIds).toEqual(["ref-devlin-et-al-2018"]);
  });

  it("links a bare author-year citation", () => {
    const citations = detect(line(["Devlin", "et", "al.", "(2018)", "showed"]));
    expect(citations[0]?.refIds).toEqual(["ref-devlin-et-al-2018"]);
  });

  it("ignores an unknown author-year pair", () => {
    expect(detect(line(["shown", "by", "(Smith", "et", "al.,", "1999)"]))).toHaveLength(0);
  });
});

describe("false positives", () => {
  it("ignores a bracketed non-citation", () => {
    expect(detect(line(["the", "set", "[a,", "b]", "is"]))).toHaveLength(0);
  });

  it("ignores a year in running prose", () => {
    expect(detect(line(["published", "in", "2018", "by", "the", "team"]))).toHaveLength(0);
  });

  it("gives every citation a rect", () => {
    const citation = detect(line(["as", "shown", "by", "[1]", "the"]))[0];
    expect(citation.rect).not.toBeNull();
    expect(citation.rect![2]).toBeGreaterThan(citation.rect![0]);
  });
});
