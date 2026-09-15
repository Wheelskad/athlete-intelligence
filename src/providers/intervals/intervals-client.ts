import { assertIsoDate, periodDays } from "../../application/date-range";
import type { AthleteDataProvider, DateRange } from "../../domain/provider";
import type { PlannedEvent } from "../../domain/training-context";
import type {
  DailyCheckInUpdate,
  ManagedPlannedWorkout,
} from "../../domain/training-context";
import { mapActivity, normalizeSport } from "./activity-mapper";
import {
  intervalsActivitySchema,
  intervalsEventsResponseSchema,
  intervalsUnavailableActivitySchema,
  intervalsWellnessResponseSchema,
} from "./intervals-types";
import { z } from "zod";
import { mapWellness } from "./wellness-mapper";

export const INTERVALS_BASE_URL = "https://intervals.icu/api/v1";
const DEFAULT_TIMEOUT_MS = 10_000;
export const MANAGED_EVENT_PREFIX = "athlete-ai:";

export type ProviderErrorCode =
  | "AUTHENTICATION_FAILED"
  | "ACCESS_DENIED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "UPSTREAM_INVALID_RESPONSE"
  | "UPSTREAM_TIMEOUT";

export class IntervalsProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "IntervalsProviderError";
  }
}

export interface IntervalsClientOptions {
  apiKey: string;
  athleteId: string;
  maxHistoryDays: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class IntervalsClient implements AthleteDataProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: IntervalsClientOptions) {
    // Workerd's global fetch must retain its global receiver. Wrapping it also
    // keeps dependency injection straightforward for unit tests.
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async getActivities(range: DateRange) {
    this.assertRange(range);
    const fields = [
      "id",
      "start_date_local",
      "type",
      "moving_time",
      "elapsed_time",
      "distance",
      "total_elevation_gain",
      "icu_training_load",
      "icu_intensity",
      "average_heartrate",
      "max_heartrate",
      "icu_average_watts",
      "icu_weighted_avg_watts",
      "average_cadence",
      "decoupling",
      "trimp",
      "hr_load",
      "icu_pm_ftp",
      "icu_rolling_ftp",
      "icu_efficiency_factor",
    ].join(",");
    const payload = await this.request("activities", range, { fields });
    const rows = z.array(z.unknown()).safeParse(payload);
    if (!rows.success) throw this.invalidResponse();
    const activities = [];
    let unavailableActivityCount = 0;
    for (const row of rows.data) {
      const parsedActivity = intervalsActivitySchema.safeParse(row);
      if (parsedActivity.success) {
        activities.push(mapActivity(parsedActivity.data));
      } else if (intervalsUnavailableActivitySchema.safeParse(row).success) {
        unavailableActivityCount += 1;
      } else {
        throw this.invalidResponse();
      }
    }
    return { activities, unavailableActivityCount };
  }

  async getRecovery(range: DateRange) {
    this.assertRange(range);
    const fields = [
      "id",
      "weight",
      "restingHR",
      "hrv",
      "sleepSecs",
      "sleepScore",
      "sleepQuality",
      "soreness",
      "fatigue",
      "stress",
      "motivation",
      "bodyBattery",
      "ctl",
      "atl",
      "rampRate",
      "vo2max",
    ].join(",");
    const payload = await this.request("wellness", range, { fields });
    const parsed = intervalsWellnessResponseSchema.safeParse(payload);
    if (!parsed.success) throw this.invalidResponse();
    return parsed.data.map(mapWellness);
  }

  async getPlannedEvents(range: DateRange): Promise<PlannedEvent[]> {
    this.assertRange(range);
    const payload = await this.request("events", range);
    const parsed = intervalsEventsResponseSchema.safeParse(payload);
    if (!parsed.success) throw this.invalidResponse();
    return parsed.data.map((event) => ({
      date: event.start_date_local.slice(0, 10),
      category: event.category,
      ...(event.external_id?.startsWith(MANAGED_EVENT_PREFIX)
        ? {
            managedId: event.external_id.slice(MANAGED_EVENT_PREFIX.length),
            ...(event.name == null ? {} : { label: event.name }),
          }
        : {}),
      ...(event.type == null ? {} : { sport: normalizeSport(event.type) }),
      ...(event.moving_time == null ? {} : { durationMinutes: Math.round(event.moving_time / 60) }),
      ...(event.icu_training_load == null ? {} : { trainingLoad: event.icu_training_load }),
    }));
  }

  async recordDailyCheckIn(date: string, update: DailyCheckInUpdate): Promise<void> {
    assertIsoDate(date, "date");
    const athleteId = encodeURIComponent(this.options.athleteId);
    const url = new URL(`${INTERVALS_BASE_URL}/athlete/${athleteId}/wellness/${date}`);
    await this.requestUrl(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
  }

  async upsertManagedPlannedWorkouts(workouts: ManagedPlannedWorkout[]) {
    const athleteId = encodeURIComponent(this.options.athleteId);
    const url = new URL(`${INTERVALS_BASE_URL}/athlete/${athleteId}/events/bulk`);
    url.searchParams.set("upsert", "true");
    const payload = workouts.map((workout) => ({
      category: "WORKOUT",
      start_date_local: `${workout.date}T00:00:00`,
      type: this.intervalsSport(workout.sport),
      name: workout.title,
      description: workout.description,
      external_id: `${MANAGED_EVENT_PREFIX}${workout.managedId}`,
      ...(workout.durationMinutes === undefined
        ? {}
        : { moving_time: Math.round(workout.durationMinutes * 60) }),
      ...(workout.trainingLoad === undefined
        ? {}
        : { icu_training_load: workout.trainingLoad }),
    }));
    const response = await this.requestUrl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const parsed = z.array(z.looseObject({ id: z.union([z.string(), z.number()]) })).safeParse(response);
    if (!parsed.success) throw this.invalidResponse();
    return parsed.data.map((event, index) => ({
      managedId: workouts[index]?.managedId ?? String(event.id),
      intervalsExternalId: String(event.id),
    }));
  }

  private assertRange(range: DateRange): void {
    assertIsoDate(range.startDate, "startDate");
    assertIsoDate(range.endDate, "endDate");
    const days = periodDays(range);
    if (days < 1 || days > this.options.maxHistoryDays) {
      throw new RangeError(
        `Provider date range must be between 1 and ${String(this.options.maxHistoryDays)} days`,
      );
    }
  }

  private async request(
    resource: "activities" | "wellness" | "events",
    range: DateRange,
    extra: Record<string, string> = {},
  ): Promise<unknown> {
    const athleteId = encodeURIComponent(this.options.athleteId);
    const url = new URL(`${INTERVALS_BASE_URL}/athlete/${athleteId}/${resource}`);
    url.searchParams.set("oldest", range.startDate);
    url.searchParams.set("newest", range.endDate);
    for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
    return this.requestUrl(url, { method: "GET" });
  }

  private async requestUrl(url: URL, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Basic ${btoa(`API_KEY:${this.options.apiKey}`)}`);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        ...init,
        headers,
        signal: controller.signal,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new IntervalsProviderError("UPSTREAM_TIMEOUT", "Intervals.icu request timed out");
      }
      throw new IntervalsProviderError("UPSTREAM_UNAVAILABLE", "Intervals.icu could not be reached");
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw this.httpError(response.status);
    try {
      if (response.status === 204) return undefined;
      const body = await response.text();
      return body.length === 0 ? undefined : JSON.parse(body) as unknown;
    } catch {
      throw this.invalidResponse();
    }
  }

  private intervalsSport(sport: ManagedPlannedWorkout["sport"]): string {
    if (sport === "running") return "Run";
    if (sport === "strength") return "WeightTraining";
    if (sport === "mountain_biking") return "MountainBikeRide";
    if (sport === "gravel_cycling") return "GravelRide";
    if (sport === "indoor_cycling") return "VirtualRide";
    if (sport === "cycling") return "Ride";
    return "Other";
  }

  private httpError(status: number): IntervalsProviderError {
    if (status === 401) {
      return new IntervalsProviderError("AUTHENTICATION_FAILED", "Intervals.icu rejected the API credentials", status);
    }
    if (status === 403) {
      return new IntervalsProviderError("ACCESS_DENIED", "Intervals.icu denied access to this athlete", status);
    }
    if (status === 404) {
      return new IntervalsProviderError("NOT_FOUND", "Intervals.icu resource was not found", status);
    }
    if (status === 429) {
      return new IntervalsProviderError("RATE_LIMITED", "Intervals.icu rate limit reached; retry later", status);
    }
    return new IntervalsProviderError(
      "UPSTREAM_UNAVAILABLE",
      status >= 500 ? "Intervals.icu is temporarily unavailable" : "Intervals.icu request failed",
      status,
    );
  }

  private invalidResponse(): IntervalsProviderError {
    return new IntervalsProviderError(
      "UPSTREAM_INVALID_RESPONSE",
      "Intervals.icu returned an invalid response",
    );
  }
}
