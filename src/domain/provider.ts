import type { ActivitySummary } from "./activity";
import type { DailyRecovery } from "./recovery";
import type {
  DailyCheckInUpdate,
  ManagedPlannedWorkout,
  PlannedEvent,
} from "./training-context";

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface ActivityFetchResult {
  activities: ActivitySummary[];
  unavailableActivityCount: number;
}

export interface PublishedPlannedWorkout {
  managedId: string;
  intervalsExternalId?: string;
}

export interface AthleteDataProvider {
  getActivities(range: DateRange): Promise<ActivityFetchResult>;
  getRecovery(range: DateRange): Promise<DailyRecovery[]>;
  getPlannedEvents(range: DateRange): Promise<PlannedEvent[]>;
  recordDailyCheckIn(date: string, update: DailyCheckInUpdate): Promise<void>;
  upsertManagedPlannedWorkouts(workouts: ManagedPlannedWorkout[]): Promise<PublishedPlannedWorkout[]>;
  getManagedPlannedWorkout(managedId: string, date: string): Promise<PlannedEvent | undefined>;
}
