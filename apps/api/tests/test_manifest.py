"""Manifest assembly - the artifact everything downstream renders (spec D3)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft7Validator

from extract.manifest import ScannedPdfError, build_manifest

SCHEMA_PATH = (
    Path(__file__).resolve().parents[3] / "packages" / "schema" / "manifest.schema.json"
)


@pytest.fixture(scope="module")
def schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def built(paper_pdf: Path, tmp_path_factory: pytest.TempPathFactory):
    blob_dir = tmp_path_factory.mktemp("blob")
    manifest = build_manifest(paper_pdf.read_bytes(), blob_dir=blob_dir)
    return manifest, blob_dir


def test_manifest_matches_the_published_schema(built, schema) -> None:
    """The schema is the Python/TS contract; Python must not drift from it."""
    manifest, _ = built
    errors = sorted(Draft7Validator(schema).iter_errors(manifest), key=lambda e: e.path)
    assert errors == [], "\n".join(f"{list(e.path)}: {e.message}" for e in errors)


def test_reports_pages_and_assets(built) -> None:
    manifest, _ = built
    assert manifest["page_count"] == 2
    assert {a["asset_id"] for a in manifest["assets"]} == {"fig-1", "tab-1"}


def test_records_the_backend_that_produced_the_regions(built) -> None:
    manifest, _ = built
    assert manifest["extraction"]["figure_backend"] == "caption-heuristic"


def test_writes_a_crop_for_every_asset(built) -> None:
    manifest, blob_dir = built
    for asset in manifest["assets"]:
        name = Path(asset["image_url"]).name
        assert (blob_dir / "crops" / name).exists()
        assert asset["image_width"] > 0


def test_image_url_is_keyed_by_content_hash(built) -> None:
    """Spec D1: the blob path is derived from the hash, so it is cacheable forever."""
    manifest, _ = built
    digest = manifest["doc_id"].removeprefix("sha256:")
    for asset in manifest["assets"]:
        assert asset["image_url"] == f"/blob/{digest}/crops/{asset['asset_id']}.png"


def test_identical_bytes_produce_an_identical_doc_id(paper_pdf: Path, tmp_path: Path) -> None:
    a = build_manifest(paper_pdf.read_bytes(), blob_dir=tmp_path / "a")
    b = build_manifest(paper_pdf.read_bytes(), blob_dir=tmp_path / "b")
    assert a["doc_id"] == b["doc_id"]


def test_arxiv_source_is_recorded(paper_pdf: Path, tmp_path: Path) -> None:
    manifest = build_manifest(
        paper_pdf.read_bytes(), blob_dir=tmp_path, arxiv_id="1706.03762v7"
    )
    assert manifest["source"] == {"type": "arxiv", "arxiv_id": "1706.03762v7"}


def test_upload_source_is_the_default(built) -> None:
    manifest, _ = built
    assert manifest["source"] == {"type": "upload", "arxiv_id": None}


def test_scanned_pdf_fails_loudly(tmp_path: Path) -> None:
    """Spec section 6 stage 1: degrade with a clear message, never an empty manifest."""
    import fitz

    doc = fitz.open()
    doc.new_page(width=612, height=792).draw_rect(
        fitz.Rect(50, 50, 500, 700), fill=(0.5, 0.5, 0.5)
    )
    path = tmp_path / "scanned.pdf"
    doc.save(str(path))
    doc.close()

    with pytest.raises(ScannedPdfError):
        build_manifest(path.read_bytes(), blob_dir=tmp_path / "blob")


def test_dropped_assets_are_reported_as_warnings(tmp_path: Path) -> None:
    import fitz

    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((90.0, 400.0), "Figure 9: A caption with no figure.", fontsize=9)
    # Enough prose to clear the scanned-PDF gate; this test is about warnings, not ingest.
    for i, line in enumerate(
        [
            "This document has a healthy text layer but no figure to go with the caption.",
            "The extractor should therefore drop the asset and say so in the warnings.",
        ]
    ):
        page.insert_text((90.0, 500.0 + i * 14.0), line, fontsize=10)
    path = tmp_path / "orphan.pdf"
    doc.save(str(path))
    doc.close()

    manifest = build_manifest(path.read_bytes(), blob_dir=tmp_path / "blob")
    assert manifest["assets"] == []
    assert any("fig-9" in w for w in manifest["extraction"]["warnings"])
