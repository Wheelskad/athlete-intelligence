import type { AthleteDataProvider, DateRange } from "../domain/provider";
import type { DailyRecovery, RecoverySummary, Trend } from "../domain/recovery";
import { addDays, dateInTimezone, previousRange, recentRange, validateDateRange } from "./date-range";
import {
  average,
  coverage,
  DEFAULT_TREND_THRESHOLD,
  relativeTrend,
  round,
} from "./statistics";
import type { ApplicationOptions } from "./get-week-summary";

export interface RecoverySummaryInput {
  days?: number;
}

function validateDays(days: number): void {
  if (!Number.isInteger(days) || days < 3 || days > 42) {
    throw new RangeError("days must be an integer between 3 and 42");
  }
}

function roundedAverage(
  records: DailyRecovery[],
  select: (record: DailyRecovery) => number | undefined,
): number | undefined {
  const value = average(records.map(select));
  return value === undefined ? undefined : round(value, 1);
}

function sleepTrend(
  current: DailyRecovery[],
  baseline: DailyRecovery[],
  days: number,
  threshold: number,
): Trend {
  const currentScoreCoverage = coverage(current.map((item) => item.sleepScore), days);
  const baselineScoreCoverage = coverage(baseline.map((item) => item.sleepScore), days);
  const scoreTrend = relativeTrend(
    average(current.map((item) => item.sleepScore)),
    average(baseline.map((item) => item.sleepScore)),
    currentScoreCoverage,
    baselineScoreCoverage,
    true,
    threshold,
  );
  if (scoreTrend !== "unknown") return scoreTrend;
  return relativeTrend(
    average(current.map((item) => item.sleepDurationMinutes)),
    average(baseline.map((item) => item.sleepDurationMinutes)),
    coverage(current.map((item) => item.sleepDurationMinutes), days),
    coverage(baseline.map((item) => item.sleepDurationMinutes), days),
    true,
    threshold,
  );
}

function loadPoint(record: DailyRecovery | undefined) {
  if (record?.fitnessLoad === undefined || record.fatigueLoad === undefined) return undefined;
  const fitness = round(record.fitnessLoad, 1);
  const fatigue = round(record.fatigueLoad, 1);
  return {
    date: record.date,
    fitness,
    fatigue,
    form: round(record.fitnessLoad - record.fatigueLoad, 1),
    ...(record.fitnessLoad === 0
      ? {}
      : { acuteToChronicRatio: round(record.fatigueLoad / record.fitnessLoad, 2) }),
    ...(record.rampRate === undefined ? {} : { rampRate: round(record.rampRate, 2) }),
  };
}

