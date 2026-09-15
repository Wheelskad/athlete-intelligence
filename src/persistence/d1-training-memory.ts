import {
  assertDecisionTransition,
  type ManagedWorkoutRepository,
  type PublishedManagedWorkout,
  type TrainingContextRepository,
  type TrainingDecisionRepository,
  type TrainingMemoryServices,
} from "../application/training-memory";
import type {
  DecisionStatus,
  ManagedWorkout,
  TrainingContextSnapshot,
  TrainingDecision,
  TrainingDecisionDraft,
} from "../domain/training-runtime";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

interface SnapshotRow {
  id: string;
  athlete_id: string;
  generated_at: string;
  timezone: string;
  context_json: string;
  input_hash: string;
  created_at: string;
}

interface DecisionRow {
  id: string;
  athlete_id: string;
  created_at: string;
  context_snapshot_id: string;
  runtime_type: TrainingDecision["runtimeType"];
  state: TrainingDecision["state"];
  action: TrainingDecision["action"];
  confidence: TrainingDecision["confidence"];
  signals_json: string;
  reasoning_summary_json: string;
  original_workout_json: string | null;
  proposed_workout_json: string | null;
  status: DecisionStatus;
  managed_id: string | null;
  model_metadata_json: string;
  user_feedback: string | null;
  updated_at: string;
}

interface ManagedWorkoutRow {
  id: string;
  athlete_id: string;
  managed_id: string;
  intent: ManagedWorkout["intent"];
  scheduled_date: string | null;
  intervals_external_id: string | null;
  latest_decision_id: string | null;
  status: ManagedWorkout["status"];
  created_at: string;
  updated_at: string;
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function decisionFromRow(row: DecisionRow): TrainingDecision {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    createdAt: row.created_at,
    contextSnapshotId: row.context_snapshot_id,
    runtimeType: row.runtime_type,
    state: row.state,
    action: row.action,
    confidence: row.confidence,
    signals: parseJson(row.signals_json) as TrainingDecision["signals"],
    reasoningSummary: parseJson(row.reasoning_summary_json) as TrainingDecision["reasoningSummary"],
    ...(row.original_workout_json === null ? {} : { originalWorkout: parseJson(row.original_workout_json) as NonNullable<TrainingDecision["originalWorkout"]> }),
    ...(row.proposed_workout_json === null ? {} : { proposedWorkout: parseJson(row.proposed_workout_json) as NonNullable<TrainingDecision["proposedWorkout"]> }),
    status: row.status,
    ...(row.managed_id === null ? {} : { managedId: row.managed_id }),
    modelMetadata: parseJson(row.model_metadata_json) as TrainingDecision["modelMetadata"],
    ...(row.user_feedback === null ? {} : { userFeedback: row.user_feedback }),
  };
}

