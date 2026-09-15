import { addDays, dateInTimezone } from "./date-range";
import type { AthleteDataProvider } from "../domain/provider";
import type { ManagedPlannedWorkout } from "../domain/training-context";
import type { ApplicationOptions } from "./get-week-summary";

export async function publishTrainingPlan(
  provider: AthleteDataProvider,
  workouts: ManagedPlannedWorkout[],
  options: ApplicationOptions,
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
  const updatedCount = await provider.upsertManagedPlannedWorkouts(workouts);
  return {
    updated: true,
    updatedCount,
    workouts: workouts.map(({ managedId, date, sport }) => ({ managedId, date, sport })),
  };
}
