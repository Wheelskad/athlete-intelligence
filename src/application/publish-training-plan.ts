import { addDays, dateInTimezone } from "./date-range";
import type { AthleteDataProvider } from "../domain/provider";
import type { ManagedPlannedWorkout } from "../domain/training-context";
import type { ApplicationOptions } from "./get-week-summary";
import type { TrainingMemoryServices } from "./training-memory";
import type { PublicationVerification } from "../domain/training-runtime";
import { serializeIntervalsWorkout, workoutDurationSeconds } from "../domain/workout";

export interface PublicationTracking {
  athleteId: string;
  decisionId: string;
  memory: TrainingMemoryServices;
}

export const PUBLICATION_DURATION_TOLERANCE_MINUTES = 1;

export function verifyWorkoutDuration(
  expectedDurationMinutes: number | undefined,
  parsedDurationMinutes: number | undefined,
  toleranceMinutes = PUBLICATION_DURATION_TOLERANCE_MINUTES,
): PublicationVerification {
  if (expectedDurationMinutes === undefined || parsedDurationMinutes === undefined) {
    return {
      verified: false,
      ...(expectedDurationMinutes === undefined ? {} : { expectedDurationMinutes }),
      ...(parsedDurationMinutes === undefined ? {} : { parsedDurationMinutes }),
      warning: {
        code: "WORKOUT_DURATION_UNAVAILABLE",
        ...(expectedDurationMinutes === undefined ? {} : { expectedDurationMinutes }),
        ...(parsedDurationMinutes === undefined ? {} : { parsedDurationMinutes }),
      },
    };
  }
  const durationDeltaMinutes = Math.round((parsedDurationMinutes - expectedDurationMinutes) * 10) / 10;
  const verified = Math.abs(durationDeltaMinutes) <= toleranceMinutes;
  return {
    verified,
    expectedDurationMinutes,
    parsedDurationMinutes,
    durationDeltaMinutes,
    ...(verified ? {} : {
      warning: {
        code: "WORKOUT_DURATION_MISMATCH" as const,
        expectedDurationMinutes,
        parsedDurationMinutes,
      },
    }),
  };
}

function normalizeWorkout(workout: ManagedPlannedWorkout): ManagedPlannedWorkout & { expectedDurationMinutes?: number } {
  const calculatedDuration = workout.blocks === undefined
    ? undefined
    : workoutDurationSeconds(workout.blocks) / 60;
  const expectedDurationMinutes = workout.durationMinutes ?? calculatedDuration;
  return {
    ...workout,
    description: workout.blocks === undefined ? workout.description : serializeIntervalsWorkout(workout.blocks),
    ...(expectedDurationMinutes === undefined ? {} : {
      durationMinutes: expectedDurationMinutes,
      expectedDurationMinutes,
    }),
  };
}

export async function publishTrainingPlan(
  provider: AthleteDataProvider,
  workouts: ManagedPlannedWorkout[],
  options: ApplicationOptions,
  tracking?: PublicationTracking,
): Promise<{
  updated: true;
  verified: boolean;
  updatedCount: number;
  workouts: {
    managedId: string;
    date: string;
    sport: string;
    expectedDurationMinutes?: number;
    parsedDurationMinutes?: number;
    durationDeltaMinutes?: number;
    verified: boolean;
    warning?: PublicationVerification["warning"];
  }[];
  warning?: PublicationVerification["warning"];
}> {
  const now = options.now?.() ?? new Date();
  const today = dateInTimezone(now, options.timezone);
  const latestAllowedDate = addDays(today, 42);
  const managedIds = new Set<string>();
  for (const workout of workouts) {
    if (managedIds.has(workout.managedId)) throw new RangeError(`Duplicate managedId: ${workout.managedId}`);
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
    if (decision.status !== "ACCEPTED") throw new RangeError("Training decision must be ACCEPTED before publication");
    if (decision.managedId === undefined || !workouts.some((workout) => workout.managedId === decision.managedId)) {
      throw new RangeError("Published workouts must include the accepted decision managedId");
    }
    if (decision.proposedWorkout === undefined) throw new RangeError("Accepted decision has no proposed workout to publish");
  }

  const normalized = workouts.map(normalizeWorkout);
  if (decision?.proposedWorkout !== undefined && decision.managedId !== undefined) {
    const accepted = normalized.find((workout) => workout.managedId === decision.managedId);
    const proposal = decision.proposedWorkout;
    const proposedDescription = proposal.blocks === undefined
      ? proposal.description
      : serializeIntervalsWorkout(proposal.blocks);
    const differs = accepted?.sport !== proposal.sport
      || accepted.title !== proposal.title
      || accepted.description.trim() !== proposedDescription.trim()
      || (proposal.scheduledDate !== undefined && accepted.date !== proposal.scheduledDate)
      || (proposal.durationMinutes !== undefined && accepted.expectedDurationMinutes !== proposal.durationMinutes)
      || (proposal.expectedTrainingLoad !== undefined && accepted.trainingLoad !== proposal.expectedTrainingLoad);
    if (differs) throw new RangeError("Published workout must exactly match the accepted proposal");
  }
  const published = await provider.upsertManagedPlannedWorkouts(normalized);
  const results = await Promise.all(normalized.map(async (workout) => {
    const readBack = await provider.getManagedPlannedWorkout(workout.managedId, workout.date);
    const verification = verifyWorkoutDuration(workout.expectedDurationMinutes, readBack?.parsedDurationMinutes);
    return { managedId: workout.managedId, date: workout.date, sport: workout.sport, ...verification };
  }));
  const verified = results.every((result) => result.verified);
  const proposedWorkout = decision?.proposedWorkout;
  if (tracking !== undefined && decision !== undefined && proposedWorkout !== undefined) {
    await tracking.memory.managedWorkouts.upsertPublished(
      tracking.athleteId,
      normalized.map((workout, index) => {
        const publishedWorkout = published[index];
        const verification = results[index];
        return {
          managedId: workout.managedId,
          intent: proposedWorkout.intent,
          currentDate: workout.date,
          ...(publishedWorkout?.intervalsExternalId === undefined ? {} : { intervalsExternalId: publishedWorkout.intervalsExternalId }),
          latestDecisionId: decision.id,
          sport: workout.sport,
          title: workout.title,
          description: workout.description,
          ...(workout.expectedDurationMinutes === undefined ? {} : { expectedDurationMinutes: workout.expectedDurationMinutes }),
          ...(verification?.parsedDurationMinutes === undefined ? {} : { parsedDurationMinutes: verification.parsedDurationMinutes }),
          ...(workout.trainingLoad === undefined ? {} : { trainingLoad: workout.trainingLoad }),
          ...(workout.blocks === undefined ? {} : { blocks: workout.blocks }),
          ...(verification === undefined ? {} : { verification }),
        };
      }),
    );
    if (verified) await tracking.memory.decisions.transition(decision.id, tracking.athleteId, "PUBLISHED");
  }
  const firstWarning = results.find((result) => result.warning !== undefined)?.warning;
  return {
    updated: true,
    verified,
    updatedCount: published.length,
    workouts: results,
    ...(firstWarning === undefined ? {} : { warning: firstWarning }),
  };
}
