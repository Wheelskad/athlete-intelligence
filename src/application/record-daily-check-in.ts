import type { AthleteDataProvider } from "../domain/provider";
import type { DailyCheckInUpdate } from "../domain/training-context";
import { dateInTimezone } from "./date-range";
import type { ApplicationOptions } from "./get-week-summary";

export async function recordDailyCheckIn(
  provider: AthleteDataProvider,
  update: DailyCheckInUpdate,
  options: ApplicationOptions,
): Promise<{ updated: true; date: string; recordedFields: string[] }> {
  const now = options.now?.() ?? new Date();
  const date = dateInTimezone(now, options.timezone);
  await provider.recordDailyCheckIn(date, update);
  return {
    updated: true,
    date,
    recordedFields: Object.keys(update),
  };
}
