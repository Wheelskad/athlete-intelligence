import type { WeekSummary } from "./activity";
import type { RecoverySummary } from "./recovery";
import type { ConsolidatedTrainingMetrics } from "./performance";

export interface PlannedEvent {
  date: string;
  category: string;
  managedId?: string;
  label?: string;
  sport?: string;
  durationMinutes?: number;
  trainingLoad?: number;
}

export interface DailyCheckInUpdate {
  fatigue: number;
  soreness?: number | undefined;
  stress?: number | undefined;
  motivation?: number | undefined;
}

export interface ManagedPlannedWorkout {
  managedId: string;
  date: string;
  sport: "running" | "cycling" | "indoor_cycling" | "mountain_biking" | "gravel_cycling" | "strength" | "other";
  title: string;
  description: string;
  durationMinutes?: number | undefined;
  trainingLoad?: number | undefined;
}

export interface TrainingContext {
  generatedAt: string;
  timezone: string;
  period: { startDate: string; endDate: string; historyDays: number };
  freshness: {
    latestActivityDate?: string;
    latestRecoveryDate?: string;
  };
  activities: WeekSummary;
  recovery: RecoverySummary;
  performance: ConsolidatedTrainingMetrics;
  upcomingCalendar?: {
    period: { startDate: string; endDate: string };
    events: PlannedEvent[];
    available: boolean;
  };
  dataQuality: {
    score: number;
    label: "good" | "partial" | "limited";
  };
  missingMetrics: string[];
}
