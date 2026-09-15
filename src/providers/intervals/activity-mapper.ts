import type { ActivitySummary } from "../../domain/activity";
import type { IntervalsActivity } from "./intervals-types";

function optionalNumber(value: number | null | undefined): number | undefined {
  return value ?? undefined;
}

export function normalizeSport(type: string | null | undefined): string {
  const normalized = type?.toLowerCase().replaceAll(/[_\s-]/g, "") ?? "";
  if (normalized.includes("mountainbike") || normalized.includes("mtb")) return "mountain_biking";
  if (normalized.includes("gravel")) return "gravel_cycling";
  if (
    normalized.includes("virtualride") ||
    normalized.includes("indoorride") ||
    normalized.includes("rouvy") ||
    normalized.includes("trainer")
  ) {
    return "indoor_cycling";
  }
  if (normalized.includes("ride") || normalized.includes("cycling") || normalized.includes("bike")) {
    return "cycling";
  }
  if (normalized.includes("run")) return "running";
  if (normalized.includes("tennis")) return "tennis";
  if (normalized.includes("weight") || normalized.includes("strength")) return "strength";
  return "other";
}

export function mapActivity(activity: IntervalsActivity): ActivitySummary {
  const result: ActivitySummary = {
    id: String(activity.id),
    date: activity.start_date_local.slice(0, 10),
    sport: normalizeSport(activity.type),
    durationSeconds: activity.moving_time ?? activity.elapsed_time ?? 0,
  };
  const values: [keyof ActivitySummary, number | undefined][] = [
    ["distanceMeters", optionalNumber(activity.distance)],
    ["elevationGainMeters", optionalNumber(activity.total_elevation_gain)],
    ["trainingLoad", optionalNumber(activity.icu_training_load)],
    ["intensity", optionalNumber(activity.icu_intensity)],
    ["averageHeartRate", optionalNumber(activity.average_heartrate)],
    ["maximumHeartRate", optionalNumber(activity.max_heartrate)],
    ["averagePower", optionalNumber(activity.icu_average_watts)],
    ["normalizedPower", optionalNumber(activity.icu_weighted_avg_watts)],
    ["cadence", optionalNumber(activity.average_cadence)],
    ["aerobicDecoupling", optionalNumber(activity.decoupling)],
    ["trimp", optionalNumber(activity.trimp)],
    ["heartRateLoad", optionalNumber(activity.hr_load)],
    ["modeledFtp", optionalNumber(activity.icu_pm_ftp ?? activity.icu_rolling_ftp)],
    ["efficiencyFactor", optionalNumber(activity.icu_efficiency_factor)],
  ];
  for (const [key, value] of values) {
    if (value !== undefined) Object.assign(result, { [key]: value });
  }
  return result;
}
