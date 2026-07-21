"""Caption-anchored figure and table region detection.

This is the primary backend, not a fallback (plan deviation 2): PDFFigures2 needs a JVM
and Docling pulls multi-GB torch models, neither of which fits the budget. Working from
PyMuPDF's vector-drawing and image data also handles TikZ-drawn figures, which spec D2
calls out as the common case in ML papers.

The shape of the heuristic:

    caption anchor  ->  search the band on the caption's content side
                    ->  cluster graphics/rows separated by less than a line gap
                    ->  absorb text that sits inside the cluster (axis labels)
                    ->  reject anything degenerate

Rejection is a feature. Spec section 11 wants precision over recall everywhere: a caption
with no defensible region produces a warning and no asset, never an empty crop.
"""

from __future__ import annotations

from dataclasses import dataclass

import fitz

from .captions import CaptionAnchor, parse_caption_start
from .geometry import BBox, area, intersection_area, normalize_rect
from .textnorm import clean_block_text

# Figures caption below their content; tables and algorithms caption above theirs.
_CONTENT_ABOVE_CAPTION = {"figure": True, "table": False, "algorithm": False, "equation": True}

# Two pieces of one figure (a plot and its legend) sit closer together than a figure sits
# to the surrounding prose. Expressed as a fraction of page height.
_CLUSTER_GAP = 0.045
# Do not look further from the caption than this: a figure is never a whole page away.
_SEARCH_WINDOW = 0.6
# Spec-plan gate: a region smaller than this is degenerate.
_MIN_AREA = 0.01
# ...or one that has swallowed this much of a paragraph.
_MAX_BODY_OVERLAP = 0.3
# A text block this wide with this many words is prose, not part of a figure.
_BODY_MIN_WIDTH = 0.4
_BODY_MIN_WORDS = 12


@dataclass(frozen=True)
class DetectedAsset:
    asset_id: str
    kind: str
    label: str
    number: str
    page: int
    bbox: BBox
    caption: str
    caption_bbox: BBox
    parent_id: str | None


@dataclass(frozen=True)
class _Block:
    bbox: BBox
    text: str

    @property
    def words(self) -> int:
        return len(self.text.split())

    @property
    def is_body_prose(self) -> bool:
        return (
            self.bbox[2] - self.bbox[0]
        ) >= _BODY_MIN_WIDTH and self.words >= _BODY_MIN_WORDS


def _union(a: BBox, b: BBox) -> BBox:
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def _x_overlaps(a: BBox, b: BBox, margin: float = 0.05) -> bool:
    """Horizontal overlap, the cheap stand-in for column detection.

    In a two-column paper a right-column figure never overlaps a left-column caption, so
    this keeps clusters from spanning the gutter without a real column model.
    """
    return a[0] - margin < b[2] and a[2] + margin > b[0]


def _vertical_gap(a: BBox, b: BBox) -> float:
    if a[3] < b[1]:
        return b[1] - a[3]
    if b[3] < a[1]:
        return a[1] - b[3]
    return 0.0


def _page_graphics(page: fitz.Page) -> list[BBox]:
    """Vector drawings and raster images, normalized. The raw material of a figure."""
    w, h = page.rect.width, page.rect.height
    rects: list[BBox] = []
    for drawing in page.get_drawings():
        rect = drawing["rect"]
        if rect.is_empty or rect.is_infinite:
            continue
        rects.append(normalize_rect(rect, w, h))
    for image in page.get_images(full=True):
        for rect in page.get_image_rects(image[0]):
            if not rect.is_empty:
                rects.append(normalize_rect(rect, w, h))
    return rects


def _page_blocks(page: fitz.Page) -> list[_Block]:
    w, h = page.rect.width, page.rect.height
    blocks: list[_Block] = []
    for x0, y0, x1, y1, text, _no, block_type in page.get_text("blocks"):
        if block_type != 0:
            continue
        cleaned = clean_block_text(text)
        if cleaned:
            blocks.append(_Block(normalize_rect((x0, y0, x1, y1), w, h), cleaned))
    return blocks


