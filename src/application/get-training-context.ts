import type { AthleteDataProvider } from "../domain/provider";
import type { TrainingContext } from "../domain/training-context";
import { addDays, dateInTimezone, recentRange, validateDateRange } from "./date-range";
import { getRecoverySummary } from "./get-recovery-summary";
import { getWeekSummary, type ApplicationOptions } from "./get-week-summary";
import { round } from "./statistics";
import { getConsolidatedTrainingMetrics } from "./get-consolidated-training-metrics";

export interface TrainingContextInput {
  historyDays?: number;
  includeUpcomingCalendar?: boolean;
  calendarDays?: number;
}

const PROPRIETARY_METRICS = [
  "trainingReadiness",
  "garminRecoveryTime",
  "trainingStatus",
  "acuteLoadFocus",
  "enduranceScore",
] as const;

export async function getTrainingContext(
  provider: AthleteDataProvider,
  input: TrainingContextInput,
  options: ApplicationOptions,
): Promise<TrainingContext> {
  const historyDays = input.historyDays ?? 14;
  if (!Number.isInteger(historyDays) || historyDays < 7 || historyDays > 42) {
    throw new RangeError("historyDays must be an integer between 7 and 42");
  }
  if (historyDays > options.maxHistoryDays) {
    throw new RangeError(
      `historyDays cannot exceed configured MAX_HISTORY_DAYS (${String(options.maxHistoryDays)})`,
    );
  }
  const now = options.now?.() ?? new Date();
  const today = dateInTimezone(now, options.timezone);
  const historyRange = validateDateRange(recentRange(today, historyDays), {
    maxDays: options.maxHistoryDays,
    today,
  });
  const sharedOptions = { ...options, now: () => now };
  const [activities, recovery] = await Promise.all([
    getWeekSummary(provider, historyRange, sharedOptions),
    getRecoverySummary(provider, { days: historyDays }, sharedOptions),
  ]);
  const includeCalendar = input.includeUpcomingCalendar ?? true;
  const calendarDays = input.calendarDays ?? 28;
  if (!Number.isInteger(calendarDays) || calendarDays < 7 || calendarDays > 42) {
    throw new RangeError("calendarDays must be an integer between 7 and 42");
  }
  if (calendarDays > options.maxHistoryDays) {
    throw new RangeError(
      `calendarDays cannot exceed configured MAX_HISTORY_DAYS (${String(options.maxHistoryDays)})`,
    );
  }
  const calendarRange = {
    startDate: addDays(today, 1),
    endDate: addDays(today, calendarDays),
  };
  const events = includeCalendar ? await provider.getPlannedEvents(calendarRange) : undefined;
  const qualityScore = round(
    (recovery.dataQuality.sleepCoverage +
      recovery.dataQuality.restingHeartRateCoverage +
      recovery.dataQuality.hrvCoverage +
      recovery.dataQuality.loadDynamicsCoverage +
      activities.dataQuality.trainingLoadCoverage) /
      5,
    2,
  );
  const missingMetrics: string[] = [...PROPRIETARY_METRICS];
  if (recovery.dataQuality.sleepCoverage === 0) missingMetrics.push("sleep");
  if (recovery.dataQuality.restingHeartRateCoverage === 0) missingMetrics.push("restingHeartRate");
  if (recovery.dataQuality.hrvCoverage === 0) missingMetrics.push("hrv");
  if (recovery.dataQuality.vo2MaxCoverage === 0) missingMetrics.push("vo2Max");
  if (activities.dataQuality.trimpCoverage === 0) missingMetrics.push("trimp");
  if (activities.dataQuality.modeledFtpCoverage === 0) missingMetrics.push("modeledFtp");

  const result: TrainingContext = {
    generatedAt: now.toISOString(),
    timezone: options.timezone,
    period: { ...historyRange, historyDays },
    freshness: {
      ...(activities.freshness.latestActivityDate === undefined
        ? {}
        : { latestActivityDate: activities.freshness.latestActivityDate }),
      ...(recovery.freshness.latestRecoveryDate === undefined
        ? {}
        : { latestRecoveryDate: recovery.freshness.latestRecoveryDate }),
    },
    activities,
    recovery,
    performance: getConsolidatedTrainingMetrics(activities),
    dataQuality: {
      score: qualityScore,
      label: qualityScore > 0.75 ? "good" : qualityScore >= 0.4 ? "partial" : "limited",
    },
    missingMetrics,
  };
  if (events !== undefined) {
    result.upcomingCalendar = { period: calendarRange, events, available: true };
  }
  return result;
}
