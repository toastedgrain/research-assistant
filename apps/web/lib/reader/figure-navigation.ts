export interface FigureAnchorCandidate {
  assetId: string;
  mentionId: string;
  top: number;
  bottom: number;
}

/** Matches the useful reading band from the improved Reader without coupling it to UI. */
export function isFigureMentionActive(
  rect: Pick<FigureAnchorCandidate, "top">,
  viewportTop: number,
  viewportHeight: number,
): boolean {
  const top = rect.top - viewportTop;
  return top > viewportHeight * 0.1 && top < viewportHeight * 0.82;
}

/**
 * The current UI intentionally shows one automatic card at a time. Select the active
 * mention nearest the reading focus while hard-pinned cards remain untouched.
 */
export function activeFigureAnchor(
  candidates: readonly FigureAnchorCandidate[],
  viewportTop: number,
  viewportHeight: number,
): FigureAnchorCandidate | null {
  const focusY = viewportTop + viewportHeight * 0.38;
  return candidates
    .filter((candidate) => isFigureMentionActive(candidate, viewportTop, viewportHeight))
    .sort((left, right) => {
      const leftCenter = (left.top + left.bottom) / 2;
      const rightCenter = (right.top + right.bottom) / 2;
      return Math.abs(leftCenter - focusY) - Math.abs(rightCenter - focusY);
    })[0] ?? null;
}

export function mentionAnchorId(assetId: string, page: number, mentionIndex: number): string {
  return `${assetId}:p${page}:m${mentionIndex}`;
}

/** Convert a target's viewport position into the Reader scroll container's coordinates. */
export function targetScrollTop(
  currentScrollTop: number,
  targetTop: number,
  viewportTop: number,
  offset = 140,
): number {
  return Math.max(0, currentScrollTop + targetTop - viewportTop - offset);
}
