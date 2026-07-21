"""Figure/table extraction accuracy (spec section 11).

Run:  uv run python -m eval.figures [--papers ../../fixtures/papers]

Reports three things per paper:

- **Caption coverage** - the fraction of caption openers present in the text that
  produced an asset. This is a recall proxy: it answers "did we drop a figure?" and says
  nothing about whether the region we produced is correct.
- **Wall time**, against the spec's <30s for a 15-page paper.
- **IoU**, but only where hand-labelled boxes exist in fixtures/labels/. Where they do
  not, this prints "unlabelled" rather than a number. A green metric nobody labelled is
  worse than an honest gap.

The caption scan here is deliberately written independently of extract.captions, so that
a bug in the caption regex cannot hide itself by being on both sides of the comparison.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

import fitz

from extract.geometry import iou
from extract.manifest import ScannedPdfError, build_manifest

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_PAPERS = REPO_ROOT / "fixtures" / "papers"
LABELS_DIR = REPO_ROOT / "fixtures" / "labels"

# Independent of extract/captions.py on purpose. Deliberately loose: it over-counts
# slightly, which biases coverage downward rather than flattering it.
_CAPTION_SCAN_RE = re.compile(
    r"^\s*(Figure|Fig\.|Table|Algorithm)\s+(S?\d+[a-z]?|A\.\d+)\s*[:.]",
    re.IGNORECASE | re.MULTILINE,
)
_KIND_PREFIX = {"figure": "fig", "fig.": "fig", "table": "tab", "algorithm": "alg"}

TARGET_IOU = 0.8
TARGET_IOU_FRACTION = 0.9
TARGET_SECONDS_PER_15_PAGES = 30.0


def scan_captions(doc: fitz.Document) -> set[str]:
    """Every caption opener in the document, as asset ids."""
    found: set[str] = set()
    for page_index in range(doc.page_count):
        for kind, number in _CAPTION_SCAN_RE.findall(doc[page_index].get_text("text")):
            prefix = _KIND_PREFIX.get(kind.lower())
            if prefix:
                found.add(f"{prefix}-{number}")
    return found


def load_labels(stem: str) -> dict:
    path = LABELS_DIR / f"{stem}.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}


def evaluate(pdf_path: Path, blob_root: Path) -> dict:
    pdf_bytes = pdf_path.read_bytes()

    started = time.perf_counter()
    manifest = build_manifest(pdf_bytes, blob_dir=blob_root / pdf_path.stem)
    elapsed = time.perf_counter() - started

    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        expected = scan_captions(doc)

    produced = {asset["asset_id"] for asset in manifest["assets"]}
    covered = expected & produced

    labels = load_labels(pdf_path.stem)
    label_boxes = labels.get("assets", {})
    ious: list[float] = []
    for asset in manifest["assets"]:
        truth = label_boxes.get(asset["asset_id"])
        if truth:
            ious.append(iou(tuple(asset["bbox"]), tuple(truth)))

    pages = max(1, manifest["page_count"])
    return {
        "paper": pdf_path.stem,
        "title": manifest["title"],
        "pages": pages,
        "seconds": elapsed,
        "seconds_per_15pp": elapsed * 15 / pages,
        "expected_captions": len(expected),
        "produced_assets": len(produced),
        "covered": len(covered),
        "coverage": len(covered) / len(expected) if expected else None,
        "missed": sorted(expected - produced),
        "unexpected": sorted(produced - expected),
        "ious": ious,
        "warnings": manifest["extraction"]["warnings"],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--papers", type=Path, default=DEFAULT_PAPERS)
    parser.add_argument("--data-dir", type=Path, default=REPO_ROOT / "data" / "eval")
    args = parser.parse_args(argv)

    pdfs = sorted(args.papers.glob("*.pdf"))
    if not pdfs:
        print(f"no PDFs in {args.papers}", file=sys.stderr)
        return 1

    results = []
    for pdf in pdfs:
        try:
            results.append(evaluate(pdf, args.data_dir))
        except ScannedPdfError as error:
            print(f"{pdf.stem}: skipped ({error})", file=sys.stderr)

    print(f"{'paper':<16}{'pages':>6}{'sec':>7}{'captions':>10}{'found':>7}{'coverage':>10}")
    for r in results:
        coverage = "n/a" if r["coverage"] is None else f"{r['coverage'] * 100:.0f}%"
        print(
            f"{r['paper']:<16}{r['pages']:>6}{r['seconds']:>7.1f}"
            f"{r['expected_captions']:>10}{r['covered']:>7}{coverage:>10}"
        )
        for asset_id in r["missed"]:
            print(f"    missed {asset_id}")

    print()
    total_expected = sum(r["expected_captions"] for r in results)
    total_covered = sum(r["covered"] for r in results)
    if total_expected:
        print(f"caption coverage: {total_covered}/{total_expected} "
              f"({total_covered / total_expected * 100:.1f}%)")

    slowest = max((r["seconds_per_15pp"] for r in results), default=0.0)
    verdict = "PASS" if slowest < TARGET_SECONDS_PER_15_PAGES else "FAIL"
    print(f"wall time, worst case per 15pp: {slowest:.1f}s "
          f"(target <{TARGET_SECONDS_PER_15_PAGES:.0f}s) {verdict}")

    all_ious = [value for r in results for value in r["ious"]]
    if all_ious:
        good = sum(1 for value in all_ious if value > TARGET_IOU)
        fraction = good / len(all_ious)
        verdict = "PASS" if fraction >= TARGET_IOU_FRACTION else "FAIL"
        print(f"region IoU >{TARGET_IOU}: {good}/{len(all_ious)} "
              f"({fraction * 100:.0f}%, target {TARGET_IOU_FRACTION * 100:.0f}%) {verdict}")
    else:
        print("region IoU: UNMEASURED - no hand-labelled boxes in fixtures/labels/")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
