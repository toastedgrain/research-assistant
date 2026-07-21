import { describe, expect, it } from "vitest";
import { readerScrollBehavior } from "./motion";

describe("Reader reduced motion", () => {
  it("removes animated source jumps when reduced motion is requested", () => {
    expect(readerScrollBehavior(true)).toBe("auto");
    expect(readerScrollBehavior(false)).toBe("smooth");
  });
});
