import { describe, expect, it } from "vitest";
import { passageEvidence } from "../evidence/source";
import { challengeEvidence } from "./contracts";
import { evidenceForDetails } from "./session";

describe("challenge evidence detail selection", () => {
  it("shows the evidence the learner clicked instead of the first accepted source", () => {
    const first = challengeEvidence(passageEvidence("paper", 0, "Evidence A"), "A");
    const second = challengeEvidence(passageEvidence("paper", 1, "Evidence B"), "B");
    expect(evidenceForDetails(second, first)).toBe(second);
    expect(evidenceForDetails(null, first)).toBe(first);
  });
});
