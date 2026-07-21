"""Ingest: content hashing and the scanned-PDF gate (spec section 6 stage 1)."""

from __future__ import annotations

import re
from pathlib import Path

import fitz
import pytest

from extract.ingest import compute_doc_id, extract_title, has_text_layer, page_geometry

from .conftest import PAGE_H, PAGE_W


def test_doc_id_is_a_sha256_of_the_bytes(paper_pdf: Path) -> None:
    doc_id = compute_doc_id(paper_pdf.read_bytes())
    assert re.fullmatch(r"sha256:[0-9a-f]{64}", doc_id)


def test_doc_id_is_stable_across_calls(paper_pdf: Path) -> None:
    """Spec D1: the whole cache depends on this being a pure function of the bytes."""
    data = paper_pdf.read_bytes()
    assert compute_doc_id(data) == compute_doc_id(data)


def test_doc_id_differs_for_different_bytes(paper_pdf: Path) -> None:
    assert compute_doc_id(paper_pdf.read_bytes()) != compute_doc_id(b"not a pdf")


def test_detects_a_usable_text_layer(paper_pdf: Path) -> None:
    doc = fitz.open(str(paper_pdf))
    assert has_text_layer(doc) is True
    doc.close()


def test_flags_a_scanned_pdf(tmp_path: Path) -> None:
    """No text layer means no mentions and no hotspots. OCR is out of scope for v1, so
    this must fail loudly at ingest rather than produce an empty manifest."""
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    page.draw_rect(fitz.Rect(50, 50, 500, 700), fill=(0.5, 0.5, 0.5))
    path = tmp_path / "scanned.pdf"
    doc.save(str(path))
    doc.close()

    doc = fitz.open(str(path))
    assert has_text_layer(doc) is False
    doc.close()


def test_title_prefers_pdf_metadata(tmp_path: Path) -> None:
    doc = fitz.open()
    doc.new_page(width=PAGE_W, height=PAGE_H).insert_text(
        (90.0, 100.0), "Some Heading", fontsize=20
    )
    doc.set_metadata({"title": "Attention Is All You Need"})
    path = tmp_path / "titled.pdf"
    doc.save(str(path))
    doc.close()

    doc = fitz.open(str(path))
    assert extract_title(doc) == "Attention Is All You Need"
    doc.close()


def test_title_falls_back_to_largest_text_on_page_one(tmp_path: Path) -> None:
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    page.insert_text((90.0, 100.0), "Deep Residual Learning", fontsize=20)
    page.insert_text((90.0, 140.0), "Kaiming He, Xiangyu Zhang", fontsize=11)
    page.insert_text((90.0, 200.0), "Abstract. Deeper networks are harder to train.", fontsize=10)
    path = tmp_path / "untitled.pdf"
    doc.save(str(path))
    doc.close()

    doc = fitz.open(str(path))
    assert extract_title(doc) == "Deep Residual Learning"
    doc.close()


def test_page_geometry_reports_points(paper_pdf: Path) -> None:
    doc = fitz.open(str(paper_pdf))
    pages = page_geometry(doc)
    doc.close()
    assert [p["index"] for p in pages] == [0, 1]
    assert pages[0]["width_pt"] == pytest.approx(PAGE_W)
    assert pages[0]["height_pt"] == pytest.approx(PAGE_H)
