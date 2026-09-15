import { addDays, dateInTimezone } from "./date-range";
import type { AthleteDataProvider } from "../domain/provider";
import type { ManagedPlannedWorkout } from "../domain/training-context";
import type { ApplicationOptions } from "./get-week-summary";
import type { TrainingMemoryServices } from "./training-memory";

export interface PublicationTracking {
  athleteId: string;
  decisionId: string;
  memory: TrainingMemoryServices;
}

export async function publishTrainingPlan(
  provider: AthleteDataProvider,
  workouts: ManagedPlannedWorkout[],
  options: ApplicationOptions,
  tracking?: PublicationTracking,
): Promise<{
  updated: true;
  updatedCount: number;
  workouts: { managedId: string; date: string; sport: string }[];
}> {
  const now = options.now?.() ?? new Date();
  const today = dateInTimezone(now, options.timezone);
  const latestAllowedDate = addDays(today, 42);
  const managedIds = new Set<string>();
  for (const workout of workouts) {
    if (managedIds.has(workout.managedId)) {
      throw new RangeError(`Duplicate managedId: ${workout.managedId}`);
    }
    managedIds.add(workout.managedId);
    if (workout.date < today || workout.date > latestAllowedDate) {
      throw new RangeError(`Workout dates must be between ${today} and ${latestAllowedDate}`);
    }
  }
  const decision = tracking === undefined
    ? undefined
    : await tracking.memory.decisions.findById(tracking.decisionId, tracking.athleteId);
  if (tracking !== undefined) {
    if (decision === undefined) throw new RangeError("Training decision not found");
    if (decision.status !== "ACCEPTED") {
      throw new RangeError("Training decision must be ACCEPTED before publication");
    }
    if (decision.managedId === undefined || !workouts.some((workout) => workout.managedId === decision.managedId)) {
      throw new RangeError("Published workouts must include the accepted decision managedId");
    }
    if (decision.proposedWorkout === undefined) {
      throw new RangeError("Accepted decision has no proposed workout to publish");
    }
  }
  const published = await provider.upsertManagedPlannedWorkouts(workouts);
  const proposedWorkout = decision?.proposedWorkout;
  if (tracking !== undefined && decision !== undefined && proposedWorkout !== undefined) {
    await tracking.memory.managedWorkouts.upsertPublished(
      tracking.athleteId,
      published.map((workout) => {
        const planned = workouts.find((candidate) => candidate.managedId === workout.managedId);
        return {
          managedId: workout.managedId,
          intent: proposedWorkout.intent,
          ...(planned === undefined ? {} : { currentDate: planned.date }),
          ...(workout.intervalsExternalId === undefined ? {} : { intervalsExternalId: workout.intervalsExternalId }),
          latestDecisionId: decision.id,
        };
      }),
    );
    await tracking.memory.decisions.transition(
      decision.id,
      tracking.athleteId,
      "PUBLISHED",
    );
  }
  return {
    updated: true,
    updatedCount: published.length,
    workouts: workouts.map(({ managedId, date, sport }) => ({ managedId, date, sport })),
  };
}
