import { describe, expect, it } from "vitest";
import { FixtureProvider } from "../providers/fixture-provider";
import { getRecoverySummary } from "./get-recovery-summary";
import { getWeekSummary } from "./get-week-summary";

const NOW = new Date("2026-09-14T07:30:00.000Z");
const options = {
  timezone: "Europe/Paris",
  maxHistoryDays: 42,
  now: () => NOW,
};

describe("application summaries", () => {
  it("aggregates duration and load by normalized sport", async () => {
    const provider = FixtureProvider.anchoredAt("2026-09-14");
    const result = await getWeekSummary(provider, {}, options);
    expect(result.sessionCount).toBe(3);
    expect(result.durationMinutes).toBe(215);
    expect(result.trainingLoad).toBe(204);
    expect(result.activities.map((activity) => activity.date)).toEqual([
      "2026-09-13",
      "2026-09-11",
      "2026-09-09",
    ]);
    expect(result.dataQuality.unavailableActivityCount).toBe(0);
    expect(result.advancedMetrics).toEqual({
      totalTrimp: 247,
      totalHeartRateLoad: 204,
      latestModeledFtp: {
        date: "2026-09-13",
        sport: "mountain_biking",
        watts: 245,
      },
      averageEfficiencyFactor: 1.6,
    });
    expect(result.bySport).toEqual({
      mountain_biking: { durationMinutes: 90, sessionCount: 1, trainingLoad: 92 },
      running: { durationMinutes: 45, sessionCount: 1, trainingLoad: 51 },
      tennis: { durationMinutes: 80, sessionCount: 1, trainingLoad: 61 },
    });
  });

  it("computes factual recovery trends against the preceding window", async () => {
    const provider = FixtureProvider.anchoredAt("2026-09-14");
    const result = await getRecoverySummary(provider, { days: 7 }, options);
    expect(result.hrv.trend).toBe("declining");
    expect(result.restingHeartRate.trend).toBe("declining");
    expect(result.sleep.trend).toBe("stable");
    expect(result.dataQuality).toEqual({
      sleepCoverage: 1,
      restingHeartRateCoverage: 1,
      hrvCoverage: 1,
      loadDynamicsCoverage: 1,
      vo2MaxCoverage: 1,
    });
    expect(result.loadDynamics).toMatchObject({
      current: {
        date: "2026-09-14",
        fitness: 30,
        fatigue: 35,
        form: -5,
        acuteToChronicRatio: 1.17,
        rampRate: 0.4,
      },
      change7Days: {
        referenceDate: "2026-09-07",
        fitness: 2.8,
        fatigue: 7,
        form: -4.2,
      },
    });
    expect(result.loadDynamics?.history).toHaveLength(7);
    expect(result.loadDynamics?.history[0]?.date).toBe("2026-09-08");
    expect(result.loadDynamics?.history.at(-1)?.date).toBe("2026-09-14");
    expect(result.aerobicFitness?.vo2Max).toMatchObject({
      latest: 45,
      latestDate: "2026-09-14",
      changeOverPeriod: 0.2,
    });
    expect(result.aerobicFitness?.vo2Max.history).toHaveLength(7);
  });
});
