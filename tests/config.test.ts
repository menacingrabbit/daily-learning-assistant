import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';

const VALID_YAML = `
subject: "software architecture & engineering"
session_length_minutes: 30
difficulty: intermediate
checkin_style: recap_question
reminder_time: "08:00"
timezone: Europe/Berlin
`;

let dir: string;

const ENV_KEYS = ['MODEL', 'OPENROUTER_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'DB_PATH'];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dla-config-'));
});

afterEach(() => {
  // process.env persists across tests in one worker; clean any keys a prior
  // test's .env load may have injected so each test starts fresh.
  for (const key of ENV_KEYS) delete process.env[key];
  rmSync(dir, { recursive: true, force: true });
});

/** Writes topics.yaml (and optionally .env) into the temp dir. */
function writeConfig(yaml: string, env: string | null): string {
  const configPath = join(dir, 'topics.yaml');
  writeFileSync(configPath, yaml);
  if (env !== null) writeFileSync(join(dir, '.env'), env);
  return configPath;
}

describe('loadConfig', () => {
  it('parses a valid topics.yaml', () => {
    const configPath = writeConfig(VALID_YAML, null);
    const { app } = loadConfig({ configPath });
    expect(app.subject).toBe('software architecture & engineering');
    expect(app.checkinStyle).toBe('recap_question');
    expect(app.reminderTime).toBe('08:00');
  });

  it('accepts all three checkin styles', () => {
    for (const style of ['confirm_only', 'spaced_review'] as const) {
      const yaml = VALID_YAML.replace('recap_question', style);
      const configPath = writeConfig(yaml, null);
      expect(loadConfig({ configPath }).app.checkinStyle).toBe(style);
    }
  });

  it('rejects an unknown checkin style', () => {
    const configPath = writeConfig(VALID_YAML.replace('recap_question', 'overachiever'), null);
    expect(() => loadConfig({ configPath })).toThrow();
  });

  it('rejects a malformed reminder_time', () => {
    const configPath = writeConfig(VALID_YAML.replace('"08:00"', '"8am"'), null);
    expect(() => loadConfig({ configPath })).toThrow();
  });

  it('rejects out-of-range session length', () => {
    const configPath = writeConfig(
      VALID_YAML.replace('session_length_minutes: 30', 'session_length_minutes: 600'),
      null,
    );
    expect(() => loadConfig({ configPath })).toThrow();
  });

  it('throws when the config file is missing', () => {
    expect(() => loadConfig({ configPath: join(dir, 'nope.yaml') })).toThrow(/not found/);
  });

  it('loads optional env vars as undefined when absent', () => {
    const configPath = writeConfig(VALID_YAML, 'MODEL=openai/gpt-4o-mini\n');
    const { env } = loadConfig({ configPath });
    expect(env.openrouterApiKey).toBeUndefined();
    expect(env.telegramBotToken).toBeUndefined();
    expect(env.model).toBe('openai/gpt-4o-mini');
  });

  it('loads env vars and resolves DB_PATH', () => {
    const configPath = writeConfig(VALID_YAML, 'OPENROUTER_API_KEY=sk-x\nDB_PATH=tmp/db.sqlite\n');
    const { env } = loadConfig({ configPath });
    expect(env.openrouterApiKey).toBe('sk-x');
    expect(env.dbPath.endsWith(join('tmp', 'db.sqlite'))).toBe(true);
  });

  it('accepts an optional stack preference', () => {
    const configPath = writeConfig(`${VALID_YAML}stack: "TypeScript/Node"\n`, null);
    expect(loadConfig({ configPath }).app.stack).toBe('TypeScript/Node');
  });

  it('treats a blank stack as unset', () => {
    const configPath = writeConfig(`${VALID_YAML}stack: "  "\n`, null);
    expect(loadConfig({ configPath }).app.stack).toBeUndefined();
  });

  it('omits stack entirely when not configured', () => {
    const configPath = writeConfig(VALID_YAML, null);
    expect(loadConfig({ configPath }).app.stack).toBeUndefined();
  });

  it('keeps a normal model default when MODEL is unset', () => {
    const configPath = writeConfig(VALID_YAML, null);
    // An existing empty envFile short-circuits loadDotenv before it reaches the
    // project-root .env, so a real .env (e.g. MODEL=...) can't leak into the test.
    const emptyEnv = join(dir, 'empty.env');
    writeFileSync(emptyEnv, '');
    const { env } = loadConfig({ configPath, envFile: emptyEnv });
    expect(env.model).toBe('anthropic/claude-sonnet-4.6');
  });
});