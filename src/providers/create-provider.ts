import { dateInTimezone } from "../application/date-range";
import type { AppConfig } from "../config/env";
import type { AthleteDataProvider } from "../domain/provider";
import { FixtureProvider } from "./fixture-provider";
import { IntervalsClient } from "./intervals/intervals-client";

export function createProvider(config: AppConfig, now = new Date()): AthleteDataProvider {
  const today = dateInTimezone(now, config.DEFAULT_TIMEZONE);
  if (config.DATA_SOURCE === "fixtures") return FixtureProvider.anchoredAt(today);
  if (!config.INTERVALS_API_KEY || !config.INTERVALS_ATHLETE_ID) {
    throw new Error("Validated Intervals.icu credentials are unavailable");
  }
  return new IntervalsClient({
    apiKey: config.INTERVALS_API_KEY,
    athleteId: config.INTERVALS_ATHLETE_ID,
    maxHistoryDays: config.MAX_HISTORY_DAYS,
  });
}
