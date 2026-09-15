import type { ActivitySummary, SportAggregate, WeekSummary } from "../domain/activity";
import type { AthleteDataProvider, DateRange } from "../domain/provider";
import { dateInTimezone, periodDays, recentRange, validateDateRange } from "./date-range";
import { average, coverage, round } from "./statistics";

export interface WeekSummaryInput {
  startDate?: string | undefined;
  endDate?: string | undefined;
}

export interface ApplicationOptions {
  timezone: string;
  maxHistoryDays: number;
  now?: () => Date;
}

function sumAvailable(
  activities: ActivitySummary[],
  select: (activity: ActivitySummary) => number | undefined,
): number | undefined {
  const values = activities.map(select).filter((value): value is number => value !== undefined);
  return values.length === 0 ? undefined : values.reduce((total, value) => total + value, 0);
}

export async function getWeekSummary(
  provider: AthleteDataProvider,
  input: WeekSummaryInput,
  options: ApplicationOptions,
): Promise<WeekSummary> {
  const now = options.now?.() ?? new Date();
  const today = dateInTimezone(now, options.timezone);
  const endDate = input.endDate ?? today;
  const defaultRange = recentRange(endDate, 7);
  const range: DateRange = validateDateRange(
    { startDate: input.startDate ?? defaultRange.startDate, endDate },
    { maxDays: options.maxHistoryDays, today },
  );
  const activityBatch = await provider.getActivities(range);
  const activities = [...activityBatch.activities].sort((left, right) =>
    right.date.localeCompare(left.date),
  );
  const bySport: Record<string, SportAggregate> = {};

  for (const activity of activities) {
    const aggregate = bySport[activity.sport] ?? {
      durationMinutes: 0,
      sessionCount: 0,
    };
    aggregate.durationMinutes += activity.durationSeconds / 60;
    aggregate.sessionCount += 1;
    if (activity.trainingLoad !== undefined) {
      aggregate.trainingLoad = (aggregate.trainingLoad ?? 0) + activity.trainingLoad;
    }
    bySport[activity.sport] = aggregate;
  }
  for (const aggregate of Object.values(bySport)) {
    aggregate.durationMinutes = round(aggregate.durationMinutes, 0);
    if (aggregate.trainingLoad !== undefined) aggregate.trainingLoad = round(aggregate.trainingLoad, 1);
  }

  const intensityActivities = activities.filter(
    (activity): activity is ActivitySummary & { intensity: number } => activity.intensity !== undefined,
  );
  const intensityDistribution =
    intensityActivities.length === 0
      ? undefined
      : {
          easyMinutes: round(
            intensityActivities
              .filter((activity) => activity.intensity <= 65)
              .reduce((total, activity) => total + activity.durationSeconds / 60, 0),
            0,
          ),
          moderateMinutes: round(
            intensityActivities
              .filter((activity) => activity.intensity > 65 && activity.intensity <= 85)
              .reduce((total, activity) => total + activity.durationSeconds / 60, 0),
            0,
          ),
          hardMinutes: round(
            intensityActivities
              .filter((activity) => activity.intensity > 85)
              .reduce((total, activity) => total + activity.durationSeconds / 60, 0),
            0,
          ),
          classifiedActivityCount: intensityActivities.length,
        };

  const distance = sumAvailable(activities, (activity) => activity.distanceMeters);
  const elevation = sumAvailable(activities, (activity) => activity.elevationGainMeters);
  const trainingLoad = sumAvailable(activities, (activity) => activity.trainingLoad);
  const totalTrimp = sumAvailable(activities, (activity) => activity.trimp);
  const totalHeartRateLoad = sumAvailable(activities, (activity) => activity.heartRateLoad);
  const latestModeledFtp = activities.find((activity) => activity.modeledFtp !== undefined);
  const averageEfficiencyFactor = average(activities.map((activity) => activity.efficiencyFactor));
  const latestActivityDate = activities.map((activity) => activity.date).sort().at(-1);
  const result: WeekSummary = {
    generatedAt: now.toISOString(),
    timezone: options.timezone,
    period: { ...range, periodDays: periodDays(range) },
    freshness: {},
    sessionCount: activities.length,
    durationMinutes: round(
      activities.reduce((total, activity) => total + activity.durationSeconds / 60, 0),
      0,
    ),
    bySport,
    activities,
    dataQuality: {
      unavailableActivityCount: activityBatch.unavailableActivityCount,
      trainingLoadCoverage: round(coverage(activities.map((activity) => activity.trainingLoad), activities.length), 2),
      intensityCoverage: round(coverage(activities.map((activity) => activity.intensity), activities.length), 2),
      heartRateCoverage: round(
        coverage(activities.map((activity) => activity.averageHeartRate), activities.length),
        2,
      ),
      powerCoverage: round(coverage(activities.map((activity) => activity.averagePower), activities.length), 2),
      trimpCoverage: round(coverage(activities.map((activity) => activity.trimp), activities.length), 2),
      heartRateLoadCoverage: round(
        coverage(activities.map((activity) => activity.heartRateLoad), activities.length),
        2,
      ),
      modeledFtpCoverage: round(
        coverage(activities.map((activity) => activity.modeledFtp), activities.length),
        2,
      ),
      efficiencyFactorCoverage: round(
        coverage(activities.map((activity) => activity.efficiencyFactor), activities.length),
        2,
      ),
    },
  };
  if (latestActivityDate !== undefined) result.freshness.latestActivityDate = latestActivityDate;
  if (distance !== undefined) result.distanceMeters = round(distance, 0);
  if (elevation !== undefined) result.elevationGainMeters = round(elevation, 0);
  if (trainingLoad !== undefined) result.trainingLoad = round(trainingLoad, 1);
  if (intensityDistribution !== undefined) result.intensityDistribution = intensityDistribution;
  if (
    totalTrimp !== undefined ||
    totalHeartRateLoad !== undefined ||
    latestModeledFtp !== undefined ||
    averageEfficiencyFactor !== undefined
  ) {
    result.advancedMetrics = {
      ...(totalTrimp === undefined ? {} : { totalTrimp: round(totalTrimp, 1) }),
      ...(totalHeartRateLoad === undefined
        ? {}
        : { totalHeartRateLoad: round(totalHeartRateLoad, 1) }),
      ...(latestModeledFtp?.modeledFtp === undefined
        ? {}
        : {
            latestModeledFtp: {
              date: latestModeledFtp.date,
              sport: latestModeledFtp.sport,
              watts: round(latestModeledFtp.modeledFtp, 1),
            },
          }),
      ...(averageEfficiencyFactor === undefined
        ? {}
        : { averageEfficiencyFactor: round(averageEfficiencyFactor, 2) }),
    };
  }
  return result;
}
