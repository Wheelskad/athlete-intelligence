import type { AthleteDataProvider, DateRange } from "../domain/provider";
import type { DailyCheckInUpdate, ManagedPlannedWorkout } from "../domain/training-context";
import { buildFixtureData, type FixtureData } from "../test/fixtures/fixture-data";

function inRange(date: string, range: DateRange): boolean {
  return date >= range.startDate && date <= range.endDate;
}

export class FixtureProvider implements AthleteDataProvider {
  constructor(private readonly data: FixtureData) {}

  static anchoredAt(date: string): FixtureProvider {
    return new FixtureProvider(buildFixtureData(date));
  }

  getActivities(range: DateRange) {
    return Promise.resolve({
      activities: this.data.activities.filter((activity) => inRange(activity.date, range)),
      unavailableActivityCount: 0,
    });
  }

  getRecovery(range: DateRange) {
    return Promise.resolve(this.data.recovery.filter((record) => inRange(record.date, range)));
  }

  getPlannedEvents(range: DateRange) {
    return Promise.resolve(this.data.events.filter((event) => inRange(event.date, range)));
  }

  recordDailyCheckIn(date: string, update: DailyCheckInUpdate): Promise<void> {
    const values = {
      fatigue: update.fatigue,
      ...(update.soreness === undefined ? {} : { soreness: update.soreness }),
      ...(update.stress === undefined ? {} : { stress: update.stress }),
      ...(update.motivation === undefined ? {} : { motivation: update.motivation }),
    };
    const existing = this.data.recovery.find((record) => record.date === date);
    if (existing === undefined) this.data.recovery.push({ date, ...values });
    else Object.assign(existing, values);
    return Promise.resolve();
  }

  upsertManagedPlannedWorkouts(workouts: ManagedPlannedWorkout[]): Promise<number> {
    for (const workout of workouts) {
      const event = {
        date: workout.date,
        category: "WORKOUT",
        managedId: workout.managedId,
        label: workout.title,
        sport: workout.sport,
        ...(workout.durationMinutes === undefined
          ? {}
          : { durationMinutes: workout.durationMinutes }),
        ...(workout.trainingLoad === undefined ? {} : { trainingLoad: workout.trainingLoad }),
      };
      const index = this.data.events.findIndex((item) => item.managedId === workout.managedId);
      if (index === -1) this.data.events.push(event);
      else this.data.events[index] = event;
    }
    return Promise.resolve(workouts.length);
  }
}