export async function getRecoverySummary(
  provider: AthleteDataProvider,
  input: RecoverySummaryInput,
  options: ApplicationOptions & { trendThreshold?: number },
): Promise<RecoverySummary> {
  const days = input.days ?? 7;
  validateDays(days);
  if (days > options.maxHistoryDays) {
    throw new RangeError(
      `days cannot exceed configured MAX_HISTORY_DAYS (${String(options.maxHistoryDays)})`,
    );
  }
  const now = options.now?.() ?? new Date();
  const today = dateInTimezone(now, options.timezone);
  const currentRange: DateRange = validateDateRange(recentRange(today, days), {
    maxDays: options.maxHistoryDays,
    today,
  });
  const baselineRange = validateDateRange(previousRange(currentRange), {
    maxDays: options.maxHistoryDays,
    today,
  });
  const [current, baseline] = await Promise.all([
    provider.getRecovery(currentRange),
    provider.getRecovery(baselineRange),
  ]);
  const threshold = options.trendThreshold ?? DEFAULT_TREND_THRESHOLD;
  const currentRhr = average(current.map((item) => item.restingHeartRate));
  const baselineRhr = average(baseline.map((item) => item.restingHeartRate));
  const currentHrv = average(current.map((item) => item.hrv));
  const baselineHrv = average(baseline.map((item) => item.hrv));
  const rhrTrend = relativeTrend(
    currentRhr,
    baselineRhr,
    coverage(current.map((item) => item.restingHeartRate), days),
    coverage(baseline.map((item) => item.restingHeartRate), days),
    false,
    threshold,
  );
  const hrvTrend = relativeTrend(
    currentHrv,
    baselineHrv,
    coverage(current.map((item) => item.hrv), days),
    coverage(baseline.map((item) => item.hrv), days),
    true,
    threshold,
  );
  const fatigueSignals: string[] = [];
  if (hrvTrend === "declining") fatigueSignals.push("HRV moyenne inférieure à la référence récente");
  if (rhrTrend === "declining") {
    fatigueSignals.push("FC au repos moyenne supérieure à la référence récente");
  }
  const computedSleepTrend = sleepTrend(current, baseline, days, threshold);
  if (computedSleepTrend === "declining") {
    fatigueSignals.push("Sommeil moyen inférieur à la référence récente");
  }

  const latestRecoveryDate = current.map((record) => record.date).sort().at(-1);
  const latestSleepRecord = [...current]
    .filter((record) => record.sleepDurationMinutes !== undefined || record.sleepScore !== undefined)
    .sort((left, right) => left.date.localeCompare(right.date))
    .at(-1);
  const latestRhrRecord = [...current]
    .filter((record) => record.restingHeartRate !== undefined)
    .sort((left, right) => left.date.localeCompare(right.date))
    .at(-1);
  const latestHrvRecord = [...current]
    .filter((record) => record.hrv !== undefined)
    .sort((left, right) => left.date.localeCompare(right.date))
    .at(-1);
  const currentLoadRecords = current
    .filter((record) => record.fitnessLoad !== undefined && record.fatigueLoad !== undefined)
    .sort((left, right) => left.date.localeCompare(right.date));
  const loadHistory = currentLoadRecords
    .map(loadPoint)
    .filter((point): point is NonNullable<ReturnType<typeof loadPoint>> => point !== undefined);
  const loadRecords = [...baseline, ...current]
    .filter((record) => record.fitnessLoad !== undefined && record.fatigueLoad !== undefined)
    .sort((left, right) => left.date.localeCompare(right.date));
  const latestLoadRecord = currentLoadRecords.at(-1);
  const currentLoad = loadPoint(latestLoadRecord);
  const sevenDaysAgo = latestLoadRecord === undefined ? undefined : addDays(latestLoadRecord.date, -7);
  const referenceLoadRecord = loadRecords.find((record) => record.date === sevenDaysAgo);
  const referenceLoad = loadPoint(referenceLoadRecord);
  const vo2MaxHistory = current
    .filter((record): record is DailyRecovery & { vo2Max: number } => record.vo2Max !== undefined)
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((record) => ({ date: record.date, value: round(record.vo2Max, 1) }));
  const sleepCoverage = current.filter(
    (item) => item.sleepScore !== undefined || item.sleepDurationMinutes !== undefined,
  ).length / days;
  const result: RecoverySummary = {
    generatedAt: now.toISOString(),
    timezone: options.timezone,
    period: currentRange,
    periodDays: days,
    availableDays: new Set(current.map((record) => record.date)).size,
    freshness: {},
    sleep: { trend: computedSleepTrend },
    restingHeartRate: { trend: rhrTrend },
    hrv: { trend: hrvTrend },
    otherIndicators: {},
    fatigueSignals,
    dataQuality: {
      sleepCoverage: round(sleepCoverage, 2),
      restingHeartRateCoverage: round(coverage(current.map((item) => item.restingHeartRate), days), 2),
      hrvCoverage: round(coverage(current.map((item) => item.hrv), days), 2),
      loadDynamicsCoverage: round(
        current.filter(
          (item) => item.fitnessLoad !== undefined && item.fatigueLoad !== undefined,
        ).length / days,
        2,
      ),
      vo2MaxCoverage: round(coverage(current.map((item) => item.vo2Max), days), 2),
    },
  };
  if (latestRecoveryDate !== undefined) result.freshness.latestRecoveryDate = latestRecoveryDate;
  const todayRecord = current.find((record) => record.date === today);
  if (
    todayRecord !== undefined &&
    (todayRecord.fatigue !== undefined ||
      todayRecord.soreness !== undefined ||
      todayRecord.stress !== undefined ||
      todayRecord.motivation !== undefined)
  ) {
    result.todayCheckIn = {
      date: today,
      ...(todayRecord.fatigue === undefined ? {} : { fatigue: todayRecord.fatigue }),
      ...(todayRecord.soreness === undefined ? {} : { soreness: todayRecord.soreness }),
      ...(todayRecord.stress === undefined ? {} : { stress: todayRecord.stress }),
      ...(todayRecord.motivation === undefined ? {} : { motivation: todayRecord.motivation }),
    };
  }
  if (currentLoad !== undefined) {
    result.loadDynamics = { current: currentLoad, history: loadHistory };
    if (referenceLoad !== undefined) {
      result.loadDynamics.change7Days = {
        referenceDate: referenceLoad.date,
        fitness: round(currentLoad.fitness - referenceLoad.fitness, 1),
        fatigue: round(currentLoad.fatigue - referenceLoad.fatigue, 1),
        form: round(currentLoad.form - referenceLoad.form, 1),
      };
    }
  }
  const latestVo2Max = vo2MaxHistory.at(-1);
  if (latestVo2Max !== undefined) {
    const firstVo2Max = vo2MaxHistory[0];
    result.aerobicFitness = {
      vo2Max: {
        latest: latestVo2Max.value,
        latestDate: latestVo2Max.date,
        ...(firstVo2Max === undefined || vo2MaxHistory.length < 2
          ? {}
          : { changeOverPeriod: round(latestVo2Max.value - firstVo2Max.value, 1) }),
        history: vo2MaxHistory,
      },
    };
  }

  const optionalValues: [
    number | undefined,
    (value: number) => void,
  ][] = [
    [latestSleepRecord?.sleepDurationMinutes, (value) => { result.sleep.latestDurationMinutes = round(value, 1); }],
    [roundedAverage(current, (item) => item.sleepDurationMinutes), (value) => { result.sleep.averageDurationMinutes = value; }],
    [latestSleepRecord?.sleepScore, (value) => { result.sleep.latestScore = round(value, 1); }],
    [roundedAverage(current, (item) => item.sleepScore), (value) => { result.sleep.averageScore = value; }],
    [latestRhrRecord?.restingHeartRate, (value) => { result.restingHeartRate.latest = round(value, 1); }],
    [currentRhr === undefined ? undefined : round(currentRhr, 1), (value) => { result.restingHeartRate.average = value; }],
    [baselineRhr === undefined ? undefined : round(baselineRhr, 1), (value) => { result.restingHeartRate.baseline = value; }],
    [currentRhr === undefined || baselineRhr === undefined ? undefined : round(currentRhr - baselineRhr, 1), (value) => { result.restingHeartRate.delta = value; }],
    [latestRhrRecord?.restingHeartRate === undefined || baselineRhr === undefined || baselineRhr === 0 ? undefined : round(((latestRhrRecord.restingHeartRate - baselineRhr) / Math.abs(baselineRhr)) * 100, 1), (value) => { result.restingHeartRate.deltaPercent = value; }],
    [latestHrvRecord?.hrv, (value) => { result.hrv.latest = round(value, 1); }],
    [currentHrv === undefined ? undefined : round(currentHrv, 1), (value) => { result.hrv.average = value; }],
    [baselineHrv === undefined ? undefined : round(baselineHrv, 1), (value) => { result.hrv.baseline = value; }],
    [currentHrv === undefined || baselineHrv === undefined || baselineHrv === 0 ? undefined : round(((currentHrv - baselineHrv) / Math.abs(baselineHrv)) * 100, 1), (value) => { result.hrv.deltaPercent = value; }],
    [roundedAverage(current, (item) => item.stress), (value) => { result.otherIndicators.averageStress = value; }],
    [roundedAverage(current, (item) => item.bodyBattery), (value) => { result.otherIndicators.averageBodyBattery = value; }],
    [roundedAverage(current, (item) => item.fatigue), (value) => { result.otherIndicators.averageFatigue = value; }],
    [roundedAverage(current, (item) => item.soreness), (value) => { result.otherIndicators.averageSoreness = value; }],
    [roundedAverage(current, (item) => item.motivation), (value) => { result.otherIndicators.averageMotivation = value; }],
  ];
  for (const [value, assign] of optionalValues) if (value !== undefined) assign(value);
  return result;
}
