import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SelectionMenu from "./SelectionMenu";

describe("SelectionMenu accessibility", () => {
  it("keeps source-learning actions semantic, focus-visible, and available without a pointer", () => {
    const markup = renderToStaticMarkup(
      <SelectionMenu
        anchor={{ x: 8, y: 8 }}
        onContext={() => undefined}
        onTrace={() => undefined}
        onCopy={() => undefined}
        onClose={() => undefined}
        onUnderstand={() => undefined}
        onVisualize={() => undefined}
        onPlay={() => undefined}
      />,
    );
    expect(markup).toContain('role="toolbar"');
    expect(markup).toContain("Understand");
    expect(markup).toContain("Visualize");
    expect(markup).toContain("Play");
    expect(markup).toContain("focus-visible:outline");
  });
});
