import { describe, expect, it } from "vitest";
import { demoReading, IntakeUnavailableError, readSurplus } from "@/agents/intake";
import { allow } from "./rate-limit";

describe("rate limit", () => {
  it("allows up to the limit per window, then resets", () => {
    const t0 = 1_000_000;
    expect([1, 2, 3].map(() => allow("ip-a", 3, 60_000, t0))).toEqual([true, true, true]);
    expect(allow("ip-a", 3, 60_000, t0 + 1)).toBe(false);
    expect(allow("ip-b", 3, 60_000, t0 + 1)).toBe(true);
    expect(allow("ip-a", 3, 60_000, t0 + 60_000)).toBe(true);
  });
});

describe("intake without the AI", () => {
  it("reads a typed note with rules", async () => {
    const { mode, reading } = await readSurplus({ notes: "25 portions dal, kept hot" });
    expect(mode).toBe("demo");
    expect(reading).toEqual(demoReading("25 portions dal, kept hot"));
  });

  it("asks for a note instead of guessing what's in a photo", async () => {
    await expect(readSurplus({ notes: "", photo: { data: new Uint8Array([1]), mediaType: "image/jpeg" } })).rejects.toBeInstanceOf(
      IntakeUnavailableError,
    );
  });
});
