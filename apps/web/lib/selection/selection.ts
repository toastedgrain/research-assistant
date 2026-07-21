import type { PageTextItem } from "../mentions";
import type {
  NormalizedBBox,
  SelectionContext,
  TextItemRange,
} from "../research-context/types";

interface SelectionInput {
  page: number;
  text: string;
  items: PageTextItem[];
  itemRanges: TextItemRange[];
}

function rangeBBox(item: PageTextItem, range: TextItemRange): NormalizedBBox | null {
  const length = item.str.length;
  if (length === 0) return null;

  const start = Math.max(0, Math.min(length, range.startOffset));
  const end = Math.max(start, Math.min(length, range.endOffset));
  if (start === end) return null;

  const [x0, y0, x1, y1] = item.rect;
  const width = x1 - x0;
  return [x0 + width * (start / length), y0, x0 + width * (end / length), y1];
}

function unionBBoxes(boxes: NormalizedBBox[]): NormalizedBBox | undefined {
  if (boxes.length === 0) return undefined;
  return boxes.reduce<NormalizedBBox>(
    (result, box) => [
      Math.min(result[0], box[0]),
      Math.min(result[1], box[1]),
      Math.max(result[2], box[2]),
      Math.max(result[3], box[3]),
    ],
    boxes[0],
  );
}

export function createSelectionContext({
  page,
  text,
  items,
  itemRanges,
}: SelectionInput): SelectionContext | null {
  const selectedText = text.trim();
  if (page < 0 || selectedText.length === 0) return null;

  const validRanges = itemRanges
    .filter((range) => {
      const item = items[range.itemIndex];
      return Boolean(item) && range.startOffset >= 0 && range.endOffset > range.startOffset;
    })
    .map((range) => ({
      itemIndex: range.itemIndex,
      startOffset: Math.min(items[range.itemIndex].str.length, range.startOffset),
      endOffset: Math.min(items[range.itemIndex].str.length, range.endOffset),
    }))
    .filter((range) => range.endOffset > range.startOffset)
    .sort((a, b) => a.itemIndex - b.itemIndex || a.startOffset - b.startOffset);

  if (validRanges.length === 0) return null;

  const bbox = unionBBoxes(
    validRanges
      .map((range) => rangeBBox(items[range.itemIndex], range))
      .filter((box): box is NormalizedBBox => box !== null),
  );

  return {
    text: selectedText,
    page,
    itemRanges: validRanges,
    ...(bbox ? { bbox } : {}),
  };
}
