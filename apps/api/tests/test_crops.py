"""Crop rendering (spec section 6 stage 3)."""

from __future__ import annotations

from pathlib import Path

import fitz
import pytest

from extract.crops import render_asset_crop, render_thumbnail

from .conftest import PAGE_H, PAGE_W, PAPER_FIGURE_RECT
from extract.geometry import normalize_rect


@pytest.fixture
def figure_page(paper_pdf: Path):
    doc = fitz.open(str(paper_pdf))
    yield doc[0]
    doc.close()


def test_writes_a_png(figure_page, tmp_path: Path) -> None:
    dest = tmp_path / "fig-1.png"
    crop = render_asset_crop(figure_page, (0.2, 0.4, 0.8, 0.6), dest)
    assert crop.path == dest
    assert dest.read_bytes()[:4] == b"\x89PNG"


def test_renders_at_300_dpi(figure_page, tmp_path: Path) -> None:
    """A crop that is fuzzy at reading zoom is useless; spec fixes this at 300 DPI."""
    bbox = normalize_rect(PAPER_FIGURE_RECT, PAGE_W, PAGE_H)
    crop = render_asset_crop(figure_page, bbox, tmp_path / "fig.png", padding=0.0)
    expected = (PAPER_FIGURE_RECT[2] - PAPER_FIGURE_RECT[0]) * 300 / 72
    assert crop.width == pytest.approx(expected, abs=2)


def test_padding_expands_the_crop(figure_page, tmp_path: Path) -> None:
    """2% padding keeps a crop from shaving an axis label off the edge."""
    bbox = normalize_rect(PAPER_FIGURE_RECT, PAGE_W, PAGE_H)
    tight = render_asset_crop(figure_page, bbox, tmp_path / "a.png", padding=0.0)
    padded = render_asset_crop(figure_page, bbox, tmp_path / "b.png", padding=0.02)
    assert padded.width > tight.width


def test_thumbnail_is_half_width(figure_page, tmp_path: Path) -> None:
    crop = render_asset_crop(figure_page, (0.2, 0.4, 0.8, 0.6), tmp_path / "fig.png")
    thumb = render_thumbnail(crop.path, tmp_path / "fig.thumb.png")
    assert thumb.width == pytest.approx(crop.width / 2, abs=1)


def test_creates_missing_parent_directories(figure_page, tmp_path: Path) -> None:
    dest = tmp_path / "crops" / "nested" / "fig-1.png"
    render_asset_crop(figure_page, (0.2, 0.4, 0.8, 0.6), dest)
    assert dest.exists()
