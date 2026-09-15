import { describe, expect, it } from "vitest";
import { FixtureProvider } from "../providers/fixture-provider";
import { getWeekSummary } from "./get-week-summary";
import { getConsolidatedTrainingMetrics } from "./get-consolidated-training-metrics";

const options = {
  timezone: "Europe/Paris",
  maxHistoryDays: 42,
  now: () => new Date("2026-09-14T07:30:00.000Z"),
};

describe("consolidated training metrics", () => {
  it("compares rolling weeks and consolidates consistency and sport mix", async () => {
    const summary = await getWeekSummary(
      FixtureProvider.anchoredAt("2026-09-14"),
      { startDate: "2026-09-01", endDate: "2026-09-14" },
      options,
    );
    const result = getConsolidatedTrainingMetrics(summary);

    expect(result.weeklyTrend).toHaveLength(2);

    expect(result.rolling7Days.current).toMatchObject({
      period: { startDate: "2026-09-08", endDate: "2026-09-14" },
      sessionCount: 3,
      durationMinutes: 215,
      trainingLoad: 204,
    });
    expect(result.rolling7Days.previous).toMatchObject({
      period: { startDate: "2026-09-01", endDate: "2026-09-07" },
      sessionCount: 2,
      durationMinutes: 95,
      trainingLoad: 80,
    });
    expect(result.rolling7Days.changePercent).toMatchObject({
      sessionsPercent: 50,
      durationPercent: 126.3,
      trainingLoadPercent: 155,
    });
    expect(result.consistency).toEqual({
      activeDays: 5,
      activeDaysPerWeek: 2.5,
      sessionsPerWeek: 2.5,
      averageSessionDurationMinutes: 62,
      longestSessionMinutes: 90,
    });
    expect(result.loadProfile).toEqual({
      averageWeeklyTrainingLoad: 142,
      averageLoadPerSession: 56.8,
    });
    expect(result.sportMix.mountain_biking).toMatchObject({
      durationSharePercent: 29,
      trainingLoadSharePercent: 32.4,
    });
  });

  it("marks the comparison unavailable for a seven-day history", async () => {
    const summary = await getWeekSummary(
      FixtureProvider.anchoredAt("2026-09-14"),
      {},
      options,
    );
    const result = getConsolidatedTrainingMetrics(summary);
    expect(result.weeklyTrend).toHaveLength(1);
    expect(result.dataQuality.comparisonAvailable).toBe(false);
    expect(result.rolling7Days).not.toHaveProperty("previous");
  });
});
