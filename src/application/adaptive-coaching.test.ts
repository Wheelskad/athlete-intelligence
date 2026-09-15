import { describe, expect, it } from "vitest";
import { FixtureProvider } from "../providers/fixture-provider";
import { createInMemoryTrainingMemory } from "../persistence/in-memory-training-memory";
import { TrainingContextService } from "./training-context-service";
import { TrainingRuntimeService } from "./training-runtime-service";
import { recordPreWorkoutFeedback } from "./record-pre-workout-feedback";
import { publishTrainingPlan, verifyWorkoutDuration } from "./publish-training-plan";
import { buildFixtureData } from "../test/fixtures/fixture-data";

const now = () => new Date("2026-09-14T07:30:00.000Z");
const options = { timezone: "Europe/Paris", maxHistoryDays: 42, now };
const athlete = { athleteId: "athlete-test", goals: [], preferences: {} };

describe("publication verification", () => {
  it("accepts a matching interpreted duration", () => {
    expect(verifyWorkoutDuration(55, 55)).toEqual({
      verified: true,
      expectedDurationMinutes: 55,
      parsedDurationMinutes: 55,
      durationDeltaMinutes: 0,
    });
  });

  it("reports the concrete duration mismatch", () => {
    expect(verifyWorkoutDuration(55, 31)).toMatchObject({
      verified: false,
      durationDeltaMinutes: -24,
      warning: {
        code: "WORKOUT_DURATION_MISMATCH",
        expectedDurationMinutes: 55,
        parsedDurationMinutes: 31,
      },
    });
  });

  it("audits every MCP publication with sent and parsed durations", async () => {
    const provider = FixtureProvider.anchoredAt("2026-09-14");
    const memory = createInMemoryTrainingMemory();
    const workout = {
      managedId: "audited-workout",
      date: "2026-09-16",
      sport: "indoor_cycling" as const,
      title: "Audited workout",
      description: "- 55m endurance",
      durationMinutes: 55,
    };
    await publishTrainingPlan(provider, [workout], options, { athleteId: athlete.athleteId, memory });
    await publishTrainingPlan(provider, [workout], options, { athleteId: athlete.athleteId, memory });
    const audits = await memory.intervalsWriteAudits.findRecentForManagedId(
      athlete.athleteId,
      workout.managedId,
      10,
    );
    expect(audits).toHaveLength(2);
    expect(audits.map((audit) => audit.operation).sort()).toEqual(["CREATE", "UPDATE"]);
    expect(audits[0]).toMatchObject({
      managedId: workout.managedId,
      caller: "publish_training_plan",
      durationSentMinutes: 55,
      parsedDurationMinutes: 55,
      outcome: "VERIFIED",
    });
    expect(audits[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("pre-workout feedback", () => {
  it.each([
    { feeling: "NO_MOTIVATION" as const, message: "flemme" },
    { pain: { location: "right knee", severity: 4 } },
    { timeAvailableMinutes: 35 },
  ])("persists explicit feedback %#", async (draft) => {
    const memory = createInMemoryTrainingMemory();
    await expect(recordPreWorkoutFeedback(memory, athlete.athleteId, draft)).resolves.toMatchObject(draft);
    await expect(memory.preWorkoutFeedback.findLatest(athlete.athleteId)).resolves.toMatchObject(draft);
  });

  it("associates feedback only with a known managed workout", async () => {
    const memory = createInMemoryTrainingMemory();
    await memory.managedWorkouts.upsertPublished(athlete.athleteId, [{
      managedId: "ai-known-workout",
      intent: "ENDURANCE",
      verification: { verified: true },
    }]);
    await expect(recordPreWorkoutFeedback(memory, athlete.athleteId, {
      managedId: "ai-known-workout",
      feeling: "OK",
    })).resolves.toMatchObject({ managedId: "ai-known-workout", feeling: "OK" });
    await expect(recordPreWorkoutFeedback(memory, athlete.athleteId, {
      managedId: "ai-unknown-workout",
      feeling: "OK",
    })).rejects.toThrow("Managed workout not found");
  });
});

describe("coach dashboard", () => {
  it("reports missing and stale recovery data without inventing metrics", async () => {
    const data = buildFixtureData("2026-09-14");
    data.activities = [];
    data.recovery = [];
    const runtime = new TrainingRuntimeService(
      new TrainingContextService(new FixtureProvider(data), options, athlete),
      createInMemoryTrainingMemory(),
      athlete.athleteId,
      now,
    );
    const dashboard = await runtime.getCoachDashboard(7);
    expect(dashboard.dataQuality).toMatchObject({
      stale: { activities: true, recovery: true },
    });
    expect(dashboard.dataQuality.missingMetrics).toEqual(expect.arrayContaining(["sleep", "hrv", "restingHeartRate"]));
    expect(dashboard.recovery.hrv).toEqual({});
  });

  it("returns no next workout when the calendar has no connector-managed event", async () => {
    const provider = FixtureProvider.anchoredAt("2026-09-14");
    const runtime = new TrainingRuntimeService(
      new TrainingContextService(provider, options, athlete),
      createInMemoryTrainingMemory(),
      athlete.athleteId,
      now,
    );
    await expect(runtime.getCoachDashboard(7)).resolves.toMatchObject({
      state: null,
      nextWorkout: null,
      upcomingWorkouts: [],
    });
  });

  it("returns a complete managed workout and pending decision", async () => {
    const provider = FixtureProvider.anchoredAt("2026-09-14");
    const memory = createInMemoryTrainingMemory();
    await provider.upsertManagedPlannedWorkouts([{
      managedId: "ai-force-bike",
      date: "2026-09-16",
      sport: "indoor_cycling",
      title: "Force endurance",
      description: "- 35m endurance",
      durationMinutes: 35,
      trainingLoad: 32,
    }]);
    await memory.managedWorkouts.upsertPublished(athlete.athleteId, [{
      managedId: "ai-force-bike",
      intent: "FORCE",
      currentDate: "2026-09-16",
      sport: "indoor_cycling",
      title: "Force endurance",
      description: "- 35m endurance",
      expectedDurationMinutes: 35,
      parsedDurationMinutes: 35,
      trainingLoad: 32,
      verification: { verified: true, expectedDurationMinutes: 35, parsedDurationMinutes: 35, durationDeltaMinutes: 0 },
    }]);
    const runtime = new TrainingRuntimeService(
      new TrainingContextService(provider, options, athlete), memory, athlete.athleteId, now,
    );
    const snapshot = await runtime.getRuntimeContext({ historyDays: 42, calendarDays: 7 });
    await runtime.saveDecision({
      contextSnapshotId: snapshot.id,
      runtimeType: "DAILY",
      state: "AMBER",
      action: "KEEP",
      confidence: "MEDIUM",
      signals: [{ metric: "form", direction: "NEUTRAL", importance: "MEDIUM", explanation: "Stable load." }],
      reasoningSummary: ["Stable load."],
      managedId: "ai-force-bike",
      modelMetadata: { provider: "openai", model: "test", coachPromptVersion: "v1", schemaVersion: "1" },
    });
    const dashboard = await runtime.getCoachDashboard(7);
    expect(dashboard).toMatchObject({
      state: "AMBER",
      nextWorkout: {
        managedId: "ai-force-bike",
        expectedDurationMinutes: 35,
        parsedDurationMinutes: 35,
        description: "- 35m endurance",
      },
      pendingDecision: { status: "PROPOSED" },
      dataQuality: { stale: { activities: false, recovery: false } },
    });
    await expect(runtime.getWorkoutDetail("ai-force-bike")).resolves.toMatchObject({
      managedId: "ai-force-bike",
      expectedDurationMinutes: 35,
      parsedDurationMinutes: 35,
      blocks: [{ type: "STEP", durationSeconds: 2_100, instruction: "endurance" }],
    });
  });
});
