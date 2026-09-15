import type { ActivitySummary, WeekSummary } from "../domain/activity";
import type {
  ConsolidatedTrainingMetrics,
  MetricChanges,
  RollingPeriodMetrics,
} from "../domain/performance";
import { addDays } from "./date-range";
import { round } from "./statistics";

function inPeriod(activity: ActivitySummary, startDate: string, endDate: string): boolean {
  return activity.date >= startDate && activity.date <= endDate;
}

function optionalSum(
  activities: ActivitySummary[],
  select: (activity: ActivitySummary) => number | undefined,
): number | undefined {
  const values = activities.map(select).filter((value): value is number => value !== undefined);
  return values.length === 0 ? undefined : values.reduce((sum, value) => sum + value, 0);
}

function summarize(
  activities: ActivitySummary[],
  startDate: string,
  endDate: string,
): RollingPeriodMetrics {
  const selected = activities.filter((activity) => inPeriod(activity, startDate, endDate));
  const distance = optionalSum(selected, (activity) => activity.distanceMeters);
  const elevation = optionalSum(selected, (activity) => activity.elevationGainMeters);
  const load = optionalSum(selected, (activity) => activity.trainingLoad);
  const trimp = optionalSum(selected, (activity) => activity.trimp);
  const heartRateLoad = optionalSum(selected, (activity) => activity.heartRateLoad);
  return {
    period: { startDate, endDate },
    sessionCount: selected.length,
    activeDays: new Set(selected.map((activity) => activity.date)).size,
    durationMinutes: round(
      selected.reduce((sum, activity) => sum + activity.durationSeconds, 0) / 60,
      1,
    ),
    ...(distance === undefined ? {} : { distanceMeters: round(distance, 1) }),
    ...(elevation === undefined ? {} : { elevationGainMeters: round(elevation, 1) }),
    ...(load === undefined ? {} : { trainingLoad: round(load, 1) }),
    ...(trimp === undefined ? {} : { trimp: round(trimp, 1) }),
    ...(heartRateLoad === undefined ? {} : { heartRateLoad: round(heartRateLoad, 1) }),
  };
}

function percentChange(current: number | undefined, previous: number | undefined): number | undefined {
  if (current === undefined || previous === undefined || previous === 0) return undefined;
  return round(((current - previous) / Math.abs(previous)) * 100, 1);
}

function changes(current: RollingPeriodMetrics, previous: RollingPeriodMetrics): MetricChanges {
  const result: MetricChanges = {};
  const values: [number | undefined, number | undefined, (value: number) => void][] = [
    [current.sessionCount, previous.sessionCount, (value) => { result.sessionsPercent = value; }],
    [current.durationMinutes, previous.durationMinutes, (value) => { result.durationPercent = value; }],
    [current.distanceMeters, previous.distanceMeters, (value) => { result.distancePercent = value; }],
    [current.elevationGainMeters, previous.elevationGainMeters, (value) => { result.elevationPercent = value; }],
    [current.trainingLoad, previous.trainingLoad, (value) => { result.trainingLoadPercent = value; }],
    [current.trimp, previous.trimp, (value) => { result.trimpPercent = value; }],
    [current.heartRateLoad, previous.heartRateLoad, (value) => { result.heartRateLoadPercent = value; }],
  ];
  for (const [currentValue, previousValue, assign] of values) {
    const value = percentChange(currentValue, previousValue);
    if (value !== undefined) assign(value);
  }
  return result;
}

export function getConsolidatedTrainingMetrics(
  summary: WeekSummary,
): ConsolidatedTrainingMetrics {
  const { activities } = summary;
  const recentEnd = summary.period.endDate;
  const recentStart = addDays(recentEnd, -6);
  const previousEnd = addDays(recentStart, -1);
  const previousStart = addDays(previousEnd, -6);
  const current = summarize(activities, recentStart, recentEnd);
  const completeWeeks = Math.floor(summary.period.periodDays / 7);
  const weeklyTrend = Array.from({ length: completeWeeks }, (_, index) => {
    const weeksAgo = completeWeeks - index - 1;
    const endDate = addDays(recentEnd, -7 * weeksAgo);
    return summarize(activities, addDays(endDate, -6), endDate);
  });
  const comparisonAvailable = summary.period.startDate <= previousStart;
  const previous = comparisonAvailable
    ? summarize(activities, previousStart, previousEnd)
    : undefined;

  const totalDurationMinutes = activities.reduce(
    (sum, activity) => sum + activity.durationSeconds / 60,
    0,
  );
  const totalLoad = optionalSum(activities, (activity) => activity.trainingLoad);
  const activeDays = new Set(activities.map((activity) => activity.date)).size;
  const historyWeeks = summary.period.periodDays / 7;
  const sportMix: ConsolidatedTrainingMetrics["sportMix"] = {};
  for (const [sport, aggregate] of Object.entries(summary.bySport)) {
    sportMix[sport] = {
      sessionCount: aggregate.sessionCount,
      durationMinutes: aggregate.durationMinutes,
      durationSharePercent:
        totalDurationMinutes === 0
          ? 0
          : round((aggregate.durationMinutes / totalDurationMinutes) * 100, 1),
      ...(aggregate.trainingLoad === undefined
        ? {}
        : { trainingLoad: aggregate.trainingLoad }),
      ...(aggregate.trainingLoad === undefined || totalLoad === undefined || totalLoad === 0
        ? {}
        : { trainingLoadSharePercent: round((aggregate.trainingLoad / totalLoad) * 100, 1) }),
    };
  }

  const averageSessionDuration =
    activities.length === 0 ? undefined : totalDurationMinutes / activities.length;
  const longestSession =
    activities.length === 0
      ? undefined
      : Math.max(...activities.map((activity) => activity.durationSeconds / 60));

  return {
    weeklyTrend,
    rolling7Days: {
      current,
      ...(previous === undefined
        ? {}
        : { previous, changePercent: changes(current, previous) }),
    },
    consistency: {
      activeDays,
      activeDaysPerWeek: round(activeDays / historyWeeks, 1),
      sessionsPerWeek: round(activities.length / historyWeeks, 1),
      ...(averageSessionDuration === undefined
        ? {}
        : { averageSessionDurationMinutes: round(averageSessionDuration, 1) }),
      ...(longestSession === undefined
        ? {}
        : { longestSessionMinutes: round(longestSession, 1) }),
    },
    loadProfile: {
      ...(totalLoad === undefined
        ? {}
        : {
            averageWeeklyTrainingLoad: round(totalLoad / historyWeeks, 1),
            averageLoadPerSession: round(totalLoad / activities.length, 1),
          }),
    },
    sportMix,
    dataQuality: {
      comparisonAvailable,
      trainingLoadCoverage: summary.dataQuality.trainingLoadCoverage,
    },
  };
}
