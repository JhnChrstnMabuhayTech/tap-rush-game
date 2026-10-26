-- Players and rounds (docs/backend/README.md). Player IDs and scores only: no
-- names or photos, which the game can't read and the server mustn't store
-- (SDK 8.0, D11). Times are milliseconds since the epoch.

CREATE TABLE players (
  -- The game-scoped ID from FBInstant.player.getID().
  id TEXT PRIMARY KEY,
  best_score INTEGER NOT NULL DEFAULT 0,
  best_at INTEGER,
  updated_at INTEGER NOT NULL
);

-- The leaderboard: highest first, and on a tie the earlier score first.
CREATE INDEX players_by_best ON players (best_score DESC, best_at ASC);

CREATE TABLE rounds (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players (id),
  seed INTEGER NOT NULL,
  rules_version INTEGER NOT NULL,
  -- The play frame the round was set up for, in the simulation's units.
  field_w REAL NOT NULL,
  field_h REAL NOT NULL,
  field_top REAL NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  submitted_at INTEGER,
  -- The tap log as JSON, kept so a score can be re-checked later.
  taps TEXT,
  -- The score the server's replay produced; the claimed score is never stored.
  score INTEGER,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'ranked', 'rejected')),
  reject_reason TEXT
);

CREATE INDEX rounds_by_player ON rounds (player_id, status);
