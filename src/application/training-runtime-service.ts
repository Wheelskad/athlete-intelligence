import type { TrainingMemoryServices } from "./training-memory";
import type { TrainingDecisionDraft } from "../domain/training-runtime";
import { TrainingContextService } from "./training-context-service";
import type { RuntimeType } from "../domain/training-runtime";
import { recordPreWorkoutFeedback } from "./record-pre-workout-feedback";
import type { PreWorkoutFeedbackDraft } from "../domain/training-runtime";
import { addDays, dateInTimezone } from "./date-range";
import { parseIntervalsWorkout } from "../domain/workout";

export class TrainingRuntimeService {
  constructor(
    private readonly contextService: TrainingContextService,
    private readonly memory: TrainingMemoryServices,
    private readonly athleteId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getRuntimeContext(input: {
    historyDays?: number;
    calendarDays?: number;
    decisionDays?: number;
    decisionLimit?: number;
  }) {
    const context = await this.contextService.build(input.historyDays ?? 42, input.calendarDays ?? 28);
    const latestPreWorkoutFeedback = await this.memory.preWorkoutFeedback.findLatest(this.athleteId);
    const enrichedContext = latestPreWorkoutFeedback === undefined
      ? context
      : {
          ...context,
          subjective: {
            ...context.subjective,
            latestPreWorkoutFeedback,
          },
        };
    const snapshot = await this.memory.contexts.create(enrichedContext);
    const since = new Date(this.now().getTime() - (input.decisionDays ?? 28) * 86_400_000).toISOString();
    const recentDecisions = await this.memory.decisions.findRecent(
      this.athleteId,
      since,
      input.decisionLimit ?? 10,
    );
    return { ...snapshot, recentDecisions };
  }

  async buildCoachRuntime(input: {
    runtimeType: Extract<RuntimeType, "DAILY" | "WEEKLY">;
    historyDays?: number;
    calendarDays?: number;
  }) {
    return {
      runtimeType: input.runtimeType,
      ...await this.getRuntimeContext({
        historyDays: input.historyDays ?? 42,
        calendarDays: input.calendarDays ?? (input.runtimeType === "DAILY" ? 7 : 14),
      }),
    };
  }

  async getCoachDashboard(upcomingDays = 7) {
    const runtime = await this.getRuntimeContext({
      historyDays: 42,
      calendarDays: Math.max(7, upcomingDays),
      decisionDays: 28,
      decisionLimit: 20,
    });
    const today = dateInTimezone(this.now(), runtime.timezone);
    const lastDate = addDays(today, upcomingDays - 1);
    const upcomingWorkouts = await Promise.all(
      runtime.upcomingWorkouts
        .filter((workout): workout is typeof workout & { managedId: string } =>
          workout.managedId !== undefined && workout.date >= today && workout.date <= lastDate)
        .map(async (workout) => {
          const managed = await this.memory.managedWorkouts.findByManagedId(
            this.athleteId,
            workout.managedId,
          );
          return {
            managedId: workout.managedId,
            date: workout.date,
            ...(workout.sport === undefined && managed?.sport === undefined ? {} : { sport: workout.sport ?? managed?.sport }),
            ...(workout.label === undefined && managed?.title === undefined ? {} : { title: workout.label ?? managed?.title }),
            ...(managed?.expectedDurationMinutes === undefined ? {} : { expectedDurationMinutes: managed.expectedDurationMinutes }),
            ...(workout.parsedDurationMinutes === undefined && managed?.parsedDurationMinutes === undefined
              ? {}
              : { parsedDurationMinutes: workout.parsedDurationMinutes ?? managed?.parsedDurationMinutes }),
            ...(workout.trainingLoad === undefined && managed?.trainingLoad === undefined ? {} : { trainingLoad: workout.trainingLoad ?? managed?.trainingLoad }),
            ...(workout.description === undefined && managed?.description === undefined ? {} : { description: workout.description ?? managed?.description }),
            source: "ATHLETE_INTELLIGENCE" as const,
            status: managed?.status ?? workout.status ?? "PUBLISHED",
          };
        }),
    );
    const pendingDecision = runtime.recentDecisions.find(
      (decision) => decision.status === "PROPOSED" || decision.status === "ACCEPTED",
    ) ?? null;
    const daily = runtime.subjective?.latestDailyCheckIn;
    const preWorkout = runtime.subjective?.latestPreWorkoutFeedback;
    const activityStale = runtime.sourceFreshness.latestActivityDate === undefined
      || runtime.sourceFreshness.latestActivityDate < addDays(today, -2);
    const recoveryStale = runtime.sourceFreshness.latestRecoveryDate === undefined
      || runtime.sourceFreshness.latestRecoveryDate < addDays(today, -1);
    return {
      generatedAt: runtime.generatedAt,
      timezone: runtime.timezone,
      contextSnapshotId: runtime.id,
      state: pendingDecision?.state ?? null,
      recovery: {
        sleep: {
          ...(runtime.recovery.sleep.latestDurationMinutes === undefined ? {} : { latestDurationMinutes: runtime.recovery.sleep.latestDurationMinutes }),
          ...(runtime.recovery.sleep.latestScore === undefined ? {} : { latestScore: runtime.recovery.sleep.latestScore }),
          ...(runtime.recovery.sleep.averageScore === undefined ? {} : { baselineScore: runtime.recovery.sleep.averageScore }),
          ...(runtime.recovery.sleep.trend === undefined ? {} : { trend: runtime.recovery.sleep.trend }),
        },
        hrv: runtime.recovery.hrv,
        restingHeartRate: runtime.recovery.restingHeartRate,
      },
      load: {
        ...(runtime.load.fitness === undefined ? {} : { fitness: runtime.load.fitness }),
        ...(runtime.load.fatigue === undefined ? {} : { fatigue: runtime.load.fatigue }),
        ...(runtime.load.form === undefined ? {} : { form: runtime.load.form }),
        ...(runtime.load.acuteToChronicRatio === undefined ? {} : { acuteToChronicRatio: runtime.load.acuteToChronicRatio }),
        ...(runtime.load.rampRate === undefined ? {} : { rampRate: runtime.load.rampRate }),
        ...(runtime.load.rolling7Days?.trainingLoad === undefined ? {} : { rolling7DaysTrainingLoad: runtime.load.rolling7Days.trainingLoad }),
        ...(runtime.load.previous7Days?.trainingLoad === undefined ? {} : { previous7DaysTrainingLoad: runtime.load.previous7Days.trainingLoad }),
      },
      nextWorkout: upcomingWorkouts[0] ?? null,
      upcomingWorkouts,
      pendingDecision,
      subjective: {
        fatigue: preWorkout?.fatigue ?? daily?.fatigue ?? null,
        soreness: daily?.soreness ?? null,
        stress: daily?.stress ?? null,
        motivation: preWorkout?.motivation ?? daily?.motivation ?? null,
        preWorkoutFeedback: preWorkout ?? null,
      },
      dataQuality: {
        score: runtime.dataQuality.score,
        missingMetrics: runtime.dataQuality.missingMetrics,
        stale: { activities: activityStale, recovery: recoveryStale },
      },
    };
  }

  async getWorkoutDetail(managedId: string) {
    const managed = await this.memory.managedWorkouts.findByManagedId(this.athleteId, managedId);
    if (managed === undefined) throw new RangeError("Managed workout not found");
    const writeAudits = await this.memory.intervalsWriteAudits.findRecentForManagedId(
      this.athleteId,
      managedId,
      10,
    );
    const event = managed.currentDate === undefined
      ? undefined
      : await this.contextService.getManagedPlannedWorkout(managedId, managed.currentDate);
    const description = event?.description ?? managed.description ?? "";
    const blocks = managed.blocks ?? parseIntervalsWorkout(description);
    const parsedDurationMinutes = event?.parsedDurationMinutes ?? managed.parsedDurationMinutes;
    const durationVerified = managed.expectedDurationMinutes !== undefined
      && parsedDurationMinutes !== undefined
      && Math.abs(parsedDurationMinutes - managed.expectedDurationMinutes) <= 1;
    return {
      managedId,
      ...(managed.currentDate === undefined ? {} : { date: managed.currentDate }),
      ...(event?.sport === undefined && managed.sport === undefined ? {} : { sport: event?.sport ?? managed.sport }),
      ...(event?.label === undefined && managed.title === undefined ? {} : { title: event?.label ?? managed.title }),
      description,
      ...(managed.expectedDurationMinutes === undefined ? {} : { expectedDurationMinutes: managed.expectedDurationMinutes }),
      ...(event?.parsedDurationMinutes === undefined && managed.parsedDurationMinutes === undefined
        ? {}
        : { parsedDurationMinutes: event?.parsedDurationMinutes ?? managed.parsedDurationMinutes }),
      ...(event?.trainingLoad === undefined && managed.trainingLoad === undefined ? {} : { trainingLoad: event?.trainingLoad ?? managed.trainingLoad }),
      status: managed.status,
      source: "ATHLETE_INTELLIGENCE" as const,
      blocks,
      garminCompatibility: {
        structured: blocks.length > 0,
        durationVerified,
        ready: blocks.length > 0 && durationVerified,
      },
      publicationVerification: managed.publicationVerification,
      writeAudit: writeAudits.map((audit) => ({
        managedId: audit.managedId,
        operation: audit.operation,
        durationSentMinutes: audit.durationSentMinutes,
        parsedDurationMinutes: audit.parsedDurationMinutes,
        caller: audit.caller,
        timestamp: audit.timestamp,
        outcome: audit.outcome,
        ...(audit.warningCode === undefined ? {} : { warningCode: audit.warningCode }),
        ...(audit.decisionId === undefined ? {} : { decisionId: audit.decisionId }),
      })),
    };
  }

  recordPreWorkoutFeedback(feedback: PreWorkoutFeedbackDraft) {
    return recordPreWorkoutFeedback(this.memory, this.athleteId, feedback);
  }

  async getDecisionHistory(days = 28, limit = 20) {
    const since = new Date(this.now().getTime() - days * 86_400_000).toISOString();
    return {
      generatedAt: this.now().toISOString(),
      decisions: await this.memory.decisions.findRecent(this.athleteId, since, limit),
    };
  }

  saveDecision(draft: TrainingDecisionDraft) {
    if (
      draft.originalWorkout?.managedId !== undefined
      && draft.managedId !== draft.originalWorkout.managedId
    ) {
      throw new RangeError("An adapted workout must reuse the original managedId");
    }
    return this.memory.decisions.create(this.athleteId, draft);
  }

  updateDecisionStatus(
    decisionId: string,
    status: "ACCEPTED" | "REJECTED",
    userFeedback?: string,
  ) {
    return this.memory.decisions.transition(decisionId, this.athleteId, status, userFeedback);
  }
}
