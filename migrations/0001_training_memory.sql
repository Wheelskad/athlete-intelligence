CREATE TABLE IF NOT EXISTS training_context_snapshots (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  timezone TEXT NOT NULL,
  context_json TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_training_context_snapshots_athlete_created
  ON training_context_snapshots (athlete_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_context_snapshots_input_hash
  ON training_context_snapshots (athlete_id, input_hash);

CREATE TABLE IF NOT EXISTS training_decisions (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  context_snapshot_id TEXT NOT NULL,
  runtime_type TEXT NOT NULL CHECK (runtime_type IN ('DAILY', 'POST_WORKOUT', 'WEEKLY', 'RECOVERY_CHANGE', 'ON_DEMAND')),
  state TEXT NOT NULL CHECK (state IN ('RED', 'AMBER', 'GREEN', 'PRIME')),
  action TEXT NOT NULL CHECK (action IN ('REST', 'KEEP', 'REDUCE', 'REPLACE', 'POSTPONE')),
  confidence TEXT NOT NULL CHECK (confidence IN ('LOW', 'MEDIUM', 'HIGH')),
  signals_json TEXT NOT NULL,
  reasoning_summary_json TEXT NOT NULL,
  original_workout_json TEXT,
  proposed_workout_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('PROPOSED', 'ACCEPTED', 'REJECTED', 'PUBLISHED', 'COMPLETED', 'SUPERSEDED')),
  managed_id TEXT,
  model_metadata_json TEXT NOT NULL,
  user_feedback TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (context_snapshot_id) REFERENCES training_context_snapshots(id)
);

CREATE INDEX IF NOT EXISTS idx_training_decisions_athlete_created
  ON training_decisions (athlete_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_decisions_managed_id
  ON training_decisions (athlete_id, managed_id);

CREATE TABLE IF NOT EXISTS managed_workouts (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL,
  managed_id TEXT NOT NULL,
  intent TEXT NOT NULL,
  scheduled_date TEXT,
  intervals_external_id TEXT,
  latest_decision_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('PLANNED', 'PUBLISHED', 'COMPLETED', 'CANCELLED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (athlete_id, managed_id),
  FOREIGN KEY (latest_decision_id) REFERENCES training_decisions(id)
);

CREATE INDEX IF NOT EXISTS idx_managed_workouts_athlete_status
  ON managed_workouts (athlete_id, status, scheduled_date);
