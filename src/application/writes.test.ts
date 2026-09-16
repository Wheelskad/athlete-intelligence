import { describe, expect, it } from "vitest";
import { FixtureProvider } from "../providers/fixture-provider";
import { recordDailyCheckIn } from "./record-daily-check-in";
import { publishTrainingPlan } from "./publish-training-plan";
import { publishTrainingPlanInputSchema } from "../mcp/tools/publish-training-plan.tool";

const NOW = new Date("2026-09-14T07:30:00.000Z");
const options = {
  timezone: "Europe/Paris",
  maxHistoryDays: 42,
  now: () => NOW,
};

describe("controlled writes", () => {
  it("rejects publication without literal user confirmation", () => {
    expect(publishTrainingPlanInputSchema.safeParse({
      confirmed: false,
      workouts: [{
        managedId: "confirmed-workout",
        date: "2026-09-17",
        sport: "running",
        title: "Easy run",
        description: "- 40m easy",
      }],
    }).success).toBe(false);
  });

  it("requires structured blocks for Garmin-compatible sports", () => {
    expect(publishTrainingPlanInputSchema.safeParse({
      confirmed: true,
      workouts: [{
        managedId: "unstructured-run",
        date: "2026-09-17",
        sport: "running",
        title: "Easy run",
        description: "40 minutes easy",
      }],
    }).success).toBe(false);
    expect(publishTrainingPlanInputSchema.safeParse({
      confirmed: true,
      workouts: [{
        managedId: "structured-run",
        date: "2026-09-17",
        sport: "running",
        title: "Easy run",
        description: "40 minutes easy",
        blocks: [{
          type: "STEP",
          durationSeconds: 2_400,
          instruction: "Footing facile",
          targets: { heartRate: "Z2" },
        }],
      }],
    }).success).toBe(true);
  });

  it("records today's check-in without changing unrelated wellness fields", async () => {
    const provider = FixtureProvider.anchoredAt("2026-09-14");
    await expect(
      recordDailyCheckIn(provider, { fatigue: 9, motivation: 3 }, options),
    ).resolves.toEqual({
      updated: true,
      date: "2026-09-14",
      recordedFields: ["fatigue", "motivation"],
    });
    const [today] = await provider.getRecovery({
      startDate: "2026-09-14",
      endDate: "2026-09-14",
    });
    expect(today).toMatchObject({ fatigue: 9, motivation: 3, sleepScore: 72 });
  });

  it("upserts only connector-managed workouts by stable id", async () => {
    const provider = FixtureProvider.anchoredAt("2026-09-14");
    const base = {
      managedId: "week1-easy-run",
      sport: "running" as const,
      title: "Footing facile",
      description: "- 40m Z2",
      durationMinutes: 40,
      trainingLoad: 35,
    };
    await publishTrainingPlan(provider, [{ ...base, date: "2026-09-17" }], options);
    await publishTrainingPlan(provider, [{ ...base, date: "2026-09-18" }], options);
    const events = await provider.getPlannedEvents({
      startDate: "2026-09-15",
      endDate: "2026-09-21",
    });
    expect(events.filter((event) => event.managedId === base.managedId)).toEqual([
      expect.objectContaining({
        date: "2026-09-18",
        category: "WORKOUT",
        managedId: "week1-easy-run",
        label: "Footing facile",
        sport: "running",
        durationMinutes: 40,
        trainingLoad: 35,
      }),
    ]);
  });

  it("rejects duplicate ids and dates outside the controlled horizon", async () => {
    const provider = FixtureProvider.anchoredAt("2026-09-14");
    const workout = {
      managedId: "duplicate-id",
      date: "2026-09-15",
      sport: "cycling" as const,
      title: "Endurance",
      description: "- 60m Z2",
    };
    await expect(
      publishTrainingPlan(provider, [workout, workout], options),
    ).rejects.toThrow("Duplicate managedId");
    await expect(
      publishTrainingPlan(provider, [{ ...workout, date: "2027-01-01" }], options),
    ).rejects.toThrow("Workout dates must be between");
  });

  it("rejects a calendar duration that differs from the structured blocks", async () => {
    const provider = FixtureProvider.anchoredAt("2026-09-14");
    await expect(publishTrainingPlan(provider, [{
      managedId: "bad-structured-duration",
      date: "2026-09-17",
      sport: "running",
      title: "Bad duration",
      description: "Structured workout",
      durationMinutes: 55,
      blocks: [{ type: "STEP", durationSeconds: 31 * 60, instruction: "Footing" }],
    }], options)).rejects.toThrow("must match its structured blocks (31 minutes)");
  });
});
