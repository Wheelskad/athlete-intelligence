import type { ActivitySummary, WeekSummary } from "../domain/activity";
import type { RecoverySummary } from "../domain/recovery";
import type { PlannedEvent, TrainingContext } from "../domain/training-context";
import type { ConsolidatedTrainingMetrics, RollingPeriodMetrics } from "../domain/performance";

export type SafeActivity = Omit<ActivitySummary, "id">;

function sanitizeActivity(activity: ActivitySummary): SafeActivity {
  return {
    date: activity.date,
    sport: activity.sport,
    durationSeconds: activity.durationSeconds,
    ...(activity.distanceMeters === undefined ? {} : { distanceMeters: activity.distanceMeters }),
    ...(activity.elevationGainMeters === undefined
      ? {}
      : { elevationGainMeters: activity.elevationGainMeters }),
    ...(activity.trainingLoad === undefined ? {} : { trainingLoad: activity.trainingLoad }),
    ...(activity.intensity === undefined ? {} : { intensity: activity.intensity }),
    ...(activity.averageHeartRate === undefined
      ? {}
      : { averageHeartRate: activity.averageHeartRate }),
    ...(activity.maximumHeartRate === undefined
      ? {}
      : { maximumHeartRate: activity.maximumHeartRate }),
    ...(activity.averagePower === undefined ? {} : { averagePower: activity.averagePower }),
    ...(activity.normalizedPower === undefined
      ? {}
      : { normalizedPower: activity.normalizedPower }),
    ...(activity.cadence === undefined ? {} : { cadence: activity.cadence }),
    ...(activity.aerobicDecoupling === undefined
      ? {}
      : { aerobicDecoupling: activity.aerobicDecoupling }),
    ...(activity.trimp === undefined ? {} : { trimp: activity.trimp }),
    ...(activity.heartRateLoad === undefined ? {} : { heartRateLoad: activity.heartRateLoad }),
    ...(activity.modeledFtp === undefined ? {} : { modeledFtp: activity.modeledFtp }),
    ...(activity.efficiencyFactor === undefined
      ? {}
      : { efficiencyFactor: activity.efficiencyFactor }),
  };
}

export function sanitizeWeekSummary(summary: WeekSummary): object {
  return {
    generatedAt: summary.generatedAt,
    timezone: summary.timezone,
    period: {
      startDate: summary.period.startDate,
      endDate: summary.period.endDate,
      periodDays: summary.period.periodDays,
    },
    freshness: {
      ...(summary.freshness.latestActivityDate === undefined
        ? {}
        : { latestActivityDate: summary.freshness.latestActivityDate }),
    },
    sessionCount: summary.sessionCount,
    durationMinutes: summary.durationMinutes,
    ...(summary.distanceMeters === undefined ? {} : { distanceMeters: summary.distanceMeters }),
    ...(summary.elevationGainMeters === undefined
      ? {}
      : { elevationGainMeters: summary.elevationGainMeters }),
    ...(summary.trainingLoad === undefined ? {} : { trainingLoad: summary.trainingLoad }),
    bySport: Object.fromEntries(
      Object.entries(summary.bySport).map(([sport, aggregate]) => [
        sport,
        {
          durationMinutes: aggregate.durationMinutes,
          sessionCount: aggregate.sessionCount,
          ...(aggregate.trainingLoad === undefined ? {} : { trainingLoad: aggregate.trainingLoad }),
        },
      ]),
    ),
    ...(summary.intensityDistribution === undefined
      ? {}
      : {
          intensityDistribution: {
            easyMinutes: summary.intensityDistribution.easyMinutes,
            moderateMinutes: summary.intensityDistribution.moderateMinutes,
            hardMinutes: summary.intensityDistribution.hardMinutes,
            classifiedActivityCount: summary.intensityDistribution.classifiedActivityCount,
          },
        }),
    ...(summary.advancedMetrics === undefined
      ? {}
      : {
          advancedMetrics: {
            ...(summary.advancedMetrics.totalTrimp === undefined
              ? {}
              : { totalTrimp: summary.advancedMetrics.totalTrimp }),
            ...(summary.advancedMetrics.totalHeartRateLoad === undefined
              ? {}
              : { totalHeartRateLoad: summary.advancedMetrics.totalHeartRateLoad }),
            ...(summary.advancedMetrics.latestModeledFtp === undefined
              ? {}
              : {
                  latestModeledFtp: {
                    date: summary.advancedMetrics.latestModeledFtp.date,
                    sport: summary.advancedMetrics.latestModeledFtp.sport,
                    watts: summary.advancedMetrics.latestModeledFtp.watts,
                  },
                }),
            ...(summary.advancedMetrics.averageEfficiencyFactor === undefined
              ? {}
              : { averageEfficiencyFactor: summary.advancedMetrics.averageEfficiencyFactor }),
          },
        }),
    activities: summary.activities.map(sanitizeActivity),
    dataQuality: {
      unavailableActivityCount: summary.dataQuality.unavailableActivityCount,
      trainingLoadCoverage: summary.dataQuality.trainingLoadCoverage,
      intensityCoverage: summary.dataQuality.intensityCoverage,
      heartRateCoverage: summary.dataQuality.heartRateCoverage,
      powerCoverage: summary.dataQuality.powerCoverage,
      trimpCoverage: summary.dataQuality.trimpCoverage,
      heartRateLoadCoverage: summary.dataQuality.heartRateLoadCoverage,
      modeledFtpCoverage: summary.dataQuality.modeledFtpCoverage,
      efficiencyFactorCoverage: summary.dataQuality.efficiencyFactorCoverage,
    },
  };
}

