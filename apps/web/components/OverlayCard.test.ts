import { describe, expect, it } from "vitest";
import { capRailCards, cancelRailFrame, layoutRail, type CardState, type RailAnchor } from "./OverlayCard";

const anchors: RailAnchor[] = [
  { cardId: "fig-1", anchorY: 120, height: 180 },
  { cardId: "fig-2", anchorY: 150, height: 160 },
  { cardId: "fig-3", anchorY: 610, height: 140 },
];

describe("layoutRail", () => {
  it("is deterministic for the same anchors", () => {
    expect([...layoutRail(anchors, 760)]).toEqual([...layoutRail(anchors, 760)]);
  });

  it("keeps cards separated by the 12px rail gap", () => {
    const positions = layoutRail(anchors, 760);
    const ordered = anchors
      .map((card) => ({ ...card, y: positions.get(card.cardId)! }))
      .sort((a, b) => a.y - b.y);

    for (let index = 1; index < ordered.length; index += 1) {
      expect(ordered[index].y).toBeGreaterThanOrEqual(
        ordered[index - 1].y + ordered[index - 1].height + 12,
      );
    }
  });

  it("keeps a four-card stack inside both rail edges", () => {
    const cards: RailAnchor[] = [
      { cardId: "a", anchorY: 20, height: 130 },
      { cardId: "b", anchorY: 80, height: 130 },
      { cardId: "c", anchorY: 700, height: 130 },
      { cardId: "d", anchorY: 740, height: 130 },
    ];
    const positions = layoutRail(cards, 620);

    for (const card of cards) {
      const y = positions.get(card.cardId)!;
      expect(y).toBeGreaterThanOrEqual(16);
      expect(y + card.height).toBeLessThanOrEqual(620 - 16);
    }
  });
});

describe("rail scheduler lifecycle", () => {
  it("clears a cancelled frame so Strict Mode can schedule again", () => {
    const frame = { current: 17 };
    const cancelled: number[] = [];
    cancelRailFrame(frame, (handle) => cancelled.push(handle));
    expect(cancelled).toEqual([17]);
    expect(frame.current).toBeNull();
  });
});

describe("four-card cap", () => {
  it("evicts the oldest soft pin before a hard pin", () => {
    const cards: CardState[] = [
      { assetId: "soft", anchorMentionId: null, hard: false, order: 0 },
      ...[1, 2, 3, 4].map((order) => ({
        assetId: `hard-${order}`,
        anchorMentionId: null,
        hard: true,
        order,
      })),
    ];
    expect(capRailCards(cards, 4).map((card) => card.assetId)).toEqual([
      "hard-1",
      "hard-2",
      "hard-3",
      "hard-4",
    ]);
  });
});
