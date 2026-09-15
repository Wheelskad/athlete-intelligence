export interface ActivitySummary {
  id: string;
  date: string;
  sport: string;
  durationSeconds: number;
  distanceMeters?: number;
  elevationGainMeters?: number;
  trainingLoad?: number;
  intensity?: number;
  averageHeartRate?: number;
  maximumHeartRate?: number;
  averagePower?: number;
  normalizedPower?: number;
  cadence?: number;
  aerobicDecoupling?: number;
  trimp?: number;
  heartRateLoad?: number;
  modeledFtp?: number;
  efficiencyFactor?: number;
}

export interface SportAggregate {
  durationMinutes: number;
  trainingLoad?: number;
  sessionCount: number;
}

export interface IntensityDistribution {
  easyMinutes: number;
  moderateMinutes: number;
  hardMinutes: number;
  classifiedActivityCount: number;
}

export interface ActivityDataQuality {
  unavailableActivityCount: number;
  trainingLoadCoverage: number;
  intensityCoverage: number;
  heartRateCoverage: number;
  powerCoverage: number;
  trimpCoverage: number;
  heartRateLoadCoverage: number;
  modeledFtpCoverage: number;
  efficiencyFactorCoverage: number;
}

export interface AdvancedActivityMetrics {
  totalTrimp?: number;
  totalHeartRateLoad?: number;
  latestModeledFtp?: { date: string; sport: string; watts: number };
  averageEfficiencyFactor?: number;
}

export interface WeekSummary {
  generatedAt: string;
  timezone: string;
  period: { startDate: string; endDate: string; periodDays: number };
  freshness: { latestActivityDate?: string };
  sessionCount: number;
  durationMinutes: number;
  distanceMeters?: number;
  elevationGainMeters?: number;
  trainingLoad?: number;
  bySport: Record<string, SportAggregate>;
  intensityDistribution?: IntensityDistribution;
  advancedMetrics?: AdvancedActivityMetrics;
  activities: ActivitySummary[];
  dataQuality: ActivityDataQuality;
}
