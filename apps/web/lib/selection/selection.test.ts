import { describe, expect, it } from "vitest";
import type { PageTextItem } from "../mentions";
import { createSelectionContext } from "./selection";

const items: PageTextItem[] = [
  {
    str: "attention",
    hasEOL: true,
    rect: [0.2, 0.3, 0.6, 0.4],
  },
];

describe("createSelectionContext", () => {
  it("preserves the selected text and zero-based page", () => {
    const selection = createSelectionContext({
      page: 2,
      text: "tenti",
      items,
      itemRanges: [{ itemIndex: 0, startOffset: 2, endOffset: 7 }],
    });

    expect(selection?.page).toBe(2);
    expect(selection?.text).toBe("tenti");
    expect(selection?.itemRanges).toEqual([
      { itemIndex: 0, startOffset: 2, endOffset: 7 },
    ]);
  });

  it("interpolates within normalized coordinates without converting them again", () => {
    const selection = createSelectionContext({
      page: 0,
      text: "tenti",
      items,
      itemRanges: [{ itemIndex: 0, startOffset: 2, endOffset: 7 }],
    });

    expect(selection?.bbox?.[0]).toBeCloseTo(0.2889, 4);
    expect(selection?.bbox?.[1]).toBe(0.3);
    expect(selection?.bbox?.[2]).toBeCloseTo(0.5111, 4);
    expect(selection?.bbox?.[3]).toBe(0.4);
  });

  it("rejects empty or out-of-range selections", () => {
    expect(
      createSelectionContext({ page: 0, text: "  ", items, itemRanges: [] }),
    ).toBeNull();
    expect(
      createSelectionContext({
        page: 0,
        text: "missing",
        items,
        itemRanges: [{ itemIndex: 9, startOffset: 0, endOffset: 3 }],
      }),
    ).toBeNull();
  });
});
