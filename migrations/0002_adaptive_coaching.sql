ALTER TABLE managed_workouts ADD COLUMN sport TEXT;
ALTER TABLE managed_workouts ADD COLUMN title TEXT;
ALTER TABLE managed_workouts ADD COLUMN description TEXT;
ALTER TABLE managed_workouts ADD COLUMN expected_duration_minutes REAL;
ALTER TABLE managed_workouts ADD COLUMN parsed_duration_minutes REAL;
ALTER TABLE managed_workouts ADD COLUMN training_load REAL;
ALTER TABLE managed_workouts ADD COLUMN workout_blocks_json TEXT;
ALTER TABLE managed_workouts ADD COLUMN publication_verification_json TEXT;

CREATE TABLE IF NOT EXISTS pre_workout_feedback (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  managed_id TEXT,
  feeling TEXT CHECK (feeling IN ('GREAT', 'OK', 'TIRED', 'NO_MOTIVATION')),
  fatigue INTEGER CHECK (fatigue BETWEEN 1 AND 10),
  motivation INTEGER CHECK (motivation BETWEEN 1 AND 10),
  pain_json TEXT,
  time_available_minutes INTEGER CHECK (time_available_minutes > 0),
  preferred_sport TEXT,
  message TEXT
);

CREATE INDEX IF NOT EXISTS idx_pre_workout_feedback_athlete_created
  ON pre_workout_feedback (athlete_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pre_workout_feedback_managed_created
  ON pre_workout_feedback (athlete_id, managed_id, created_at DESC);
