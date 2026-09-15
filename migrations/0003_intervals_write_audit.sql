CREATE TABLE IF NOT EXISTS intervals_write_audit (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL,
  managed_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('CREATE', 'UPDATE')),
  caller TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  duration_sent_minutes REAL,
  parsed_duration_minutes REAL,
  decision_id TEXT,
  intervals_external_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('VERIFIED', 'VERIFICATION_FAILED')),
  warning_code TEXT
);

CREATE INDEX IF NOT EXISTS idx_intervals_write_audit_managed_timestamp
  ON intervals_write_audit (athlete_id, managed_id, timestamp DESC);