function managedWorkoutFromRow(row: ManagedWorkoutRow): ManagedWorkout {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    managedId: row.managed_id,
    intent: row.intent,
    ...(row.scheduled_date === null ? {} : { currentDate: row.scheduled_date }),
    ...(row.intervals_external_id === null ? {} : { intervalsExternalId: row.intervals_external_id }),
    ...(row.latest_decision_id === null ? {} : { latestDecisionId: row.latest_decision_id }),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class D1TrainingContextRepository implements TrainingContextRepository {
  constructor(private readonly db: D1Database) {}

  async create(input: Omit<TrainingContextSnapshot, "id">): Promise<TrainingContextSnapshot> {
    const snapshot = { id: crypto.randomUUID(), ...input };
    const contextJson = stableJson(snapshot);
    const semanticInput = Object.fromEntries(
      Object.entries(input).filter(([key]) => key !== "generatedAt"),
    );
    const inputHash = await sha256(stableJson(semanticInput));
    const createdAt = new Date().toISOString();
    await this.db.prepare(
      "INSERT INTO training_context_snapshots (id, athlete_id, generated_at, timezone, context_json, input_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(snapshot.id, snapshot.athlete.athleteId, snapshot.generatedAt, snapshot.timezone, contextJson, inputHash, createdAt).run();
    return snapshot;
  }

  async findById(id: string, athleteId: string): Promise<TrainingContextSnapshot | undefined> {
    const row = await this.db.prepare(
      "SELECT * FROM training_context_snapshots WHERE id = ? AND athlete_id = ?",
    ).bind(id, athleteId).first<SnapshotRow>();
    return row === null ? undefined : parseJson(row.context_json) as TrainingContextSnapshot;
  }
}

export class D1TrainingDecisionRepository implements TrainingDecisionRepository {
  constructor(
    private readonly db: D1Database,
    private readonly contexts: TrainingContextRepository,
  ) {}

  async create(athleteId: string, draft: TrainingDecisionDraft): Promise<TrainingDecision> {
    if (await this.contexts.findById(draft.contextSnapshotId, athleteId) === undefined) {
      throw new RangeError("contextSnapshotId does not belong to this athlete or no longer exists");
    }
    const createdAt = new Date().toISOString();
    const decision: TrainingDecision = {
      id: crypto.randomUUID(),
      athleteId,
      createdAt,
      ...draft,
      status: "PROPOSED",
    };
    await this.db.prepare(
      `INSERT INTO training_decisions (
        id, athlete_id, created_at, context_snapshot_id, runtime_type, state, action,
        confidence, signals_json, reasoning_summary_json, original_workout_json,
        proposed_workout_json, status, managed_id, model_metadata_json, user_feedback, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    ).bind(
      decision.id,
      decision.athleteId,
      decision.createdAt,
      decision.contextSnapshotId,
      decision.runtimeType,
      decision.state,
      decision.action,
      decision.confidence,
      JSON.stringify(decision.signals),
      JSON.stringify(decision.reasoningSummary),
      decision.originalWorkout === undefined ? null : JSON.stringify(decision.originalWorkout),
      decision.proposedWorkout === undefined ? null : JSON.stringify(decision.proposedWorkout),
      decision.status,
      decision.managedId ?? null,
      JSON.stringify(decision.modelMetadata),
      createdAt,
    ).run();
    return decision;
  }

  async findById(id: string, athleteId: string): Promise<TrainingDecision | undefined> {
    const row = await this.db.prepare(
      "SELECT * FROM training_decisions WHERE id = ? AND athlete_id = ?",
    ).bind(id, athleteId).first<DecisionRow>();
    return row === null ? undefined : decisionFromRow(row);
  }

  async findRecent(athleteId: string, since: string, limit: number): Promise<TrainingDecision[]> {
    const result = await this.db.prepare(
      "SELECT * FROM training_decisions WHERE athlete_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT ?",
    ).bind(athleteId, since, limit).all<DecisionRow>();
    return result.results.map(decisionFromRow);
  }

  async transition(
    id: string,
    athleteId: string,
    status: DecisionStatus,
    userFeedback?: string,
  ): Promise<TrainingDecision> {
    const current = await this.findById(id, athleteId);
    if (current === undefined) throw new RangeError("Training decision not found");
    assertDecisionTransition(current.status, status);
    const updatedAt = new Date().toISOString();
    const result = await this.db.prepare(
      "UPDATE training_decisions SET status = ?, user_feedback = ?, updated_at = ? WHERE id = ? AND athlete_id = ? AND status = ?",
    ).bind(status, userFeedback ?? null, updatedAt, id, athleteId, current.status).run();
    if (result.meta.changes !== 1) throw new Error("Training decision changed concurrently; reload its status");
    const updated = await this.findById(id, athleteId);
    if (updated === undefined) throw new Error("Updated training decision could not be reloaded");
    return updated;
  }
}

export class D1ManagedWorkoutRepository implements ManagedWorkoutRepository {
  constructor(private readonly db: D1Database) {}

  async upsertPublished(athleteId: string, workouts: PublishedManagedWorkout[]): Promise<ManagedWorkout[]> {
    const results: ManagedWorkout[] = [];
    for (const workout of workouts) {
      const existing = await this.findByManagedId(athleteId, workout.managedId);
      const now = new Date().toISOString();
      const id = existing?.id ?? crypto.randomUUID();
      await this.db.prepare(
        `INSERT INTO managed_workouts (
          id, athlete_id, managed_id, intent, scheduled_date, intervals_external_id,
          latest_decision_id, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', ?, ?)
        ON CONFLICT (athlete_id, managed_id) DO UPDATE SET
          intent = excluded.intent,
          scheduled_date = excluded.scheduled_date,
          intervals_external_id = COALESCE(excluded.intervals_external_id, managed_workouts.intervals_external_id),
          latest_decision_id = COALESCE(excluded.latest_decision_id, managed_workouts.latest_decision_id),
          status = 'PUBLISHED',
          updated_at = excluded.updated_at`,
      ).bind(
        id,
        athleteId,
        workout.managedId,
        workout.intent,
        workout.currentDate ?? null,
        workout.intervalsExternalId ?? null,
        workout.latestDecisionId ?? null,
        existing?.createdAt ?? now,
        now,
      ).run();
      const saved = await this.findByManagedId(athleteId, workout.managedId);
      if (saved !== undefined) results.push(saved);
    }
    return results;
  }

  async findByManagedId(athleteId: string, managedId: string): Promise<ManagedWorkout | undefined> {
    const row = await this.db.prepare(
      "SELECT * FROM managed_workouts WHERE athlete_id = ? AND managed_id = ?",
    ).bind(athleteId, managedId).first<ManagedWorkoutRow>();
    return row === null ? undefined : managedWorkoutFromRow(row);
  }
}

export function createD1TrainingMemory(db: D1Database): TrainingMemoryServices {
  const contexts = new D1TrainingContextRepository(db);
  return {
    contexts,
    decisions: new D1TrainingDecisionRepository(db, contexts),
    managedWorkouts: new D1ManagedWorkoutRepository(db),
  };
}