export function sanitizeRecoverySummary(summary: RecoverySummary): object {
  return {
    generatedAt: summary.generatedAt,
    timezone: summary.timezone,
    period: { startDate: summary.period.startDate, endDate: summary.period.endDate },
    periodDays: summary.periodDays,
    availableDays: summary.availableDays,
    freshness: {
      ...(summary.freshness.latestRecoveryDate === undefined
        ? {}
        : { latestRecoveryDate: summary.freshness.latestRecoveryDate }),
    },
    sleep: {
      ...(summary.sleep.averageDurationMinutes === undefined
        ? {}
        : { averageDurationMinutes: summary.sleep.averageDurationMinutes }),
      ...(summary.sleep.averageScore === undefined
        ? {}
        : { averageScore: summary.sleep.averageScore }),
      trend: summary.sleep.trend,
    },
    restingHeartRate: {
      ...(summary.restingHeartRate.average === undefined
        ? {}
        : { average: summary.restingHeartRate.average }),
      ...(summary.restingHeartRate.baseline === undefined
        ? {}
        : { baseline: summary.restingHeartRate.baseline }),
      ...(summary.restingHeartRate.delta === undefined
        ? {}
        : { delta: summary.restingHeartRate.delta }),
      trend: summary.restingHeartRate.trend,
    },
    hrv: {
      ...(summary.hrv.average === undefined ? {} : { average: summary.hrv.average }),
      ...(summary.hrv.baseline === undefined ? {} : { baseline: summary.hrv.baseline }),
      ...(summary.hrv.deltaPercent === undefined
        ? {}
        : { deltaPercent: summary.hrv.deltaPercent }),
      trend: summary.hrv.trend,
    },
    otherIndicators: {
      ...(summary.otherIndicators.averageStress === undefined
        ? {}
        : { averageStress: summary.otherIndicators.averageStress }),
      ...(summary.otherIndicators.averageBodyBattery === undefined
        ? {}
        : { averageBodyBattery: summary.otherIndicators.averageBodyBattery }),
      ...(summary.otherIndicators.averageFatigue === undefined
        ? {}
        : { averageFatigue: summary.otherIndicators.averageFatigue }),
      ...(summary.otherIndicators.averageSoreness === undefined
        ? {}
        : { averageSoreness: summary.otherIndicators.averageSoreness }),
      ...(summary.otherIndicators.averageMotivation === undefined
        ? {}
        : { averageMotivation: summary.otherIndicators.averageMotivation }),
    },
    ...(summary.loadDynamics === undefined
      ? {}
      : {
          loadDynamics: {
            current: {
              date: summary.loadDynamics.current.date,
              fitness: summary.loadDynamics.current.fitness,
              fatigue: summary.loadDynamics.current.fatigue,
              form: summary.loadDynamics.current.form,
              ...(summary.loadDynamics.current.acuteToChronicRatio === undefined
                ? {}
                : {
                    acuteToChronicRatio:
                      summary.loadDynamics.current.acuteToChronicRatio,
                  }),
              ...(summary.loadDynamics.current.rampRate === undefined
                ? {}
                : { rampRate: summary.loadDynamics.current.rampRate }),
            },
            history: summary.loadDynamics.history.map((point) => ({
              date: point.date,
              fitness: point.fitness,
              fatigue: point.fatigue,
              form: point.form,
              ...(point.acuteToChronicRatio === undefined
                ? {}
                : { acuteToChronicRatio: point.acuteToChronicRatio }),
              ...(point.rampRate === undefined ? {} : { rampRate: point.rampRate }),
            })),
            ...(summary.loadDynamics.change7Days === undefined
              ? {}
              : {
                  change7Days: {
                    referenceDate: summary.loadDynamics.change7Days.referenceDate,
                    fitness: summary.loadDynamics.change7Days.fitness,
                    fatigue: summary.loadDynamics.change7Days.fatigue,
                    form: summary.loadDynamics.change7Days.form,
                  },
                }),
          },
        }),
    ...(summary.aerobicFitness === undefined
      ? {}
      : {
          aerobicFitness: {
            vo2Max: {
              latest: summary.aerobicFitness.vo2Max.latest,
              latestDate: summary.aerobicFitness.vo2Max.latestDate,
              ...(summary.aerobicFitness.vo2Max.changeOverPeriod === undefined
                ? {}
                : { changeOverPeriod: summary.aerobicFitness.vo2Max.changeOverPeriod }),
              history: summary.aerobicFitness.vo2Max.history.map((point) => ({
                date: point.date,
                value: point.value,
              })),
            },
          },
        }),
    ...(summary.todayCheckIn === undefined
      ? {}
      : {
          todayCheckIn: {
            date: summary.todayCheckIn.date,
            ...(summary.todayCheckIn.fatigue === undefined
              ? {}
              : { fatigue: summary.todayCheckIn.fatigue }),
            ...(summary.todayCheckIn.soreness === undefined
              ? {}
              : { soreness: summary.todayCheckIn.soreness }),
            ...(summary.todayCheckIn.stress === undefined
              ? {}
              : { stress: summary.todayCheckIn.stress }),
            ...(summary.todayCheckIn.motivation === undefined
              ? {}
              : { motivation: summary.todayCheckIn.motivation }),
          },
        }),
    fatigueSignals: [...summary.fatigueSignals],
    dataQuality: {
      sleepCoverage: summary.dataQuality.sleepCoverage,
      restingHeartRateCoverage: summary.dataQuality.restingHeartRateCoverage,
      hrvCoverage: summary.dataQuality.hrvCoverage,
      loadDynamicsCoverage: summary.dataQuality.loadDynamicsCoverage,
      vo2MaxCoverage: summary.dataQuality.vo2MaxCoverage,
    },
  };
}

