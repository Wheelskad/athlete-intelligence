import { addDays } from "../../application/date-range";
import type { ActivitySummary } from "../../domain/activity";
import type { DailyRecovery } from "../../domain/recovery";
import type { PlannedEvent } from "../../domain/training-context";

export interface FixtureData {
  activities: ActivitySummary[];
  recovery: DailyRecovery[];
  events: PlannedEvent[];
}

export function buildFixtureData(anchorDate: string): FixtureData {
  const activities: ActivitySummary[] = [
    { id: "fixture-a1", date: addDays(anchorDate, -1), sport: "mountain_biking", durationSeconds: 5_400, distanceMeters: 31_500, elevationGainMeters: 720, trainingLoad: 92, intensity: 88, averageHeartRate: 151, maximumHeartRate: 176, averagePower: 208, normalizedPower: 241, cadence: 78, aerobicDecoupling: 3.2, trimp: 110, heartRateLoad: 92, modeledFtp: 245, efficiencyFactor: 1.6 },
    { id: "fixture-a2", date: addDays(anchorDate, -3), sport: "running", durationSeconds: 2_700, distanceMeters: 8_100, elevationGainMeters: 65, trainingLoad: 51, intensity: 79, averageHeartRate: 143, maximumHeartRate: 166, cadence: 171, trimp: 72, heartRateLoad: 51 },
    { id: "fixture-a3", date: addDays(anchorDate, -5), sport: "tennis", durationSeconds: 4_800, trainingLoad: 61, intensity: 72, averageHeartRate: 132, maximumHeartRate: 169, trimp: 65, heartRateLoad: 61 },
    { id: "fixture-a4", date: addDays(anchorDate, -8), sport: "indoor_cycling", durationSeconds: 3_600, distanceMeters: 25_000, trainingLoad: 48, intensity: 63, averagePower: 175, normalizedPower: 188, cadence: 86, trimp: 55, heartRateLoad: 48, modeledFtp: 240, efficiencyFactor: 1.4 },
    { id: "fixture-a5", date: addDays(anchorDate, -11), sport: "strength", durationSeconds: 2_100, trainingLoad: 32, trimp: 25, heartRateLoad: 32 },
  ];
  const recovery = Array.from({ length: 28 }, (_, index): DailyRecovery => {
    return {
      date: addDays(anchorDate, -index),
      sleepDurationMinutes: 410 + index * 2,
      sleepScore: 72 + index * 0.25,
      restingHeartRate: 55 - index * 0.5,
      hrv: 42 + index * 0.5,
      stress: 4 + (index % 3),
      bodyBattery: 58 - (index % 5),
      fatigue: 4 + (index % 2),
      soreness: 3 + (index % 2),
      motivation: 7 - (index % 2),
      fitnessLoad: 30 - index * 0.4,
      fatigueLoad: 35 - index,
      rampRate: 0.4,
      vo2Max: 45 - index * 0.03,
    };
  });
  const events: PlannedEvent[] = [
    { date: addDays(anchorDate, 2), category: "WORKOUT", sport: "cycling", durationMinutes: 90, trainingLoad: 70 },
    { date: addDays(anchorDate, 4), category: "WORKOUT", sport: "running", durationMinutes: 45, trainingLoad: 48 },
  ];
  return { activities, recovery, events };
}
