"""Rendering asset crops as PNGs (spec section 6 stage 3).

Two rules from the spec that are easy to get wrong:

- 300 DPI, because figures get read at zoom and a fuzzy crop is worse than no crop.
- The caption is NOT rendered into the image. It is stored as manifest text so it stays
  selectable and searchable, and so the client can re-typeset it in the overlay card.
  figures.py already excludes it from the region; this module must not add it back.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import fitz

from .geometry import BBox, denormalize_bbox, pad_bbox

DEFAULT_DPI = 300
DEFAULT_PADDING = 0.02
THUMBNAIL_FACTOR = 2


@dataclass(frozen=True)
class RenderedCrop:
    path: Path
    width: int
    height: int


def render_asset_crop(
    page: fitz.Page,
    bbox: BBox,
    dest: Path,
    *,
    dpi: int = DEFAULT_DPI,
    padding: float = DEFAULT_PADDING,
) -> RenderedCrop:
    """Render `bbox` of `page` to a PNG at `dest`."""
    padded = pad_bbox(bbox, padding)
    clip = fitz.Rect(*denormalize_bbox(padded, page.rect.width, page.rect.height))
    pixmap = page.get_pixmap(matrix=fitz.Matrix(dpi / 72, dpi / 72), clip=clip)

    dest.parent.mkdir(parents=True, exist_ok=True)
    pixmap.save(str(dest))
    return RenderedCrop(path=dest, width=pixmap.width, height=pixmap.height)


def render_thumbnail(
    source: Path, dest: Path, *, factor: int = THUMBNAIL_FACTOR
) -> RenderedCrop:
    """Downscaled copy, so the client can show a small card without decoding a 1680px PNG."""
    pixmap = fitz.Pixmap(str(source))
    thumb = fitz.Pixmap(pixmap, 0) if pixmap.alpha else pixmap
    thumb = fitz.Pixmap(
        thumb, max(1, round(thumb.width / factor)), max(1, round(thumb.height / factor)), None
    )

    dest.parent.mkdir(parents=True, exist_ok=True)
    thumb.save(str(dest))
    return RenderedCrop(path=dest, width=thumb.width, height=thumb.height)
