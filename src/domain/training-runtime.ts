import type { SafeActivity } from "../privacy/sanitize";

export type RuntimeType = "DAILY" | "POST_WORKOUT" | "WEEKLY" | "RECOVERY_CHANGE" | "ON_DEMAND";
export type TrainingState = "RED" | "AMBER" | "GREEN" | "PRIME";
export type TrainingAction = "REST" | "KEEP" | "REDUCE" | "REPLACE" | "POSTPONE";
export type DecisionConfidence = "LOW" | "MEDIUM" | "HIGH";
export type DecisionStatus = "PROPOSED" | "ACCEPTED" | "REJECTED" | "PUBLISHED" | "COMPLETED" | "SUPERSEDED";
export type WorkoutIntent = "REST" | "RECOVERY" | "ENDURANCE" | "TEMPO" | "THRESHOLD" | "VO2" | "FORCE" | "TECHNIQUE" | "LONG_ENDURANCE";
export type WorkoutSport = "running" | "cycling" | "indoor_cycling" | "mountain_biking" | "gravel_cycling" | "strength" | "other";

export interface TrainingGoal {
  name: string;
  targetDate?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
}

export interface AthleteContext {
  athleteId: string;
  goals: TrainingGoal[];
  preferences: {
    preferredSports?: string[];
    indoorCyclingAvailable?: boolean;
    outdoorCyclingAvailable?: boolean;
    maxSessionsPerWeek?: number;
    preferredTrainingDays?: string[];
  };
  currentObjective?: {
    name: string;
    eventDate?: string;
    priority?: "LOW" | "MEDIUM" | "HIGH";
  };
}

export interface TrainingWarning {
  code: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
}

export interface TrainingContextSnapshot {
  id: string;
  generatedAt: string;
  timezone: string;
  period: { historyStartDate: string; historyEndDate: string; historyDays: number };
  athlete: AthleteContext;
  recovery: {
    sleep: {
      latestDurationMinutes?: number;
      averageDurationMinutes?: number;
      latestScore?: number;
      averageScore?: number;
      trend?: "IMPROVING" | "STABLE" | "DECLINING";
    };
    hrv: {
      latest?: number;
      baseline?: number;
      deltaPercent?: number;
      trend?: "IMPROVING" | "STABLE" | "DECLINING";
    };
    restingHeartRate: {
      latest?: number;
      baseline?: number;
      delta?: number;
      deltaPercent?: number;
      trend?: "IMPROVING" | "STABLE" | "DECLINING";
    };
  };
  load: {
    fitness?: number;
    fatigue?: number;
    form?: number;
    acuteToChronicRatio?: number;
    rampRate?: number;
    rolling7Days?: { trainingLoad?: number; trimp?: number; durationMinutes?: number };
    previous7Days?: { trainingLoad?: number; trimp?: number; durationMinutes?: number };
  };
  performance: {
    vo2Max?: { value: number; date: string };
    modeledFtp?: { watts: number; date: string; reliability: "LOW" | "MEDIUM" | "HIGH" };
    sportMix?: Record<string, { sessionCount: number; durationMinutes: number; trainingLoad?: number }>;
  };
  recentActivities: SafeActivity[];
  upcomingWorkouts: {
    date: string;
    category: string;
    managedId?: string;
    label?: string;
    sport?: string;
    durationMinutes?: number;
    trainingLoad?: number;
  }[];
  subjective?: { date: string; fatigue: number; soreness?: number; stress?: number; motivation?: number };
  constraints: {
    highIntensityAllowed: boolean;
    maxDurationMinutes?: number;
    unavailableSports?: string[];
    warnings: TrainingWarning[];
  };
  dataQuality: {
    score?: number;
    missingMetrics: string[];
    coverage: {
      sleep?: number;
      hrv?: number;
      restingHeartRate?: number;
      trainingLoad?: number;
      heartRate?: number;
      power?: number;
    };
  };
  sourceFreshness: { latestActivityDate?: string; latestRecoveryDate?: string };
}

export interface TrainingSignal {
  metric: string;
  value?: number | string;
  baseline?: number | string;
  direction: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  importance: "LOW" | "MEDIUM" | "HIGH";
  explanation: string;
}

export interface WorkoutReference {
  managedId?: string;
  date?: string;
  title?: string;
}

export interface ProposedWorkout {
  intent: WorkoutIntent;
  sport: WorkoutSport;
  title: string;
  description: string;
  durationMinutes?: number;
  expectedTrainingLoad?: number;
  scheduledDate?: string;
}

export interface ModelMetadata {
  provider: string;
  model: string;
  coachPromptVersion: string;
  schemaVersion: string;
}

export interface TrainingDecision {
  id: string;
  athleteId: string;
  createdAt: string;
  contextSnapshotId: string;
  runtimeType: RuntimeType;
  state: TrainingState;
  action: TrainingAction;
  confidence: DecisionConfidence;
  signals: TrainingSignal[];
  reasoningSummary: string[];
  originalWorkout?: WorkoutReference;
  proposedWorkout?: ProposedWorkout;
  status: DecisionStatus;
  managedId?: string;
  modelMetadata: ModelMetadata;
  userFeedback?: string;
}

export type TrainingDecisionDraft = Omit<TrainingDecision, "id" | "athleteId" | "createdAt" | "status">;

export type TrainingDecisionSummary = TrainingDecision;

export interface ManagedWorkout {
  id: string;
  athleteId: string;
  managedId: string;
  intent: WorkoutIntent;
  currentDate?: string;
  intervalsExternalId?: string;
  latestDecisionId?: string;
  status: "PLANNED" | "PUBLISHED" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
}
