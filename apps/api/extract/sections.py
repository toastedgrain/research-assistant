"""Section outline, for the reader's outline nav (spec section 8).

Uses the PDF's own table of contents when the producer wrote one, which is exact. Most
arXiv PDFs do not have one, so the fallback looks for numbered headings set larger than
body text. Precision-first: an outline that lists half the sections is fine, an outline
that lists sentences is not.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass

import fitz

from .textnorm import normalize

_NUMBERED_HEADING_RE = re.compile(r"^(\d+(?:\.\d+)*)\.?\s+(\S.*)$")
# Unnumbered headings that every paper has. Only accepted when set larger than body text.
_KNOWN_HEADINGS = {
    "abstract",
    "introduction",
    "references",
    "acknowledgments",
    "acknowledgements",
    "appendix",
    "conclusion",
    "conclusions",
    "related work",
}
_MAX_HEADING_CHARS = 80


@dataclass(frozen=True)
class Section:
    title: str
    page: int
    level: int


def _from_toc(doc: fitz.Document) -> list[Section]:
    return [
        Section(title=normalize(title), page=max(0, page - 1), level=level)
        for level, title, page in doc.get_toc()
        if normalize(title)
    ]


def _body_font_size(doc: fitz.Document) -> float:
    """The most common span size in the document is its body text."""
    sizes: Counter[float] = Counter()
    for page in doc:
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    if span["text"].strip():
                        sizes[round(span["size"], 1)] += len(span["text"])
    return sizes.most_common(1)[0][0] if sizes else 10.0


def _from_headings(doc: fitz.Document) -> list[Section]:
    body_size = _body_font_size(doc)
    sections: list[Section] = []

    for page_index, page in enumerate(doc):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [s for s in line.get("spans", []) if s["text"].strip()]
                if not spans:
                    continue
                text = normalize("".join(s["text"] for s in spans))
                if len(text) > _MAX_HEADING_CHARS:
                    continue
                size = max(s["size"] for s in spans)
                if size <= body_size:
                    continue

                match = _NUMBERED_HEADING_RE.match(text)
                if match is not None:
                    sections.append(
                        Section(
                            title=text,
                            page=page_index,
                            level=len(match.group(1).split(".")),
                        )
                    )
                elif text.strip().lower().rstrip(".") in _KNOWN_HEADINGS:
                    sections.append(Section(title=text, page=page_index, level=1))

    return sections


def detect_sections(doc: fitz.Document) -> list[Section]:
    toc = _from_toc(doc)
    return toc if toc else _from_headings(doc)
