"""Figure and table region detection - the primary backend (plan deviation 2).

The bar these tests encode is spec section 11: a crop that cuts off an axis label is
useless (IoU > 0.8), and precision beats recall everywhere - detecting nothing is better
than detecting a region that swallows body text.
"""

from __future__ import annotations

from pathlib import Path

import fitz
import pytest

from extract.figures import detect_assets
from extract.geometry import iou, normalize_rect

from .conftest import PAGE_H, PAGE_W, PAPER_FIGURE_RECT


@pytest.fixture(scope="module")
def assets(paper_pdf: Path):
    doc = fitz.open(str(paper_pdf))
    found, _warnings = detect_assets(doc)
    doc.close()
    return {a.asset_id: a for a in found}


def test_finds_the_figure_and_the_table(assets) -> None:
    assert set(assets) == {"fig-1", "tab-1"}


def test_figure_region_matches_the_drawing(assets) -> None:
    """Spec section 11: IoU > 0.8 against the true region."""
    expected = normalize_rect(PAPER_FIGURE_RECT, PAGE_W, PAGE_H)
    assert iou(assets["fig-1"].bbox, expected) > 0.8


def test_figure_region_excludes_body_text(assets) -> None:
    """The paragraph above the figure must not be swallowed into the crop.

    Body text ends around y=150pt (0.19 normalized); the figure starts at 300pt (0.379).
    """
    assert assets["fig-1"].bbox[1] > 0.25


def test_figure_caption_is_below_its_region(assets) -> None:
    fig = assets["fig-1"]
    assert fig.caption_bbox is not None
    assert fig.caption_bbox[1] >= fig.bbox[3] - 0.01


def test_caption_text_is_captured_and_normalized(assets) -> None:
    assert assets["fig-1"].caption == "Figure 1: Overview of the proposed architecture."


def test_caption_is_not_cropped_into_the_image(assets) -> None:
    """Spec section 6 stage 3: the caption is stored as text, never rasterized."""
    fig = assets["fig-1"]
    assert fig.bbox[3] <= fig.caption_bbox[1] + 0.01


def test_table_region_is_below_its_caption(assets) -> None:
    """Table captions sit above their body, the opposite of figures."""
    table = assets["tab-1"]
    assert table.bbox[1] >= table.caption_bbox[3] - 0.01


def test_table_region_excludes_the_following_paragraph(assets) -> None:
    """Rows end near y=180pt (0.227); the next paragraph starts at 300pt (0.379)."""
    assert assets["tab-1"].bbox[3] < 0.35


def test_pages_are_zero_based(assets) -> None:
    assert assets["fig-1"].page == 0
    assert assets["tab-1"].page == 1


def test_degenerate_regions_are_rejected(tmp_path: Path) -> None:
    """A caption with no detectable region yields no asset, not an empty crop.

    Precision-first: rendering nothing beats rendering a blank box.
    """
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    page.insert_text((90.0, 400.0), "Figure 9: A caption with nothing above it.", fontsize=9)
    path = tmp_path / "empty.pdf"
    doc.save(str(path))
    doc.close()

    doc = fitz.open(str(path))
    found, warnings = detect_assets(doc)
    doc.close()

    assert found == []
    assert any("fig-9" in w for w in warnings)


def test_subfigure_records_its_parent(assets) -> None:
    assert assets["fig-1"].parent_id is None
