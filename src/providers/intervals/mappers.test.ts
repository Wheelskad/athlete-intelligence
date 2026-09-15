import { describe, expect, it } from "vitest";
import { mapActivity } from "./activity-mapper";
import { intervalsActivitySchema, intervalsWellnessSchema } from "./intervals-types";
import { mapWellness } from "./wellness-mapper";

describe("Intervals.icu mappers", () => {
  it("maps a complete activity", () => {
    const external = intervalsActivitySchema.parse({
      id: "fixture-activity",
      start_date_local: "2026-09-12T08:15:00",
      type: "MountainBikeRide",
      moving_time: 5_400,
      distance: 31_500,
      total_elevation_gain: 720,
      icu_training_load: 92,
      icu_intensity: 88,
      average_heartrate: 151,
      max_heartrate: 176,
      icu_average_watts: 208,
      icu_weighted_avg_watts: 241,
      average_cadence: 78,
      decoupling: 3.2,
      trimp: 110.4,
      hr_load: 92,
      icu_pm_ftp: 245,
      icu_efficiency_factor: 1.6,
      start_latlng: [0, 0],
      name: "Private place",
    });

    expect(mapActivity(external)).toEqual({
      id: "fixture-activity",
      date: "2026-09-12",
      sport: "mountain_biking",
      durationSeconds: 5_400,
      distanceMeters: 31_500,
      elevationGainMeters: 720,
      trainingLoad: 92,
      intensity: 88,
      averageHeartRate: 151,
      maximumHeartRate: 176,
      averagePower: 208,
      normalizedPower: 241,
      cadence: 78,
      aerobicDecoupling: 3.2,
      trimp: 110.4,
      heartRateLoad: 92,
      modeledFtp: 245,
      efficiencyFactor: 1.6,
    });
  });

  it("maps an activity without power or heart rate without inventing values", () => {
    const mapped = mapActivity(
      intervalsActivitySchema.parse({
        id: "fixture-minimal",
        start_date_local: "2026-09-10T18:00:00",
        type: "Tennis",
        elapsed_time: 3_600,
      }),
    );
    expect(mapped).toEqual({
      id: "fixture-minimal",
      date: "2026-09-10",
      sport: "tennis",
      durationSeconds: 3_600,
    });
    expect(mapped).not.toHaveProperty("averagePower");
    expect(mapped).not.toHaveProperty("averageHeartRate");
  });

  it("maps partial recovery records", () => {
    const mapped = mapWellness(
      intervalsWellnessSchema.parse({
        id: "2026-09-13",
        restingHR: 52,
        sleepSecs: 25_200,
        sleepQuality: 3,
        hrv: null,
        ctl: 23.27048,
        atl: 28.780535,
        rampRate: 0.36205482,
        vo2max: 45,
      }),
    );
    expect(mapped).toEqual({
      date: "2026-09-13",
      restingHeartRate: 52,
      sleepDurationMinutes: 420,
      sleepQuality: "good",
      fitnessLoad: 23.27048,
      fatigueLoad: 28.780535,
      rampRate: 0.36205482,
      vo2Max: 45,
    });
    expect(mapped).not.toHaveProperty("hrv");
  });
});
