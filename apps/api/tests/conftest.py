"""Shared fixtures.

Tests build their PDFs with PyMuPDF rather than checking real papers into the repo:
fixture PDFs are gitignored (see /.gitignore), and a synthetic page lets a test assert
exact geometry instead of eyeballing a crop. Real papers are exercised by /eval.
"""

from __future__ import annotations

from pathlib import Path

import fitz
import pytest

PAGE_W = 612.0
PAGE_H = 792.0

# Top-left origin, in points. Deliberately in the TOP HALF of the page so the
# coordinate-conversion test has something unambiguous to assert (spec section 5).
FIGURE_RECT = (100.0, 80.0, 500.0, 300.0)
CAPTION_BASELINE = 320.0
BODY_BASELINE = 500.0


def _write_page(doc: fitz.Document, *, caption: str, body_lines: list[str]) -> None:
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    page.draw_rect(fitz.Rect(*FIGURE_RECT), color=(0, 0, 0), fill=(0.2, 0.4, 0.8))
    page.insert_text((100.0, CAPTION_BASELINE), caption, fontsize=9)
    for i, line in enumerate(body_lines):
        page.insert_text((100.0, BODY_BASELINE + i * 14.0), line, fontsize=10)


# Page 0 of the two-page paper fixture: a figure with body text above and below it.
PAPER_FIGURE_RECT = (90.0, 300.0, 520.0, 520.0)
# Page 1: a table whose caption sits ABOVE its body, the usual convention in ML papers.
PAPER_TABLE_ROWS_TOP = 140.0


@pytest.fixture(scope="session")
def paper_pdf(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """Two pages shaped like a real paper, for region detection.

    Page 0: body text, a figure, its caption BELOW it, more body text.
    Page 1: a table caption ABOVE its rows, then body text.
    """
    doc = fitz.open()

    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    for i, line in enumerate(
        [
            "We introduce a model that processes sequences in parallel.",
            "The overall design is shown in Figure 1 and detailed in Section 3.",
            "Training follows the recipe of prior work with minor changes.",
        ]
    ):
        page.insert_text((90.0, 120.0 + i * 14.0), line, fontsize=10)
    page.draw_rect(fitz.Rect(*PAPER_FIGURE_RECT), color=(0, 0, 0), fill=(0.85, 0.9, 0.95))
    page.insert_text((150.0, 420.0), "encoder", fontsize=8)  # a label inside the figure
    page.insert_text(
        (90.0, 540.0), "Figure 1: Overview of the proposed architecture.", fontsize=9
    )
    for i, line in enumerate(
        [
            "Each layer applies attention followed by a feed-forward block.",
            "We compare against the baselines described in Section 2.",
        ]
    ):
        page.insert_text((90.0, 580.0 + i * 14.0), line, fontsize=10)

    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    page.insert_text(
        (90.0, 120.0), "Table 1: Ablation results on the validation set.", fontsize=9
    )
    for i, row in enumerate(
        [
            "Model                 Params        BLEU        Accuracy",
            "Baseline              65M           27.3        91.2",
            "Ours                  213M          28.4        93.7",
        ]
    ):
        page.insert_text((90.0, PAPER_TABLE_ROWS_TOP + i * 16.0), row, fontsize=9)
    for i, line in enumerate(
        [
            "Removing the residual connection costs two points of accuracy.",
            "We therefore keep it in all remaining experiments.",
        ]
    ):
        page.insert_text((90.0, 300.0 + i * 14.0), line, fontsize=10)

    path = tmp_path_factory.mktemp("pdfs") / "paper.pdf"
    doc.save(str(path))
    doc.close()
    return path


@pytest.fixture(scope="session")
def synthetic_pdf(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """One page: a filled rect in the top half, its caption below, then body text."""
    doc = fitz.open()
    _write_page(
        doc,
        caption="Figure 1: A synthetic figure used by the geometry tests.",
        body_lines=[
            "The architecture is shown in Figure 1 and evaluated below.",
            "We compare against the baselines described in Section 2.",
        ],
    )
    path = tmp_path_factory.mktemp("pdfs") / "synthetic.pdf"
    doc.save(str(path))
    doc.close()
    return path
