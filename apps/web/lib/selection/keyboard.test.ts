import { describe, expect, it } from "vitest";
import { shouldCaptureKeyboardSelection } from "./keyboard";

describe("keyboard selection entry", () => {
  it("captures keyboard-created text selections without stealing ordinary navigation", () => {
    expect(shouldCaptureKeyboardSelection("ArrowRight", true)).toBe(true);
    expect(shouldCaptureKeyboardSelection("Enter", false)).toBe(true);
    expect(shouldCaptureKeyboardSelection("ArrowRight", false)).toBe(false);
    expect(shouldCaptureKeyboardSelection("Tab", false)).toBe(false);
  });
});
