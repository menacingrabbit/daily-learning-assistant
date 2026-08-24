import type { Database } from 'better-sqlite3';

/**
 * Session persistence model.
 *
 * One row per day the loop ran. `topic`/`summary` hold yesterday's material when
 * the recap flows through the same table; `recap_status` tracks whether the
 * user's answer came back and `status` whether a recap is owed.
 */
export interface SessionRow {
  id: number;
  /** Local YYYY-MM-DD the topic belongs to. */
  date: string;
  title: string;
  summary: string;
  resources: string;
  estimated_minutes: number;
  /** Raw free-text answer from the user, or NULL while pending. */
  recap_answer: string | null;
  /** 'expected' -> recap question sent; 'answered' -> user replied. */
  recap_status: 'expected' | 'answered';
  /** Grading output of the recap (recap_question style only). NULL = not graded. */
  recap_understood: boolean | null;
  /** Free-text grading feedback, shown back to the user. */
  recap_feedback: string | null;
  status: 'active' | 'replaced';
}

export function initSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      date              TEXT NOT NULL UNIQUE,
      title             TEXT NOT NULL,
      summary           TEXT NOT NULL DEFAULT '',
      resources         TEXT NOT NULL DEFAULT '',
      estimated_minutes INTEGER NOT NULL DEFAULT 30,
      recap_answer      TEXT,
      recap_status      TEXT NOT NULL DEFAULT 'expected',
      recap_understood  INTEGER,
      recap_feedback    TEXT,
      status            TEXT NOT NULL DEFAULT 'active'
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
    CREATE INDEX IF NOT EXISTS idx_sessions_recap ON sessions(recap_status, date);
  `);
}