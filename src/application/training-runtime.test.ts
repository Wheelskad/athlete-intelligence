import { describe, expect, it } from "vitest";
import { FixtureProvider } from "../providers/fixture-provider";
import { createInMemoryTrainingMemory } from "../persistence/in-memory-training-memory";
import { TrainingContextService } from "./training-context-service";
import { TrainingRuntimeService } from "./training-runtime-service";
import { publishTrainingPlan } from "./publish-training-plan";

const now = () => new Date("2026-09-14T07:30:00.000Z");
const options = { timezone: "Europe/Paris", maxHistoryDays: 42, now };
const athlete = {
  athleteId: "athlete-test",
  goals: [{ name: "Autumn endurance", priority: "HIGH" as const }],
  preferences: { maxSessionsPerWeek: 4 },
};

describe("training runtime persistence", () => {
  it("keeps decision, snapshot and publication as separate lifecycle steps", async () => {
    const provider = FixtureProvider.anchoredAt("2026-09-14");
    const memory = createInMemoryTrainingMemory();
    const runtime = new TrainingRuntimeService(
      new TrainingContextService(provider, options, athlete),
      memory,
      athlete.athleteId,
      now,
    );
    const context = await runtime.getRuntimeContext({ historyDays: 42, calendarDays: 28 });
    expect(context.athlete).toEqual(athlete);
    expect(context.recentDecisions).toEqual([]);
    expect(context.dataQuality.missingMetrics).toContain("trainingReadiness");
    expect(context.performance.modeledFtp?.reliability).toBe("MEDIUM");

    const decision = await runtime.saveDecision({
      contextSnapshotId: context.id,
      runtimeType: "DAILY",
      state: "AMBER",
      action: "REPLACE",
      confidence: "HIGH",
      signals: [{
        metric: "HRV",
        value: 45,
        baseline: 50,
        direction: "NEGATIVE",
        importance: "MEDIUM",
        explanation: "HRV is below the recent baseline.",
      }],
      reasoningSummary: ["Recovery is slightly suppressed."],
      proposedWorkout: {
        intent: "ENDURANCE",
        sport: "indoor_cycling",
        title: "Aerobic endurance",
        description: "- 45m Z2",
        durationMinutes: 45,
        scheduledDate: "2026-09-15",
      },
      managedId: "daily-20260915-endurance",
      modelMetadata: {
        provider: "openai",
        model: "test-model",
        coachPromptVersion: "training-runtime-v1",
        schemaVersion: "1",
      },
    });
    expect(decision.status).toBe("PROPOSED");

    const workouts = [{
      managedId: "daily-20260915-endurance",
      date: "2026-09-15",
      sport: "indoor_cycling" as const,
      title: "Aerobic endurance",
      description: "- 45m Z2",
      durationMinutes: 45,
    }];
    await expect(
      publishTrainingPlan(provider, workouts, options, {
        athleteId: athlete.athleteId,
        decisionId: decision.id,
        memory,
      }),
    ).rejects.toThrow("must be ACCEPTED");

    await runtime.updateDecisionStatus(decision.id, "ACCEPTED");
    await expect(
      publishTrainingPlan(provider, workouts, options, {
        athleteId: athlete.athleteId,
        decisionId: decision.id,
        memory,
      }),
    ).resolves.toMatchObject({ updated: true, updatedCount: 1 });

    const history = await runtime.getDecisionHistory(28, 10);
    expect(history.decisions).toHaveLength(1);
    expect(history.decisions[0]).toMatchObject({
      id: decision.id,
      contextSnapshotId: context.id,
      status: "PUBLISHED",
      managedId: "daily-20260915-endurance",
    });
    await expect(memory.contexts.findById(context.id, athlete.athleteId)).resolves.toMatchObject({
      id: context.id,
      generatedAt: context.generatedAt,
    });
    await expect(
      memory.managedWorkouts.findByManagedId(athlete.athleteId, "daily-20260915-endurance"),
    ).resolves.toMatchObject({ status: "PUBLISHED", latestDecisionId: decision.id });
  });

  it("does not mark an accepted decision published when read-back duration mismatches", async () => {
    const provider = FixtureProvider.anchoredAt("2026-09-14");
    const readBack = provider.getManagedPlannedWorkout.bind(provider);
    provider.getManagedPlannedWorkout = async (managedId, date) => {
      const event = await readBack(managedId, date);
      return event === undefined ? undefined : { ...event, parsedDurationMinutes: 31 };
    };
    const memory = createInMemoryTrainingMemory();
    const runtime = new TrainingRuntimeService(
      new TrainingContextService(provider, options, athlete), memory, athlete.athleteId, now,
    );
    const context = await runtime.getRuntimeContext({ historyDays: 42, calendarDays: 7 });
    const decision = await runtime.saveDecision({
      contextSnapshotId: context.id,
      runtimeType: "DAILY",
      state: "AMBER",
      action: "REDUCE",
      confidence: "HIGH",
      signals: [{ metric: "time", value: 35, direction: "NEUTRAL", importance: "HIGH", explanation: "Available time." }],
      reasoningSummary: ["Shortened to available time."],
      proposedWorkout: {
        intent: "FORCE",
        sport: "indoor_cycling",
        title: "Force endurance",
        description: "- 55m endurance",
        durationMinutes: 55,
        scheduledDate: "2026-09-16",
      },
      managedId: "ai-duration-mismatch",
      modelMetadata: { provider: "openai", model: "test", coachPromptVersion: "v1", schemaVersion: "1" },
    });
    await runtime.updateDecisionStatus(decision.id, "ACCEPTED");
    const result = await publishTrainingPlan(provider, [{
      managedId: "ai-duration-mismatch",
      date: "2026-09-16",
      sport: "indoor_cycling",
      title: "Force endurance",
      description: "- 55m endurance",
      durationMinutes: 55,
    }], options, { athleteId: athlete.athleteId, decisionId: decision.id, memory });
    expect(result).toMatchObject({
      updated: true,
      verified: false,
      warning: { code: "WORKOUT_DURATION_MISMATCH", expectedDurationMinutes: 55, parsedDurationMinutes: 31 },
    });
    await expect(memory.decisions.findById(decision.id, athlete.athleteId)).resolves.toMatchObject({ status: "ACCEPTED" });
    await expect(memory.managedWorkouts.findByManagedId(athlete.athleteId, "ai-duration-mismatch")).resolves.toMatchObject({
      status: "PLANNED",
      publicationVerification: { verified: false },
    });
  });
});
