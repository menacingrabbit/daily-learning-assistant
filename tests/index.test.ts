import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServices, cronExpression, isReminderDue, parseCliArgs } from '../src/index.js';
import { ConsoleNotifier } from '../src/notify/console.js';

describe('parseCliArgs', () => {
  it('defaults every flag to false when given no args', () => {
    expect(parseCliArgs(['node', 'index.ts'])).toEqual({
      once: false,
      testrun: false,
      list: false,
      config: undefined,
    });
  });

  it('parses --once, --testrun and --list', () => {
    const args = parseCliArgs(['node', 'index.ts', '--once', '--testrun', '--list']);
    expect(args).toMatchObject({ once: true, testrun: true, list: true });
  });

  it('parses --config=<path>', () => {
    const args = parseCliArgs(['node', 'index.ts', '--config=config/custom.yaml']);
    expect(args.config).toBe('config/custom.yaml');
  });

  it('parses a space-separated --config <path>', () => {
    const args = parseCliArgs(['node', 'index.ts', '--config', 'config/custom.yaml']);
    expect(args.config).toBe('config/custom.yaml');
  });

  it('leaves config undefined when --config is last with no value', () => {
    expect(parseCliArgs(['node', 'index.ts', '--config']).config).toBeUndefined();
  });

  it('ignores unknown args', () => {
    const args = parseCliArgs(['node', 'index.ts', '--verbose', 'extra']);
    expect(args).toEqual({ once: false, testrun: false, list: false, config: undefined });
  });
});

describe('cronExpression', () => {
  it('converts a reminder time to a daily cron expression', () => {
    expect(cronExpression('08:00')).toBe('0 8 * * *');
    expect(cronExpression('21:45')).toBe('45 21 * * *');
    expect(cronExpression('00:05')).toBe('5 0 * * *');
  });
});

describe('isReminderDue', () => {
  it('is false before the reminder time and true at or after it', () => {
    // 2026-08-24T06:00:00Z is 08:00 in Europe/Berlin (CEST, UTC+2).
    expect(isReminderDue(new Date('2026-08-24T05:59:00Z'), '08:00', 'Europe/Berlin')).toBe(false);
    expect(isReminderDue(new Date('2026-08-24T06:00:00Z'), '08:00', 'Europe/Berlin')).toBe(true);
    expect(isReminderDue(new Date('2026-08-24T18:00:00Z'), '08:00', 'Europe/Berlin')).toBe(true);
  });

  it('evaluates against the configured timezone, not the host clock', () => {
    // 2026-08-24T07:30:00Z is 09:30 Berlin but 00:30 in Los Angeles.
    const now = new Date('2026-08-24T07:30:00Z');
    expect(isReminderDue(now, '08:00', 'Europe/Berlin')).toBe(true);
    expect(isReminderDue(now, '08:00', 'America/Los_Angeles')).toBe(false);
  });

  it('handles midnight-wrapping reminder times', () => {
    expect(isReminderDue(new Date('2026-08-24T06:00:00Z'), '00:00', 'Europe/Berlin')).toBe(true);
    expect(isReminderDue(new Date('2026-08-24T21:59:00Z'), '00:00', 'Europe/Berlin')).toBe(true);
    // 22:00Z = 00:00 Berlin on 2026-08-25 (counts as the new day's reminder).
    expect(isReminderDue(new Date('2026-08-24T22:00:00Z'), '23:30', 'Europe/Berlin')).toBe(false);
  });
});

describe('createServices', () => {
  const VALID_YAML = `
subject: "software architecture & engineering"
session_length_minutes: 30
difficulty: intermediate
checkin_style: recap_question
reminder_time: "08:00"
timezone: Europe/Berlin
`;

  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dla-index-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /** Writes a valid topics.yaml (plus .env) and returns a db path in the temp dir. */
  function setup(env: string | null = ''): { configPath: string; dbPath: string } {
    const configPath = join(dir, 'topics.yaml');
    writeFileSync(configPath, VALID_YAML);
    if (env !== null) writeFileSync(join(dir, '.env'), env);
    return { configPath, dbPath: join(dir, 'nested', 'db.sqlite') };
  }

  it('loads config, creates the DB directory and falls back to Console', () => {
    const { configPath, dbPath } = setup();
    const svc = createServices({ configPath, dbPath });
    try {
      expect(svc.config.subject).toBe('software architecture & engineering');
      expect(existsSync(join(dir, 'nested'))).toBe(true);
      // No Telegram credentials → dry-run notifier.
      expect(svc.notifier).toBeInstanceOf(ConsoleNotifier);
    } finally {
      svc.store.close();
    }
  });

  it('writes to the dbPath override rather than the DB_PATH default', () => {
    const { configPath, dbPath } = setup();
    const svc = createServices({ configPath, dbPath });
    try {
      svc.store.saveSession('2026-08-23', {
        title: 'Overridden',
        summary: 'x',
        resources: [],
        estimatedMinutes: 30,
      });
      expect(existsSync(dbPath)).toBe(true);
      expect(svc.store.getSession('2026-08-23')?.title).toBe('Overridden');
    } finally {
      svc.store.close();
    }
  });
});