import { describe, expect, it } from "vitest";
import {
  activeFigureAnchor,
  isFigureMentionActive,
  mentionAnchorId,
  targetScrollTop,
} from "./figure-navigation";

describe("figure navigation", () => {
  it("tracks mentions inside the Reader viewport rather than the window origin", () => {
    expect(isFigureMentionActive({ top: 220 }, 100, 800)).toBe(true);
    expect(isFigureMentionActive({ top: 150 }, 100, 800)).toBe(false);
    expect(isFigureMentionActive({ top: 780 }, 100, 800)).toBe(false);
  });

  it("selects the active figure nearest the reading focus", () => {
    expect(activeFigureAnchor([
      { assetId: "fig-1", mentionId: "first", top: 220, bottom: 240 },
      { assetId: "fig-2", mentionId: "second", top: 395, bottom: 415 },
      { assetId: "fig-3", mentionId: "outside", top: 900, bottom: 920 },
    ], 100, 800)).toMatchObject({ assetId: "fig-2", mentionId: "second" });
  });

  it("creates stable mention anchors and exact container scroll offsets", () => {
    expect(mentionAnchorId("fig-2", 4, 3)).toBe("fig-2:p4:m3");
    expect(targetScrollTop(500, 430, 100)).toBe(690);
    expect(targetScrollTop(0, 80, 100)).toBe(0);
  });
});
