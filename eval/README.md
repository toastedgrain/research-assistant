# Accuracy harness

Spec section 11 asks for this at M0 rather than later, because reading tools die from one
wrong popup. It is split across two languages for the same reason the pipeline is: figure
regions are produced in Python, mentions are produced in TypeScript, so each is measured
where it runs.

```bash
# figure/table extraction, against fixtures/papers/*.pdf
cd apps/api && uv run python -m eval.figures

# mention detection
cd apps/web && npm run eval:mentions
```

`fixtures/papers/` is gitignored, so fetch the PDFs first (be polite to arXiv: identify
the client and pause between requests), then run the extractor once to populate `data/`.

## Latest reproducible local results

| Metric | Target (spec section 11) | Result |
|---|---|---|
| Caption coverage | — | 9/9 (100%) on the available Attention fixture |
| Extraction wall time, 15pp | < 30s | 1.2s — **PASS** |
| Mention detection precision | >= 99% | 100% — **PASS**, but on 2 labelled pages only |
| Mention detection recall | >= 95% | 100% — **PASS**, but on 2 labelled pages only |
| Figure region IoU > 0.8 | >= 90% of assets | **UNMEASURED** — no bbox labels |
| Caption attached correctly | >= 95% | **UNMEASURED** |

The earlier three-paper run reported 39/43 caption-openers found, but only the Attention PDF
is present in `fixtures/papers/` in the current checkout. Do not silently combine historical
and current fixture sets into one result.

Read the mention numbers with the sample size in mind. Two pages of one paper is a smoke
test with a percentage attached, not evidence the 99% precision target is met.

**Caption coverage** is the fraction of caption openers found in a paper's text that
produced an asset in the manifest. It is a recall proxy, not the spec's IoU metric: it
answers "did we drop a figure?" and says nothing about whether the region is correct.
Regions have so far been checked by eye, which is what the plan's phase 1 gate asks for,
but eye-checking does not produce a number and does not survive a refactor.

Closing the IoU gap needs hand-labelled bounding boxes. That work is outstanding and the
harness deliberately reports it as unmeasured rather than inventing a number: a green
metric nobody labelled is worse than an honest gap, and this whole project is an argument
for precision over comfortable-looking output.

The spec asks for 30 hand-labelled papers and the plan cuts that to 10. Neither exists
yet; `fixtures/labels/` holds what has been labelled so far — two pages of one paper.

## Labelling

`fixtures/labels/<arxiv-id>.json`. Page indices are 0-based, matching the manifest.

```jsonc
{
  "mentions": { "2": ["fig-1"] },        // asset ids a reader would click on that page
  "assets":   { "fig-1": [0.1, 0.2, 0.9, 0.5] }  // true region, normalized top-left
}
```

Label mentions by reading the page text, not by reading the tool's output — otherwise
the harness measures agreement with itself. The one labelled page here is a good example
of why it matters: page 2 of *Attention Is All You Need* contains the string "Figure 1"
twice, and one of them is the figure's own caption, which is not a mention of itself.
