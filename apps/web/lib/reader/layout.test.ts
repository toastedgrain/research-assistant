import { describe, expect, it } from "vitest";
import { responsivePageWidth } from "./layout";

describe("responsive Reader page sizing", () => {
  it("fits narrow and split panes without exceeding available width", () => {
    expect(responsivePageWidth(360, 390)).toBe(344);
    expect(responsivePageWidth(520, 1200)).toBe(472);
  });

  it("preserves desktop quality without unbounded canvases", () => {
    expect(responsivePageWidth(1200, 1440)).toBe(840);
    expect(responsivePageWidth(180, 320)).toBe(164);
  });
});
