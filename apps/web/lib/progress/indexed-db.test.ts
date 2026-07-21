import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { IndexedDbProgressRepository } from "./indexed-db";
import { completeChallenge, emptyProgress } from "./types";

describe("IndexedDB learning progress", () => {
  it("persists challenge completion, mastery, and current quest section", async () => {
    const name = `progress-${crypto.randomUUID()}`;
    const first = new IndexedDbProgressRepository({ databaseName: name });
    await first.saveProgress(completeChallenge(emptyProgress("paper", 1), { id: "quiz", concepts: ["attention"] }, "sec-2", 2));
    const reloaded = await new IndexedDbProgressRepository({ databaseName: name }).getProgress("paper");
    expect(reloaded).toMatchObject({ completedChallengeIds: ["quiz"], conceptMastery: { attention: "mastered" }, currentSectionId: "sec-2" });
  });
});
