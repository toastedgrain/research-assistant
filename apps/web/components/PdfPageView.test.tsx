import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PDFDocumentProxy } from "pdfjs-dist";
import PdfPageView from "./PdfPageView";

vi.mock("../lib/pdf", () => ({ mountTextLayer: vi.fn() }));

describe("PdfPageView figure anchors", () => {
  it("exposes stable mention, asset, and evidence regions without changing hotspot styling", () => {
    const markup = renderToStaticMarkup(
      <PdfPageView
        doc={{} as PDFDocumentProxy}
        pageIndex={3}
        width={760}
        active={false}
        dark={false}
        mentions={[{
          kind: "figure",
          number: "2",
          text: "Figure 2",
          page: 3,
          index: 5,
          assetId: "fig-2",
          rect: [0.1, 0.2, 0.3, 0.24],
        }]}
        citations={[]}
        textItems={[]}
        onOpenAsset={() => undefined}
        onOpenCitation={() => undefined}
        onTextSelection={() => undefined}
        highlightedAssetId={null}
        flashAssetId="fig-2"
        assetRegions={[{ assetId: "fig-2", bbox: [0.2, 0.4, 0.8, 0.75] }]}
        evidenceBBox={[0.3, 0.5, 0.6, 0.62]}
      />,
    );

    expect(markup).toContain('data-mention-id="fig-2:p3:m5"');
    expect(markup).toContain('data-mention-asset="fig-2"');
    expect(markup).toContain('data-asset-region="fig-2"');
    expect(markup).toContain('data-evidence-region="true"');
    expect(markup).toContain("border-sky-500/60");
    expect(markup).toContain("rgba(245,158,11,0.45)");
  });
});
