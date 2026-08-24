import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

export const CHECKIN_STYLES = ['recap_question', 'confirm_only', 'spaced_review'] as const;
export type CheckinStyle = (typeof CHECKIN_STYLES)[number];

/** Everything that lives in config/topics.yaml — user-editable, not in code. */
export interface AppConfig {
  subject: string;
  sessionLengthMinutes: number;
  difficulty: 'easy' | 'intermediate' | 'advanced';
  checkinStyle: CheckinStyle;
  reminderTime: string; // HH:MM, local
  timezone: string; // IANA name
}

/**
 * Runtime credentials / environment. `openrouterApiKey` and `telegramBotToken`
 * are optional so the app degrades to dry-run / fallback modes when the
 * adopter hasn't configured real services yet.
 */
export interface RuntimeEnv {
  openrouterApiKey?: string;
  model: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  dbPath: string;
}

const configSchema = z.object({
  subject: z.string().min(1),
  session_length_minutes: z.number().int().min(1).max(480),
  difficulty: z.enum(['easy', 'intermediate', 'advanced']),
  checkin_style: z.enum(CHECKIN_STYLES),
  reminder_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'reminder_time must be HH:MM in 24h format',
  }),
  timezone: z.string().min(1),
});

function loadYamlConfig(path: string): AppConfig {
  if (!existsSync(path)) {
    throw new Error(
      `Config file not found: ${path}\n` +
        `Copy config/topics.example.yaml to ${path} (or pass --config) and edit it.`,
    );
  }
  const parsed = parseYaml(readFileSync(path, 'utf8'));
  const validated = configSchema.parse(parsed);
  return {
    subject: validated.subject,
    sessionLengthMinutes: validated.session_length_minutes,
    difficulty: validated.difficulty,
    checkinStyle: validated.checkin_style,
    reminderTime: validated.reminder_time,
    timezone: validated.timezone,
  };
}

/**
 * Loads the first existing .env file from the candidate list (Node >=20.12),
 * else no-op. Env loading is "never overrides an already-set variable", so a
 * real shell environment takes precedence over a .env file.
 */
function loadDotenv(candidates: string[]): void {
  for (const candidate of candidates) {
    try {
      process.loadEnvFile(candidate);
      return;
    } catch {
      // Missing file — try the next candidate.
    }
  }
}

const envSchema = z.object({
  OPENROUTER_API_KEY: z.string().optional(),
  MODEL: z.string().min(1).default('anthropic/claude-sonnet-4.6'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  DB_PATH: z.string().default('data/db.sqlite'),
});

export interface LoadedConfig {
  app: AppConfig;
  env: RuntimeEnv;
  configPath: string;
}

export function loadConfig(options: { configPath?: string; envFile?: string } = {}): LoadedConfig {
  const configPath = resolve(options.configPath ?? 'config/topics.yaml');
  loadDotenv([
    ...(options.envFile ? [resolve(options.envFile)] : []),
    join(dirname(configPath), '.env'), // .env next to the topics config
    '.env', // project root
  ]);
  const app = loadYamlConfig(configPath);
  const env = envSchema.parse(process.env);

  // Return optional values as undefined instead of empty strings so dry-run
  // detection is a single truthy check.
  const optional = (v: string | undefined) => (v && v.trim().length > 0 ? v : undefined);

  return {
    app,
    env: {
      openrouterApiKey: optional(env.OPENROUTER_API_KEY),
      model: env.MODEL,
      telegramBotToken: optional(env.TELEGRAM_BOT_TOKEN),
      telegramChatId: optional(env.TELEGRAM_CHAT_ID),
      dbPath: resolve(env.DB_PATH),
    },
    configPath: options.configPath ?? 'config/topics.yaml',
  };
}