import type { ApplicationOptions } from "./get-week-summary";
import { getTrainingContext } from "./get-training-context";
import type { AthleteDataProvider } from "../domain/provider";
import type { AthleteContext, TrainingContextSnapshot } from "../domain/training-runtime";
import { sanitizeActivity } from "../privacy/sanitize";

function normalizedTrend(
  trend: "improving" | "stable" | "declining" | "unknown",
): "IMPROVING" | "STABLE" | "DECLINING" | undefined {
  if (trend === "unknown") return undefined;
  return trend.toUpperCase() as "IMPROVING" | "STABLE" | "DECLINING";
}

function ftpReliability(powerCoverage: number, ftpCoverage: number): "LOW" | "MEDIUM" | "HIGH" {
  if (powerCoverage >= 0.8 && ftpCoverage >= 0.5) return "HIGH";
  if (powerCoverage >= 0.4 && ftpCoverage >= 0.25) return "MEDIUM";
  return "LOW";
}

export class TrainingContextService {
  constructor(
    private readonly provider: AthleteDataProvider,
    private readonly options: ApplicationOptions,
    private readonly athlete: AthleteContext,
  ) {}

  async build(historyDays = 42, calendarDays = 28): Promise<Omit<TrainingContextSnapshot, "id">> {
    const context = await getTrainingContext(
      this.provider,
      { historyDays, includeUpcomingCalendar: true, calendarDays },
      this.options,
    );
    const load = context.recovery.loadDynamics?.current;
    const currentRolling = context.performance.rolling7Days.current;
    const previousRolling = context.performance.rolling7Days.previous;
    const latestFtp = context.activities.advancedMetrics?.latestModeledFtp;
    const checkIn = context.recovery.todayCheckIn;
    const sleepTrend = normalizedTrend(context.recovery.sleep.trend);
    const hrvTrend = normalizedTrend(context.recovery.hrv.trend);
    const restingHeartRateTrend = normalizedTrend(context.recovery.restingHeartRate.trend);
    const warnings: TrainingContextSnapshot["constraints"]["warnings"] = [];
    if (context.dataQuality.label !== "good") {
      warnings.push({
        code: "PARTIAL_DATA",
        severity: context.dataQuality.label === "limited" ? "WARNING" : "INFO",
        message: "Some training or recovery inputs are missing; reduce decision confidence accordingly.",
      });
    }
    if (latestFtp !== undefined && context.activities.dataQuality.powerCoverage < 0.4) {
      warnings.push({
        code: "LOW_POWER_COVERAGE",
        severity: "INFO",
        message: "Modeled FTP is available but power coverage is low; do not treat it as a reliable threshold.",
      });
    }

    return {
      generatedAt: context.generatedAt,
      timezone: context.timezone,
      period: {
        historyStartDate: context.period.startDate,
        historyEndDate: context.period.endDate,
        historyDays: context.period.historyDays,
      },
      athlete: structuredClone(this.athlete),
      recovery: {
        sleep: {
          ...(context.recovery.sleep.latestDurationMinutes === undefined ? {} : { latestDurationMinutes: context.recovery.sleep.latestDurationMinutes }),
          ...(context.recovery.sleep.averageDurationMinutes === undefined ? {} : { averageDurationMinutes: context.recovery.sleep.averageDurationMinutes }),
          ...(context.recovery.sleep.latestScore === undefined ? {} : { latestScore: context.recovery.sleep.latestScore }),
          ...(context.recovery.sleep.averageScore === undefined ? {} : { averageScore: context.recovery.sleep.averageScore }),
          ...(sleepTrend === undefined ? {} : { trend: sleepTrend }),
        },
        hrv: {
          ...(context.recovery.hrv.latest === undefined ? {} : { latest: context.recovery.hrv.latest }),
          ...(context.recovery.hrv.baseline === undefined ? {} : { baseline: context.recovery.hrv.baseline }),
          ...(context.recovery.hrv.deltaPercent === undefined ? {} : { deltaPercent: context.recovery.hrv.deltaPercent }),
          ...(hrvTrend === undefined ? {} : { trend: hrvTrend }),
        },
        restingHeartRate: {
          ...(context.recovery.restingHeartRate.latest === undefined ? {} : { latest: context.recovery.restingHeartRate.latest }),
          ...(context.recovery.restingHeartRate.baseline === undefined ? {} : { baseline: context.recovery.restingHeartRate.baseline }),
          ...(context.recovery.restingHeartRate.delta === undefined ? {} : { delta: context.recovery.restingHeartRate.delta }),
          ...(context.recovery.restingHeartRate.deltaPercent === undefined ? {} : { deltaPercent: context.recovery.restingHeartRate.deltaPercent }),
          ...(restingHeartRateTrend === undefined ? {} : { trend: restingHeartRateTrend }),
        },
      },
      load: {
        ...(load?.fitness === undefined ? {} : { fitness: load.fitness }),
        ...(load?.fatigue === undefined ? {} : { fatigue: load.fatigue }),
        ...(load?.form === undefined ? {} : { form: load.form }),
        ...(load?.acuteToChronicRatio === undefined ? {} : { acuteToChronicRatio: load.acuteToChronicRatio }),
        ...(load?.rampRate === undefined ? {} : { rampRate: load.rampRate }),
        rolling7Days: {
          ...(currentRolling.trainingLoad === undefined ? {} : { trainingLoad: currentRolling.trainingLoad }),
          ...(currentRolling.trimp === undefined ? {} : { trimp: currentRolling.trimp }),
          durationMinutes: currentRolling.durationMinutes,
        },
        ...(previousRolling === undefined ? {} : {
          previous7Days: {
            ...(previousRolling.trainingLoad === undefined ? {} : { trainingLoad: previousRolling.trainingLoad }),
            ...(previousRolling.trimp === undefined ? {} : { trimp: previousRolling.trimp }),
            durationMinutes: previousRolling.durationMinutes,
          },
        }),
      },
      performance: {
        ...(context.recovery.aerobicFitness === undefined ? {} : {
          vo2Max: {
            value: context.recovery.aerobicFitness.vo2Max.latest,
            date: context.recovery.aerobicFitness.vo2Max.latestDate,
          },
        }),
        ...(latestFtp === undefined ? {} : {
          modeledFtp: {
            watts: latestFtp.watts,
            date: latestFtp.date,
            reliability: ftpReliability(
              context.activities.dataQuality.powerCoverage,
              context.activities.dataQuality.modeledFtpCoverage,
            ),
          },
        }),
        sportMix: Object.fromEntries(
          Object.entries(context.performance.sportMix).map(([sport, mix]) => [sport, {
            sessionCount: mix.sessionCount,
            durationMinutes: mix.durationMinutes,
            ...(mix.trainingLoad === undefined ? {} : { trainingLoad: mix.trainingLoad }),
          }]),
        ),
      },
      recentActivities: context.activities.activities.map(sanitizeActivity),
      upcomingWorkouts: (context.upcomingCalendar?.events ?? []).map((event) => ({ ...event })),
      ...(checkIn?.fatigue === undefined ? {} : {
        subjective: {
          date: checkIn.date,
          fatigue: checkIn.fatigue,
          ...(checkIn.soreness === undefined ? {} : { soreness: checkIn.soreness }),
          ...(checkIn.stress === undefined ? {} : { stress: checkIn.stress }),
          ...(checkIn.motivation === undefined ? {} : { motivation: checkIn.motivation }),
        },
      }),
      constraints: {
        highIntensityAllowed: true,
        warnings,
      },
      dataQuality: {
        score: context.dataQuality.score,
        missingMetrics: [...context.missingMetrics],
        coverage: {
          sleep: context.recovery.dataQuality.sleepCoverage,
          hrv: context.recovery.dataQuality.hrvCoverage,
          restingHeartRate: context.recovery.dataQuality.restingHeartRateCoverage,
          trainingLoad: context.activities.dataQuality.trainingLoadCoverage,
          heartRate: context.activities.dataQuality.heartRateCoverage,
          power: context.activities.dataQuality.powerCoverage,
        },
      },
      sourceFreshness: { ...context.freshness },
    };
  }
}
