import type {
  DecisionStatus,
  ManagedWorkout,
  PreWorkoutFeedback,
  PreWorkoutFeedbackDraft,
  PublicationVerification,
  TrainingContextSnapshot,
  TrainingDecision,
  TrainingDecisionDraft,
  WorkoutIntent,
} from "../domain/training-runtime";
import type { WorkoutSport } from "../domain/training-runtime";
import type { WorkoutStep } from "../domain/workout";

export interface TrainingContextRepository {
  create(snapshot: Omit<TrainingContextSnapshot, "id">): Promise<TrainingContextSnapshot>;
  findById(id: string, athleteId: string): Promise<TrainingContextSnapshot | undefined>;
}

export interface TrainingDecisionRepository {
  create(athleteId: string, draft: TrainingDecisionDraft): Promise<TrainingDecision>;
  findById(id: string, athleteId: string): Promise<TrainingDecision | undefined>;
  findRecent(athleteId: string, since: string, limit: number): Promise<TrainingDecision[]>;
  transition(
    id: string,
    athleteId: string,
    status: DecisionStatus,
    userFeedback?: string,
  ): Promise<TrainingDecision>;
}

export interface PublishedManagedWorkout {
  managedId: string;
  intent: WorkoutIntent;
  currentDate?: string;
  intervalsExternalId?: string;
  latestDecisionId?: string;
  sport?: WorkoutSport;
  title?: string;
  description?: string;
  expectedDurationMinutes?: number;
  parsedDurationMinutes?: number;
  trainingLoad?: number;
  blocks?: WorkoutStep[];
  verification?: PublicationVerification;
}

export interface ManagedWorkoutRepository {
  upsertPublished(athleteId: string, workouts: PublishedManagedWorkout[]): Promise<ManagedWorkout[]>;
  findByManagedId(athleteId: string, managedId: string): Promise<ManagedWorkout | undefined>;
}

export interface PreWorkoutFeedbackRepository {
  create(athleteId: string, draft: PreWorkoutFeedbackDraft): Promise<PreWorkoutFeedback>;
  findLatest(athleteId: string, managedId?: string): Promise<PreWorkoutFeedback | undefined>;
}

export interface TrainingMemoryServices {
  contexts: TrainingContextRepository;
  decisions: TrainingDecisionRepository;
  managedWorkouts: ManagedWorkoutRepository;
  preWorkoutFeedback: PreWorkoutFeedbackRepository;
}

const STATUS_TRANSITIONS: Record<DecisionStatus, DecisionStatus[]> = {
  PROPOSED: ["ACCEPTED", "REJECTED", "SUPERSEDED"],
  ACCEPTED: ["PUBLISHED", "SUPERSEDED"],
  REJECTED: [],
  PUBLISHED: ["COMPLETED"],
  COMPLETED: [],
  SUPERSEDED: [],
};

export function assertDecisionTransition(from: DecisionStatus, to: DecisionStatus): void {
  if (!STATUS_TRANSITIONS[from].includes(to)) {
    throw new RangeError(`Invalid training decision transition: ${from} -> ${to}`);
  }
}
