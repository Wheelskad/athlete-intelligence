import { describe, expect, it } from "vitest";
import { average, relativeTrend } from "./statistics";

describe("statistics", () => {
  it("calculates an average while ignoring missing values and preserving zero", () => {
    expect(average([undefined, 0, 10, undefined, 20])).toBe(10);
    expect(average([undefined])).toBeUndefined();
  });

  it("compares current and reference periods using the product threshold", () => {
    expect(relativeTrend(43, 48, 1, 1, true)).toBe("declining");
    expect(relativeTrend(54, 51, 1, 1, false)).toBe("declining");
    expect(relativeTrend(51, 50, 1, 1, true)).toBe("stable");
  });

  it("returns unknown when coverage is below 60 percent", () => {
    expect(relativeTrend(43, 48, 0.59, 1, true)).toBe("unknown");
    expect(relativeTrend(43, 48, 1, 0.59, true)).toBe("unknown");
  });
});
