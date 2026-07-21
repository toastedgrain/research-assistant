"""The M0 deliverable: `python -m extract paper.pdf > manifest.json`."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from extract.__main__ import main


def test_prints_the_manifest_to_stdout(paper_pdf: Path, tmp_path: Path, capsys) -> None:
    """Redirecting stdout to a file must produce valid JSON and nothing else."""
    exit_code = main([str(paper_pdf), "--data-dir", str(tmp_path)])
    assert exit_code == 0

    manifest = json.loads(capsys.readouterr().out)
    assert manifest["page_count"] == 2


def test_stores_the_document_under_its_content_hash(
    paper_pdf: Path, tmp_path: Path, capsys
) -> None:
    """Spec D1: data/<digest>/ holds the PDF, the manifest and the crops."""
    main([str(paper_pdf), "--data-dir", str(tmp_path)])
    manifest = json.loads(capsys.readouterr().out)

    doc_dir = tmp_path / manifest["doc_id"].removeprefix("sha256:")
    assert (doc_dir / "paper.pdf").read_bytes() == paper_pdf.read_bytes()
    assert json.loads((doc_dir / "manifest.json").read_text(encoding="utf-8")) == manifest
    assert (doc_dir / "crops" / "fig-1.png").exists()


def test_second_run_reuses_the_cached_manifest(
    paper_pdf: Path, tmp_path: Path, capsys
) -> None:
    """Extraction runs once per unique PDF, ever. This is what makes the economics work."""
    main([str(paper_pdf), "--data-dir", str(tmp_path)])
    first = json.loads(capsys.readouterr().out)

    doc_dir = tmp_path / first["doc_id"].removeprefix("sha256:")
    marker = "cache hit marker"
    cached = json.loads((doc_dir / "manifest.json").read_text(encoding="utf-8"))
    cached["title"] = marker
    (doc_dir / "manifest.json").write_text(json.dumps(cached), encoding="utf-8")

    main([str(paper_pdf), "--data-dir", str(tmp_path)])
    assert json.loads(capsys.readouterr().out)["title"] == marker


def test_force_bypasses_the_cache(paper_pdf: Path, tmp_path: Path, capsys) -> None:
    main([str(paper_pdf), "--data-dir", str(tmp_path)])
    first = json.loads(capsys.readouterr().out)
    doc_dir = tmp_path / first["doc_id"].removeprefix("sha256:")
    cached = json.loads((doc_dir / "manifest.json").read_text(encoding="utf-8"))
    cached["title"] = "stale"
    (doc_dir / "manifest.json").write_text(json.dumps(cached), encoding="utf-8")

    main([str(paper_pdf), "--data-dir", str(tmp_path), "--force"])
    assert json.loads(capsys.readouterr().out)["title"] != "stale"


def test_records_an_arxiv_source(paper_pdf: Path, tmp_path: Path, capsys) -> None:
    main([str(paper_pdf), "--data-dir", str(tmp_path), "--arxiv-id", "1706.03762v7"])
    manifest = json.loads(capsys.readouterr().out)
    assert manifest["source"] == {"type": "arxiv", "arxiv_id": "1706.03762v7"}


def test_scanned_pdf_exits_nonzero_with_a_clear_message(tmp_path: Path, capsys) -> None:
    import fitz

    doc = fitz.open()
    doc.new_page(width=612, height=792).draw_rect(
        fitz.Rect(50, 50, 500, 700), fill=(0.5, 0.5, 0.5)
    )
    path = tmp_path / "scanned.pdf"
    doc.save(str(path))
    doc.close()

    exit_code = main([str(path), "--data-dir", str(tmp_path / "data")])
    captured = capsys.readouterr()
    assert exit_code == 2
    assert "text layer" in captured.err
    assert captured.out == ""


def test_missing_file_exits_nonzero(tmp_path: Path, capsys) -> None:
    exit_code = main([str(tmp_path / "nope.pdf"), "--data-dir", str(tmp_path)])
    assert exit_code == 2
    assert "not found" in capsys.readouterr().err


def test_warnings_go_to_stderr_not_stdout(paper_pdf: Path, tmp_path: Path, capsys) -> None:
    """stdout is the manifest and nothing else, so the shell redirect stays clean."""
    main([str(paper_pdf), "--data-dir", str(tmp_path), "--verbose"])
    captured = capsys.readouterr()

    assert json.loads(captured.out)["page_count"] == 2  # stdout parses as the manifest
    assert "extracted 2 assets" in captured.err  # diagnostics went the other way