function sanitizeRollingPeriod(period: RollingPeriodMetrics): object {
  return {
    period: { startDate: period.period.startDate, endDate: period.period.endDate },
    sessionCount: period.sessionCount,
    activeDays: period.activeDays,
    durationMinutes: period.durationMinutes,
    ...(period.distanceMeters === undefined ? {} : { distanceMeters: period.distanceMeters }),
    ...(period.elevationGainMeters === undefined
      ? {}
      : { elevationGainMeters: period.elevationGainMeters }),
    ...(period.trainingLoad === undefined ? {} : { trainingLoad: period.trainingLoad }),
    ...(period.trimp === undefined ? {} : { trimp: period.trimp }),
    ...(period.heartRateLoad === undefined ? {} : { heartRateLoad: period.heartRateLoad }),
  };
}

function sanitizePerformance(metrics: ConsolidatedTrainingMetrics): object {
  return {
    weeklyTrend: metrics.weeklyTrend.map(sanitizeRollingPeriod),
    rolling7Days: {
      current: sanitizeRollingPeriod(metrics.rolling7Days.current),
      ...(metrics.rolling7Days.previous === undefined
        ? {}
        : { previous: sanitizeRollingPeriod(metrics.rolling7Days.previous) }),
      ...(metrics.rolling7Days.changePercent === undefined
        ? {}
        : {
            changePercent: {
              ...(metrics.rolling7Days.changePercent.sessionsPercent === undefined
                ? {}
                : { sessionsPercent: metrics.rolling7Days.changePercent.sessionsPercent }),
              ...(metrics.rolling7Days.changePercent.durationPercent === undefined
                ? {}
                : { durationPercent: metrics.rolling7Days.changePercent.durationPercent }),
              ...(metrics.rolling7Days.changePercent.distancePercent === undefined
                ? {}
                : { distancePercent: metrics.rolling7Days.changePercent.distancePercent }),
              ...(metrics.rolling7Days.changePercent.elevationPercent === undefined
                ? {}
                : { elevationPercent: metrics.rolling7Days.changePercent.elevationPercent }),
              ...(metrics.rolling7Days.changePercent.trainingLoadPercent === undefined
                ? {}
                : { trainingLoadPercent: metrics.rolling7Days.changePercent.trainingLoadPercent }),
              ...(metrics.rolling7Days.changePercent.trimpPercent === undefined
                ? {}
                : { trimpPercent: metrics.rolling7Days.changePercent.trimpPercent }),
              ...(metrics.rolling7Days.changePercent.heartRateLoadPercent === undefined
                ? {}
                : { heartRateLoadPercent: metrics.rolling7Days.changePercent.heartRateLoadPercent }),
            },
          }),
    },
    consistency: {
      activeDays: metrics.consistency.activeDays,
      activeDaysPerWeek: metrics.consistency.activeDaysPerWeek,
      sessionsPerWeek: metrics.consistency.sessionsPerWeek,
      ...(metrics.consistency.averageSessionDurationMinutes === undefined
        ? {}
        : { averageSessionDurationMinutes: metrics.consistency.averageSessionDurationMinutes }),
      ...(metrics.consistency.longestSessionMinutes === undefined
        ? {}
        : { longestSessionMinutes: metrics.consistency.longestSessionMinutes }),
    },
    loadProfile: {
      ...(metrics.loadProfile.averageWeeklyTrainingLoad === undefined
        ? {}
        : { averageWeeklyTrainingLoad: metrics.loadProfile.averageWeeklyTrainingLoad }),
      ...(metrics.loadProfile.averageLoadPerSession === undefined
        ? {}
        : { averageLoadPerSession: metrics.loadProfile.averageLoadPerSession }),
    },
    sportMix: Object.fromEntries(
      Object.entries(metrics.sportMix).map(([sport, value]) => [
        sport,
        {
          sessionCount: value.sessionCount,
          durationMinutes: value.durationMinutes,
          durationSharePercent: value.durationSharePercent,
          ...(value.trainingLoad === undefined ? {} : { trainingLoad: value.trainingLoad }),
          ...(value.trainingLoadSharePercent === undefined
            ? {}
            : { trainingLoadSharePercent: value.trainingLoadSharePercent }),
        },
      ]),
    ),
    dataQuality: {
      comparisonAvailable: metrics.dataQuality.comparisonAvailable,
      trainingLoadCoverage: metrics.dataQuality.trainingLoadCoverage,
    },
  };
}

