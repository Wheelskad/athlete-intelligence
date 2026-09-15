import type { DailyRecovery } from "../../domain/recovery";
import type { IntervalsWellness } from "./intervals-types";

function sleepQuality(
  value: number | string | null | undefined,
): DailyRecovery["sleepQuality"] | undefined {
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["poor", "fair", "good", "excellent"].includes(normalized)) {
      return normalized as NonNullable<DailyRecovery["sleepQuality"]>;
    }
    return undefined;
  }
  if (value == null) return undefined;
  if (value <= 1) return "poor";
  if (value === 2) return "fair";
  if (value === 3) return "good";
  return "excellent";
}

export function mapWellness(record: IntervalsWellness): DailyRecovery {
  const result: DailyRecovery = { date: record.id.slice(0, 10) };
  const values: [keyof DailyRecovery, number | undefined][] = [
    ["sleepDurationMinutes", record.sleepSecs == null ? undefined : record.sleepSecs / 60],
    ["sleepScore", record.sleepScore ?? undefined],
    ["restingHeartRate", record.restingHR ?? undefined],
    ["hrv", record.hrv ?? undefined],
    ["stress", record.stress ?? undefined],
    ["bodyBattery", record.bodyBattery ?? undefined],
    ["fatigue", record.fatigue ?? undefined],
    ["soreness", record.soreness ?? undefined],
    ["motivation", record.motivation ?? undefined],
    ["weightKg", record.weight ?? undefined],
    ["fitnessLoad", record.ctl ?? undefined],
    ["fatigueLoad", record.atl ?? undefined],
    ["rampRate", record.rampRate ?? undefined],
    ["vo2Max", record.vo2max ?? undefined],
  ];
  for (const [key, value] of values) {
    if (value !== undefined) Object.assign(result, { [key]: value });
  }
  const quality = sleepQuality(record.sleepQuality);
  if (quality !== undefined) result.sleepQuality = quality;
  return result;
}
