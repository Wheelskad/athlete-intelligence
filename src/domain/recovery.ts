export type Trend = "improving" | "stable" | "declining" | "unknown";

export interface DailyRecovery {
  date: string;
  sleepDurationMinutes?: number;
  sleepScore?: number;
  sleepQuality?: "poor" | "fair" | "good" | "excellent";
  restingHeartRate?: number;
  hrv?: number;
  stress?: number;
  bodyBattery?: number;
  fatigue?: number;
  soreness?: number;
  motivation?: number;
  weightKg?: number;
  fitnessLoad?: number;
  fatigueLoad?: number;
  rampRate?: number;
  vo2Max?: number;
}

export interface LoadDynamicsPoint {
  date: string;
  fitness: number;
  fatigue: number;
  form: number;
  acuteToChronicRatio?: number;
  rampRate?: number;
}

export interface LoadDynamics {
  current: LoadDynamicsPoint;
  history: LoadDynamicsPoint[];
  change7Days?: {
    referenceDate: string;
    fitness: number;
    fatigue: number;
    form: number;
  };
}

export interface RecoverySummary {
  generatedAt: string;
  timezone: string;
  period: { startDate: string; endDate: string };
  periodDays: number;
  availableDays: number;
  freshness: { latestRecoveryDate?: string };
  sleep: {
    averageDurationMinutes?: number;
    averageScore?: number;
    trend: Trend;
  };
  restingHeartRate: {
    average?: number;
    baseline?: number;
    delta?: number;
    trend: Trend;
  };
  hrv: {
    average?: number;
    baseline?: number;
    deltaPercent?: number;
    trend: Trend;
  };
  otherIndicators: {
    averageStress?: number;
    averageBodyBattery?: number;
    averageFatigue?: number;
    averageSoreness?: number;
    averageMotivation?: number;
  };
  loadDynamics?: LoadDynamics;
  aerobicFitness?: {
    vo2Max: {
      latest: number;
      latestDate: string;
      changeOverPeriod?: number;
      history: { date: string; value: number }[];
    };
  };
  todayCheckIn?: {
    date: string;
    fatigue?: number;
    soreness?: number;
    stress?: number;
    motivation?: number;
  };
  fatigueSignals: string[];
  dataQuality: {
    sleepCoverage: number;
    restingHeartRateCoverage: number;
    hrvCoverage: number;
    loadDynamicsCoverage: number;
    vo2MaxCoverage: number;
  };
}
