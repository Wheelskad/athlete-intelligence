import { describe, expect, it, vi } from "vitest";
import { IntervalsClient, IntervalsProviderError } from "./intervals-client";

const range = { startDate: "2026-09-08", endDate: "2026-09-14" };

describe("IntervalsClient errors", () => {
  it("counts Strava placeholder records as unavailable instead of failing", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        Response.json([
          {
            id: "fixture-strava-placeholder",
            start_date_local: "2026-09-13T08:00:00",
            source: "STRAVA",
            _note: "Provider activity unavailable through the API",
          },
        ]),
      ),
    );
    const client = new IntervalsClient({
      apiKey: "fixture-secret",
      athleteId: "fixture-athlete",
      maxHistoryDays: 42,
      fetchImpl,
    });
    await expect(client.getActivities(range)).resolves.toEqual({
      activities: [],
      unavailableActivityCount: 1,
    });
  });

  it("maps 401 to a typed error", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(new Response("private upstream body", { status: 401 })));
    const client = new IntervalsClient({
      apiKey: "fixture-secret",
      athleteId: "fixture-athlete",
      maxHistoryDays: 42,
      fetchImpl,
    });
    const error = await client.getActivities(range).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(IntervalsProviderError);
    expect(error).toMatchObject({ code: "AUTHENTICATION_FAILED", status: 401 });
    expect(String(error)).not.toContain("private upstream body");
  });

  it("maps 429 without leaking the response payload", async () => {
    const sensitivePayload = "token=do-not-leak";
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(new Response(sensitivePayload, { status: 429 })));
    const client = new IntervalsClient({
      apiKey: "fixture-secret",
      athleteId: "fixture-athlete",
      maxHistoryDays: 42,
      fetchImpl,
    });
    const error = await client.getRecovery(range).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "RATE_LIMITED", status: 429 });
    expect(JSON.stringify(error)).not.toContain(sensitivePayload);
    expect(String(error)).not.toContain("do-not-leak");
  });
});

describe("IntervalsClient controlled writes", () => {
  it("reads the duration interpreted by Intervals workout_doc", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(Response.json([{
      id: 123,
      start_date_local: "2026-09-17T00:00:00",
      category: "WORKOUT",
      type: "VirtualRide",
      external_id: "athlete-ai:force-bike",
      name: "Force bike",
      description: "4x\n- 5m force\n- 3m easy",
      moving_time: 1_860,
      workout_doc: { duration: 3_300 },
    }])));
    const client = new IntervalsClient({
      apiKey: "fixture-secret",
      athleteId: "0",
      maxHistoryDays: 42,
      fetchImpl,
    });
    await expect(client.getManagedPlannedWorkout("force-bike", "2026-09-17")).resolves.toMatchObject({
      managedId: "force-bike",
      durationMinutes: 31,
      parsedDurationMinutes: 55,
      description: "4x\n- 5m force\n- 3m easy",
    });
  });

  it("does not mistake calendar duration for a parsed structured workout", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(Response.json([{
      id: 124,
      start_date_local: "2026-09-17T00:00:00",
      category: "WORKOUT",
      type: "Run",
      external_id: "athlete-ai:unparsed-run",
      name: "Unparsed run",
      description: "calendar note only",
      moving_time: 2_400,
    }])));
    const client = new IntervalsClient({
      apiKey: "fixture-secret",
      athleteId: "0",
      maxHistoryDays: 42,
      fetchImpl,
    });
    const workout = await client.getManagedPlannedWorkout("unparsed-run", "2026-09-17");
    expect(workout?.durationMinutes).toBe(40);
    expect(workout?.parsedDurationMinutes).toBeUndefined();
  });

  it("updates only the selected wellness fields for today's date", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    const client = new IntervalsClient({
      apiKey: "fixture-secret",
      athleteId: "0",
      maxHistoryDays: 42,
      fetchImpl,
    });
    await client.recordDailyCheckIn("2026-09-14", { fatigue: 9, motivation: 3 });
    const [input, init] = fetchImpl.mock.calls[0] ?? [];
    if (!(input instanceof URL)) throw new Error("Expected URL input");
    if (typeof init?.body !== "string") throw new Error("Expected JSON body");
    expect(input.href).toBe("https://intervals.icu/api/v1/athlete/0/wellness/2026-09-14");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ fatigue: 9, motivation: 3 });
  });

  it("upserts namespaced calendar events without exposing the API key in the body", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(Response.json([{ id: 123 }])));
    const client = new IntervalsClient({
      apiKey: "fixture-secret",
      athleteId: "0",
      maxHistoryDays: 42,
      fetchImpl,
    });
    await expect(
      client.upsertManagedPlannedWorkouts([
        {
          managedId: "week1-easy-run",
          date: "2026-09-17",
          sport: "running",
          title: "Footing facile",
          description: "- 40m Z2",
          durationMinutes: 40,
          trainingLoad: 35,
        },
      ]),
    ).resolves.toEqual([{ managedId: "week1-easy-run", intervalsExternalId: "123" }]);
    const [input, init] = fetchImpl.mock.calls[0] ?? [];
    if (!(input instanceof URL)) throw new Error("Expected URL input");
    if (typeof init?.body !== "string") throw new Error("Expected JSON body");
    expect(input.href).toContain("/athlete/0/events/bulk?upsert=true");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body) as unknown;
    expect(body).toEqual([
      expect.objectContaining({
        external_id: "athlete-ai:week1-easy-run",
        start_date_local: "2026-09-17T00:00:00",
        type: "Run",
      }),
    ]);
    expect(JSON.stringify(body)).not.toContain('"external_id":"week1-easy-run"');
    expect(JSON.stringify(body)).not.toContain("fixture-secret");
  });
});