def _cluster(seeds: list[BBox], caption: BBox, above: bool) -> BBox | None:
    """Grow a region outward from whichever candidate sits closest to the caption."""
    if above:
        candidates = [r for r in seeds if r[3] <= caption[1] + 0.005]
    else:
        candidates = [r for r in seeds if r[1] >= caption[3] - 0.005]
    candidates = [
        r
        for r in candidates
        if _x_overlaps(r, caption) and _vertical_gap(r, caption) <= _SEARCH_WINDOW
    ]
    if not candidates:
        return None

    candidates.sort(key=lambda r: _vertical_gap(r, caption))
    region = candidates[0]
    remaining = candidates[1:]
    grew = True
    while grew:
        grew = False
        for rect in list(remaining):
            if _vertical_gap(rect, region) <= _CLUSTER_GAP and _x_overlaps(rect, region):
                region = _union(region, rect)
                remaining.remove(rect)
                grew = True
    return region


def _absorb_inner_text(region: BBox, blocks: list[_Block]) -> BBox:
    """Pull in axis labels and tick text that sit inside the plotted area."""
    for block in blocks:
        block_area = area(block.bbox)
        if block_area <= 0 or block.is_body_prose:
            continue
        if intersection_area(region, block.bbox) / block_area >= 0.7:
            region = _union(region, block.bbox)
    return region


def _swallows_prose(region: BBox, blocks: list[_Block]) -> bool:
    for block in blocks:
        block_area = area(block.bbox)
        if block_area <= 0 or not block.is_body_prose:
            continue
        if intersection_area(region, block.bbox) / block_area > _MAX_BODY_OVERLAP:
            return True
    return False


def _best_candidate(
    candidates: list[tuple[CaptionAnchor, _Block]],
) -> tuple[CaptionAnchor, _Block]:
    """Break ties between blocks claiming the same label.

    A block opening "Figure 1:" beats a sentence opening "Figure 1 shows that ...", which
    is why captions.py reports the delimiter rather than guessing.
    """
    return max(candidates, key=lambda c: (c[0].has_delimiter, len(c[1].text)))


def detect_assets(doc: fitz.Document) -> tuple[list[DetectedAsset], list[str]]:
    """Detect every figure/table/algorithm in the document.

    Returns the assets plus warnings for captions that could not be resolved to a region.
    """
    warnings: list[str] = []
    # asset_id -> (anchor, caption block, page index, page blocks, page graphics)
    claims: dict[str, tuple[CaptionAnchor, _Block, int, list[_Block], list[BBox]]] = {}

    for page_index in range(doc.page_count):
        page = doc[page_index]
        blocks = _page_blocks(page)
        graphics = _page_graphics(page)
        for block in blocks:
            anchor = parse_caption_start(block.text)
            if anchor is None:
                continue
            existing = claims.get(anchor.asset_id)
            if existing is not None:
                keep = _best_candidate(
                    [(existing[0], existing[1]), (anchor, block)]
                )
                if keep[1] is existing[1]:
                    continue
            claims[anchor.asset_id] = (anchor, block, page_index, blocks, graphics)

    assets: list[DetectedAsset] = []
    for asset_id, (anchor, caption_block, page_index, blocks, graphics) in claims.items():
        above = _CONTENT_ABOVE_CAPTION[anchor.kind]
        other_blocks = [b for b in blocks if b is not caption_block]
        # Figures are drawn; tables are typeset. Seed each from the right material.
        seeds = graphics if anchor.kind in ("figure", "equation") else [
            b.bbox for b in other_blocks
        ]
        region = _cluster(seeds, caption_block.bbox, above)

        if region is None:
            warnings.append(
                f"page {page_index}: no region found for {asset_id}, asset dropped"
            )
            continue
        if anchor.kind in ("figure", "equation"):
            region = _absorb_inner_text(region, other_blocks)
        if area(region) < _MIN_AREA:
            warnings.append(
                f"page {page_index}: region for {asset_id} is degenerate "
                f"({area(region):.4f} of the page), asset dropped"
            )
            continue
        if _swallows_prose(region, other_blocks):
            warnings.append(
                f"page {page_index}: region for {asset_id} overlaps body text, asset dropped"
            )
            continue

        assets.append(
            DetectedAsset(
                asset_id=asset_id,
                kind=anchor.kind,
                label=anchor.label,
                number=anchor.number,
                page=page_index,
                bbox=region,
                caption=caption_block.text,
                caption_bbox=caption_block.bbox,
                parent_id=anchor.parent_id,
            )
        )

    assets.sort(key=lambda a: (a.page, a.bbox[1], a.bbox[0]))
    return assets, warnings
