import Database from 'better-sqlite3';
import type { SessionRow } from './schema.js';
import { initSchema } from './schema.js';

export interface TopicData {
  title: string;
  summary: string;
  resources: string[];
  estimatedMinutes: number;
}

export interface SessionData extends TopicData {}

/** Local date string (YYYY-MM-DD) in the configured timezone. */
export function toLocalDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export class Store {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    initSchema(this.db);
  }

  /** Exposed for tests: open an in-memory database backed by the same schema. */
  static inMemory(): Store {
    const store = new Store(':memory:');
    return store;
  }

  close(): void {
    this.db.close();
  }

  /** Insert or replace the session row for a given local date. */
  saveSession(date: string, data: SessionData): void {
    this.db
      .prepare(
        `INSERT INTO sessions (date, title, summary, resources, estimated_minutes)
         VALUES (@date, @title, @summary, @resources, @estimated_minutes)
         ON CONFLICT(date) DO UPDATE SET
           title = excluded.title,
           summary = excluded.summary,
           resources = excluded.resources,
           estimated_minutes = excluded.estimated_minutes,
           status = 'active'
         `,
      )
      .run({
        date,
        title: data.title,
        summary: data.summary,
        resources: JSON.stringify(data.resources),
        estimated_minutes: data.estimatedMinutes,
      });
  }

  /** The session row for a given local date, or undefined. */
  getSession(date: string): SessionRow | undefined {
    return this.db
      .prepare('SELECT * FROM sessions WHERE date = ?')
      .get(date) as SessionRow | undefined;
  }

  /** The session with the largest date strictly before `date`, or undefined. */
  getSessionBefore(date: string): SessionRow | undefined {
    return this.db
      .prepare('SELECT * FROM sessions WHERE date < ? ORDER BY date DESC LIMIT 1')
      .get(date) as SessionRow | undefined;
  }

  /**
   * The most recent session before `beforeDate` whose recap is still owed
   * (recap expected, no answer recorded). Used to re-ask instead of advancing.
   */
  pendingRecap(beforeDate: string): SessionRow | undefined {
    return this.db
      .prepare(
        `SELECT * FROM sessions
         WHERE date < ? AND recap_status = 'expected' AND recap_answer IS NULL
         ORDER BY date DESC LIMIT 1`,
      )
      .get(beforeDate) as SessionRow | undefined;
  }

  /** Mark the session's recap answer as received. */
  markRecapAnswered(date: string, answer: string): boolean {
    const res = this.db
      .prepare(`UPDATE sessions SET recap_answer = ?, recap_status = 'answered' WHERE date = ?`)
      .run(answer, date);
    return res.changes > 0;
  }

  /** Store the graded outcome of a recap (recap_question style only). */
  markRecapGraded(date: string, understood: boolean, feedback: string): void {
    this.db
      .prepare(
        `UPDATE sessions SET recap_understood = ?, recap_feedback = ? WHERE date = ?`,
      )
      .run(understood ? 1 : 0, feedback, date);
  }

  /**
   * Titles of the most recent sessions for repeat-avoidance,
   * newest first. Used as input to topic generation.
   */
  recentTitles(limit = 10): string[] {
    const rows = this.db
      .prepare('SELECT title FROM sessions ORDER BY date DESC LIMIT ?')
      .all(limit) as Array<{ title: string }>;
    return rows.map((r) => r.title);
  }

  /** Raw rows for admin/tests. */
  allSessions(): SessionRow[] {
    return this.db.prepare('SELECT * FROM sessions ORDER BY date').all() as SessionRow[];
  }
}