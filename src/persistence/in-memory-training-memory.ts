import {
  assertDecisionTransition,
  type PublishedManagedWorkout,
  type TrainingMemoryServices,
} from "../application/training-memory";
import type {
  DecisionStatus,
  ManagedWorkout,
  PreWorkoutFeedback,
  TrainingContextSnapshot,
  TrainingDecision,
  TrainingDecisionDraft,
} from "../domain/training-runtime";

export function createInMemoryTrainingMemory(): TrainingMemoryServices {
  const snapshots = new Map<string, TrainingContextSnapshot>();
  const decisions = new Map<string, TrainingDecision>();
  const managedWorkouts = new Map<string, ManagedWorkout>();
  const feedback = new Map<string, PreWorkoutFeedback>();

  return {
    contexts: {
      create(input) {
        const snapshot = { id: crypto.randomUUID(), ...structuredClone(input) };
        snapshots.set(snapshot.id, snapshot);
        return Promise.resolve(structuredClone(snapshot));
      },
      findById(id, athleteId) {
        const value = snapshots.get(id);
        return Promise.resolve(
          value?.athlete.athleteId === athleteId ? structuredClone(value) : undefined,
        );
      },
    },
    decisions: {
      create(athleteId: string, draft: TrainingDecisionDraft) {
        const snapshot = snapshots.get(draft.contextSnapshotId);
        if (snapshot?.athlete.athleteId !== athleteId) {
          throw new RangeError("contextSnapshotId does not belong to this athlete or no longer exists");
        }
        const decision: TrainingDecision = {
          id: crypto.randomUUID(),
          athleteId,
          createdAt: new Date().toISOString(),
          ...structuredClone(draft),
          status: "PROPOSED",
        };
        decisions.set(decision.id, decision);
        return Promise.resolve(structuredClone(decision));
      },
      findById(id, athleteId) {
        const value = decisions.get(id);
        return Promise.resolve(value?.athleteId === athleteId ? structuredClone(value) : undefined);
      },
      findRecent(athleteId, since, limit) {
        return Promise.resolve(
          [...decisions.values()]
            .filter((decision) => decision.athleteId === athleteId && decision.createdAt >= since)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .slice(0, limit)
            .map((decision) => structuredClone(decision)),
        );
      },
      transition(id, athleteId, status: DecisionStatus, userFeedback?) {
        const current = decisions.get(id);
        if (current?.athleteId !== athleteId) throw new RangeError("Training decision not found");
        assertDecisionTransition(current.status, status);
        const updated: TrainingDecision = {
          ...current,
          status,
          ...(userFeedback === undefined ? {} : { userFeedback }),
        };
        decisions.set(id, updated);
        return Promise.resolve(structuredClone(updated));
      },
    },
    managedWorkouts: {
      upsertPublished(athleteId: string, workouts: PublishedManagedWorkout[]) {
        const output: ManagedWorkout[] = [];
        for (const workout of workouts) {
          const key = `${athleteId}:${workout.managedId}`;
          const existing = managedWorkouts.get(key);
          const now = new Date().toISOString();
          const saved: ManagedWorkout = {
            id: existing?.id ?? crypto.randomUUID(),
            athleteId,
            managedId: workout.managedId,
            intent: workout.intent,
            ...(workout.currentDate === undefined ? {} : { currentDate: workout.currentDate }),
            ...(workout.intervalsExternalId === undefined
              ? existing?.intervalsExternalId === undefined ? {} : { intervalsExternalId: existing.intervalsExternalId }
              : { intervalsExternalId: workout.intervalsExternalId }),
            ...(workout.latestDecisionId === undefined
              ? existing?.latestDecisionId === undefined ? {} : { latestDecisionId: existing.latestDecisionId }
              : { latestDecisionId: workout.latestDecisionId }),
            ...(workout.sport === undefined ? {} : { sport: workout.sport }),
            ...(workout.title === undefined ? {} : { title: workout.title }),
            ...(workout.description === undefined ? {} : { description: workout.description }),
            ...(workout.expectedDurationMinutes === undefined ? {} : { expectedDurationMinutes: workout.expectedDurationMinutes }),
            ...(workout.parsedDurationMinutes === undefined ? {} : { parsedDurationMinutes: workout.parsedDurationMinutes }),
            ...(workout.trainingLoad === undefined ? {} : { trainingLoad: workout.trainingLoad }),
            ...(workout.blocks === undefined ? {} : { blocks: structuredClone(workout.blocks) }),
            ...(workout.verification === undefined ? {} : { publicationVerification: structuredClone(workout.verification) }),
            status: workout.verification?.verified === false ? "PLANNED" : "PUBLISHED",
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          };
          managedWorkouts.set(key, saved);
          output.push(structuredClone(saved));
        }
        return Promise.resolve(output);
      },
      findByManagedId(athleteId, managedId) {
        const value = managedWorkouts.get(`${athleteId}:${managedId}`);
        return Promise.resolve(value === undefined ? undefined : structuredClone(value));
      },
    },
    preWorkoutFeedback: {
      create(athleteId, draft) {
        const saved: PreWorkoutFeedback = {
          id: crypto.randomUUID(),
          athleteId,
          createdAt: new Date().toISOString(),
          ...structuredClone(draft),
        };
        feedback.set(saved.id, saved);
        return Promise.resolve(structuredClone(saved));
      },
      findLatest(athleteId, managedId?) {
        const saved = [...feedback.values()]
          .filter((item) => item.athleteId === athleteId && (managedId === undefined || item.managedId === managedId))
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
        return Promise.resolve(saved === undefined ? undefined : structuredClone(saved));
      },
    },
  };
}
