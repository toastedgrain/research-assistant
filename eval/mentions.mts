/**
 * Mention detection accuracy (spec section 11).
 *
 * Runs in Node rather than Python because mention detection is client-side (plan
 * deviation 1). Run from apps/web so the pdfjs-dist and tsx resolutions work:
 *
 *     cd apps/web && npm run eval:mentions
 *
 * With no labels it reports what was detected, which is a smoke test rather than an
 * accuracy measurement, and says so. Precision and recall are only printed for pages
 * that have hand-labelled mentions in fixtures/labels/<paper>.json under "mentions".
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const PAPERS = join(REPO, "fixtures", "papers");
const LABELS = join(REPO, "fixtures", "labels");
const DATA = join(REPO, "data");

// Resolved by path, not by name: this file lives in eval/, which has no node_modules of
// its own, so a bare specifier would not resolve.
const pdfjs = await import(
  pathToFileURL(join(REPO, "apps/web/node_modules/pdfjs-dist/legacy/build/pdf.mjs")).href
);
const { findMentions } = await import("../apps/web/lib/mentions.ts");

// A bare Windows path is not a valid ESM specifier; pdf.js needs a file:// URL.
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  join(REPO, "apps/web/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
).href;

/*
 * Errors only. Under Node, pdf.js warns once per embedded standard font because it
 * fetches font data and Node's fetch cannot read file:// URLs. Font data affects
 * rendering, and this harness only reads the text layer, so the warnings are pure noise
 * - and noise in an accuracy report is how a real failure gets scrolled past.
 */
const FONT_NOISE = /standardFontDataUrl|Unable to load font data/;
const realWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  if (!FONT_NOISE.test(String(args[0]))) realWarn(...args);
};

/** Mirrors apps/web/lib/pdf.ts: pdf.js viewport -> normalized top-left. */
async function itemsFor(page) {
  const content = await page.getTextContent();
  const { width, height } = page.getViewport({ scale: 1 });
  return content.items
    .filter((item) => "str" in item)
    .map((item) => {
      const [, , , scaleY, x, y] = item.transform;
      const h = Math.abs(scaleY) || item.height || 10;
      const top = height - y - h;
      return {
        str: item.str,
        hasEOL: Boolean(item.hasEOL),
        rect: [x / width, top / height, (x + (item.width || 0)) / width, (top + h) / height],
      };
    });
}

function manifestFor(stem) {
  for (const dir of readdirSync(DATA)) {
    const path = join(DATA, dir, "manifest.json");
    if (!existsSync(path)) continue;
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    if (manifest.source?.arxiv_id?.startsWith(stem) || manifest.__stem === stem) return manifest;
  }
  return null;
}

const rows = [];
for (const file of readdirSync(PAPERS).filter((f) => f.endsWith(".pdf"))) {
  const stem = file.replace(/\.pdf$/, "");
  const manifest = manifestFor(stem);
  if (!manifest) {
    console.error(`${stem}: no manifest in data/ - run the extractor first`);
    continue;
  }

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(readFileSync(join(PAPERS, file))),
  }).promise;

  const labelPath = join(LABELS, `${stem}.json`);
  const labels = existsSync(labelPath) ? JSON.parse(readFileSync(labelPath, "utf8")) : {};
  const labelled = labels.mentions ?? {};

  let total = 0;
  let resolved = 0;
  let truePositives = 0;
  let claimed = 0;
  let expected = 0;

  for (let index = 0; index < doc.numPages; index += 1) {
    const page = await doc.getPage(index + 1);
    const mentions = findMentions(await itemsFor(page), {
      page: index,
      assets: manifest.assets,
    });
    total += mentions.length;
    resolved += mentions.filter((m) => m.assetId !== null).length;

    const truth = labelled[String(index)];
    if (!truth) continue;
    const got = mentions.filter((m) => m.assetId !== null).map((m) => m.assetId).sort();
    const want = [...truth].sort();
    expected += want.length;
    claimed += got.length;
    const remaining = [...want];
    for (const id of got) {
      const at = remaining.indexOf(id);
      if (at !== -1) {
        remaining.splice(at, 1);
        truePositives += 1;
      }
    }
  }

  rows.push({ stem, pages: doc.numPages, total, resolved, truePositives, claimed, expected });
}

console.log("paper            pages  mentions  resolved  labelled-pages");
for (const row of rows) {
  console.log(
    `${row.stem.padEnd(16)}${String(row.pages).padStart(5)}` +
      `${String(row.total).padStart(10)}${String(row.resolved).padStart(10)}` +
      `${(row.expected ? "yes" : "no").padStart(16)}`,
  );
}

const claimed = rows.reduce((sum, r) => sum + r.claimed, 0);
const expected = rows.reduce((sum, r) => sum + r.expected, 0);
const hits = rows.reduce((sum, r) => sum + r.truePositives, 0);

console.log();
if (expected === 0) {
  console.log(
    "precision/recall: UNMEASURED - no hand-labelled mentions in fixtures/labels/.\n" +
      "The counts above are a smoke test: they show detection runs end to end on real\n" +
      "papers, not that it is correct.",
  );
} else {
  const precision = claimed ? hits / claimed : 0;
  const recall = hits / expected;
  console.log(
    `precision ${(precision * 100).toFixed(1)}% (target 99%) ` +
      `${precision >= 0.99 ? "PASS" : "FAIL"}`,
  );
  console.log(
    `recall    ${(recall * 100).toFixed(1)}% (target 95%) ${recall >= 0.95 ? "PASS" : "FAIL"}`,
  );
}
