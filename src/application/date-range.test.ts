import { describe, expect, it, vi } from "vitest";
import { assertIsoDate, validateDateRange } from "./date-range";
import { IntervalsClient } from "../providers/intervals/intervals-client";

describe("date ranges", () => {
  it("rejects invalid calendar dates", () => {
    expect(() => assertIsoDate("2026-02-30")).toThrow("not a valid calendar date");
    expect(() => assertIsoDate("14/09/2026")).toThrow("YYYY-MM-DD");
  });

  it("rejects ranges larger than the configured limit before network access", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const client = new IntervalsClient({
      apiKey: "fixture-secret",
      athleteId: "0",
      maxHistoryDays: 42,
      fetchImpl,
    });
    await expect(
      client.getActivities({ startDate: "2026-07-01", endDate: "2026-09-14" }),
    ).rejects.toThrow("between 1 and 42 days");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects future completed-activity dates", () => {
    expect(() =>
      validateDateRange(
        { startDate: "2026-09-10", endDate: "2026-09-15" },
        { maxDays: 42, today: "2026-09-14" },
      ),
    ).toThrow("cannot be in the future");
  });
});
