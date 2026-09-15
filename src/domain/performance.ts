export interface RollingPeriodMetrics {
  period: { startDate: string; endDate: string };
  sessionCount: number;
  activeDays: number;
  durationMinutes: number;
  distanceMeters?: number;
  elevationGainMeters?: number;
  trainingLoad?: number;
  trimp?: number;
  heartRateLoad?: number;
}

export interface MetricChanges {
  sessionsPercent?: number;
  durationPercent?: number;
  distancePercent?: number;
  elevationPercent?: number;
  trainingLoadPercent?: number;
  trimpPercent?: number;
  heartRateLoadPercent?: number;
}

export interface SportMixMetrics {
  sessionCount: number;
  durationMinutes: number;
  durationSharePercent: number;
  trainingLoad?: number;
  trainingLoadSharePercent?: number;
}

export interface ConsolidatedTrainingMetrics {
  weeklyTrend: RollingPeriodMetrics[];
  rolling7Days: {
    current: RollingPeriodMetrics;
    previous?: RollingPeriodMetrics;
    changePercent?: MetricChanges;
  };
  consistency: {
    activeDays: number;
    activeDaysPerWeek: number;
    sessionsPerWeek: number;
    averageSessionDurationMinutes?: number;
    longestSessionMinutes?: number;
  };
  loadProfile: {
    averageWeeklyTrainingLoad?: number;
    averageLoadPerSession?: number;
  };
  sportMix: Record<string, SportMixMetrics>;
  dataQuality: {
    comparisonAvailable: boolean;
    trainingLoadCoverage: number;
  };
}