function sanitizeEvent(event: PlannedEvent): object {
  return {
    date: event.date,
    category: event.category,
    ...(event.managedId === undefined ? {} : { managedId: event.managedId }),
    ...(event.label === undefined ? {} : { label: event.label }),
    ...(event.sport === undefined ? {} : { sport: event.sport }),
    ...(event.durationMinutes === undefined ? {} : { durationMinutes: event.durationMinutes }),
    ...(event.trainingLoad === undefined ? {} : { trainingLoad: event.trainingLoad }),
  };
}

export function sanitizeTrainingContext(context: TrainingContext): object {
  return {
    generatedAt: context.generatedAt,
    timezone: context.timezone,
    period: {
      startDate: context.period.startDate,
      endDate: context.period.endDate,
      historyDays: context.period.historyDays,
    },
    freshness: {
      ...(context.freshness.latestActivityDate === undefined
        ? {}
        : { latestActivityDate: context.freshness.latestActivityDate }),
      ...(context.freshness.latestRecoveryDate === undefined
        ? {}
        : { latestRecoveryDate: context.freshness.latestRecoveryDate }),
    },
    activities: sanitizeWeekSummary(context.activities),
    recovery: sanitizeRecoverySummary(context.recovery),
    performance: sanitizePerformance(context.performance),
    ...(context.upcomingCalendar === undefined
      ? {}
      : {
          upcomingCalendar: {
            period: {
              startDate: context.upcomingCalendar.period.startDate,
              endDate: context.upcomingCalendar.period.endDate,
            },
            available: context.upcomingCalendar.available,
            events: context.upcomingCalendar.events.map(sanitizeEvent),
          },
        }),
    dataQuality: {
      score: context.dataQuality.score,
      label: context.dataQuality.label,
    },
    missingMetrics: [...context.missingMetrics],
  };
}
