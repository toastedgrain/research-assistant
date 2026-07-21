import type { PageTextItem } from "../mentions";
import type { SelectionContext, TextItemRange } from "../research-context/types";
import { createSelectionContext } from "./selection";

export interface SelectionAnchor {
  x: number;
  y: number;
}

export interface CapturedSelection {
  context: SelectionContext;
  anchor: SelectionAnchor;
}

function offsetWithin(element: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.setEnd(node, offset);
  return range.toString().length;
}

function itemRangesForRange(root: HTMLElement, range: Range): TextItemRange[] {
  const itemRanges: TextItemRange[] = [];
  const spans = root.querySelectorAll<HTMLElement>("[data-text-item-index]");

  spans.forEach((span) => {
    if (!range.intersectsNode(span)) return;
    const itemIndex = Number(span.dataset.textItemIndex);
    if (!Number.isInteger(itemIndex)) return;

    const length = span.textContent?.length ?? 0;
    const startOffset = span.contains(range.startContainer)
      ? offsetWithin(span, range.startContainer, range.startOffset)
      : 0;
    const endOffset = span.contains(range.endContainer)
      ? offsetWithin(span, range.endContainer, range.endOffset)
      : length;
    if (endOffset > startOffset) itemRanges.push({ itemIndex, startOffset, endOffset });
  });

  return itemRanges;
}

export function captureSelection(
  root: HTMLElement,
  page: number,
  items: PageTextItem[],
): CapturedSelection | null {
  const browserSelection = window.getSelection();
  if (!browserSelection || browserSelection.isCollapsed || browserSelection.rangeCount !== 1) {
    return null;
  }

  const range = browserSelection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

  const context = createSelectionContext({
    page,
    text: browserSelection.toString(),
    items,
    itemRanges: itemRangesForRange(root, range),
  });
  if (!context) return null;

  const rect = range.getBoundingClientRect();
  const menuHalfWidth = Math.min(165, window.innerWidth / 2 - 12);
  const below = rect.bottom + 8;
  return {
    context,
    anchor: {
      x: Math.max(
        menuHalfWidth + 12,
        Math.min(window.innerWidth - menuHalfWidth - 12, rect.left + rect.width / 2),
      ),
      y: below + 44 < window.innerHeight ? below : Math.max(12, rect.top - 44),
    },
  };
}
