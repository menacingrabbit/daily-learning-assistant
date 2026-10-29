import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cron from 'node-cron';
import { FallbackLlm } from './agent/fallback.js';
import { OpenRouterLlm } from './agent/llm.js';
import { runDaily, type LoopOutcome } from './agent/loop.js';
import { loadConfig, type AppConfig, type RuntimeEnv } from './config.js';
import { Store, toLocalDate } from './db/store.js';
import type { Notifier } from './notify/notifier.js';
import { ConsoleNotifier } from './notify/console.js';
import { TelegramNotifier } from './notify/telegram.js';

export interface Services {
  store: Store;
  notifier: Notifier;
  config: AppConfig;
  runtime: RuntimeEnv;
}

/** Wire dependencies, mirroring PLAN.md's entrypoint responsibilities. */
export function createServices(options: { configPath?: string; dbPath?: string } = {}): Services {
  const { app: config, env: runtime } = loadConfig({ configPath: options.configPath });
  // dbPath override lets --testrun point at a throwaway DB instead of the real one.
  const dbPath = options.dbPath ?? runtime.dbPath;
  mkdirSync(dirname(dbPath), { recursive: true });

  const store = new Store(dbPath);
  const notifier =
    runtime.telegramBotToken && runtime.telegramChatId
      ? new TelegramNotifier(runtime.telegramBotToken, runtime.telegramChatId)
      : new ConsoleNotifier();
  return { store, notifier, config, runtime };
}

export function buildLlm(runtime: RuntimeEnv) {
  return runtime.openrouterApiKey
    ? new OpenRouterLlm(runtime.openrouterApiKey, runtime.model)
    : new FallbackLlm();
}

export function cronExpression(reminderTime: string): string {
  const [hour, minute] = reminderTime.split(':').map(Number);
  return `${minute} ${hour} * * *`;
}

/** Minutes since local midnight for `date` in `timezone`. */
export function localMinutesOfDay(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

/**
 * True when today's reminder time has already passed in the configured
 * timezone. Used at startup to catch up on a tick missed while the service
 * was down (a deploy, a crash, a laptop that was asleep).
 */
export function isReminderDue(
  now: Date,
  reminderTime: string,
  timezone: string,
): boolean {
  const [hour, minute] = reminderTime.split(':').map(Number);
  return localMinutesOfDay(now, timezone) >= (hour ?? 0) * 60 + (minute ?? 0);
}

export function parseCliArgs(argv: string[]): {
  once: boolean;
  testrun: boolean;
  list: boolean;
  config?: string;
} {
  let once = false;
  let testrun = false;
  let list = false;
  let config: string | undefined;
  for (const arg of argv.slice(2)) {
    if (arg === '--once') once = true;
    else if (arg === '--testrun') testrun = true;
    else if (arg === '--list') list = true;
    else if (arg.startsWith('--config=')) config = arg.slice('--config='.length);
    else if (arg === '--config') {
      const idx = argv.indexOf(arg);
      const next = argv[idx + 1];
      if (next) config = next;
    }
  }
  return { once, testrun, list, config };
}

/**
 * Throwaway SQLite file for --testrun. The daily loop runs against this so a
 * manual trigger test never touches the real session history in data/db.sqlite.
 */
function createTempDb(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'dla-testrun-'));
  return {
    path: join(dir, 'db.sqlite'),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Human-readable result of a --testrun, printed regardless of notifier. */
function printTestrunOutcome(outcome: LoopOutcome): void {
  if (outcome.kind === 'recap_reminder') {
    console.log(
      `[testrun] recap pending for "${outcome.sessionTitle}" (${outcome.date}) — no new topic.`,
    );
    return;
  }
  const t = outcome.topic;
  console.log(`[testrun] ✓ simulated daily trigger for ${outcome.date}`);
  console.log(`[testrun] topic: ${t.title} (~${t.estimatedMinutes} min)`);
  console.log(`[testrun] summary: ${t.summary}`);
  if (t.resources && t.resources.length > 0) {
    console.log('[testrun] resources:');
    for (const r of t.resources) console.log(`  - ${r}`);
  }
}

/** Number of recent sessions shown by `--list`. */
const LIST_PAGE_SIZE = 15;

/** Truncate a long description to ~120 chars, appending an ellipsis. */
function truncate(text: string, max = 120): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

/** Human-readable list of the most recent suggested topics (`--list`). */
function printRecentSessions(store: Store): void {
  const rows = store.recentSessions(LIST_PAGE_SIZE);
  if (rows.length === 0) {
    console.log('[list] No sessions recorded yet. Run the agent once to create one.');
    return;
  }
  console.log(`[list] last ${rows.length} suggested topics:`);
  for (const r of rows) {
    console.log(`  • ${r.date} — ${r.title} (~${r.estimated_minutes} min)`);
    console.log(`      ${truncate(r.summary)}`);
  }
}

async function main(): Promise<void> {
  const { once, testrun, list, config } = parseCliArgs(process.argv);
  const tempDb = testrun ? createTempDb() : undefined;
  const svc = createServices({ configPath: config, dbPath: tempDb?.path });
  const llm = buildLlm(svc.runtime);
  const { store, notifier, config: appConfig } = svc;

  // --list: print the most recent suggested topics and exit. No scheduler, no
  // reply polling — purely an admin view over session history.
  if (list) {
    printRecentSessions(store);
    store.close();
    return;
  }

  if (appConfig.checkinStyle === 'spaced_review') {
    console.warn(
      '[daily-learning] checkin_style=spaced_review is not implemented yet; using confirm_only behavior.',
    );
  }

  // --testrun: fire the same daily loop the scheduler would, against a
  // throwaway DB, print the result, and exit. No reply-listening needed — a
  // fresh temp DB never has a pending recap.
  if (testrun) {
    console.log('[testrun] simulating the daily cron trigger (isolated temp DB)');
    try {
      const outcome = await runDaily({ store, notifier, llm, config: appConfig });
      printTestrunOutcome(outcome);
    } finally {
      await notifier.stop();
      store.close();
      tempDb?.cleanup();
    }
    return;
  }

  await notifier.startListening(async (msg) => {
    try {
      const date = toLocalDate(new Date(), appConfig.timezone);
      const session = store.pendingRecap(date);
      if (!session) return;
      store.markRecapAnswered(session.date, msg.text);
      await notifier.send({
        text:
          appConfig.checkinStyle === 'recap_question'
            ? '📥 Recap recorded. I’ll grade it on the next check-in.'
            : '📥 Got it — recap logged.',
      });
    } catch (err) {
      console.error('[reply-handler] error:', err);
    }
  });

  if (once) {
    console.log('[daily] running once (--once)');
    await runDaily({ store, notifier, llm, config: appConfig });
    await notifier.stop();
    store.close();
    return;
  }

  const expr = cronExpression(appConfig.reminderTime);
  cron.schedule(
    expr,
    () => {
      runDaily({ store, notifier, llm, config: appConfig }).catch((err) =>
        console.error('[daily] run failed:', err),
      );
    },
    { timezone: appConfig.timezone, name: 'daily-topic', noOverlap: true },
  );

  // Catch up on a tick missed while the service was down: if the reminder time
  // has already passed today and today's topic was never sent, run the loop
  // now instead of waiting for tomorrow.
  const startupNow = new Date();
  const today = toLocalDate(startupNow, appConfig.timezone);
  if (isReminderDue(startupNow, appConfig.reminderTime, appConfig.timezone)) {
    if (store.getSession(today)) {
      console.log('[daily] started after reminder time; today already handled — no catch-up needed');
    } else {
      console.log('[daily] started after reminder time and no session for today — catching up now');
      runDaily({ store, notifier, llm, config: appConfig, now: () => startupNow }).catch(
        (err) => console.error('[daily] catch-up run failed:', err),
      );
    }
  }

  console.log(
    `[daily-learning] notifier=${notifier.name} model=${llm.name} next=every ${appConfig.reminderTime} ${appConfig.timezone}`,
  );
  console.log('[daily-learning] listening for replies… (Ctrl+C to quit)');
}

// Only run when executed directly (node dist/index.js / tsx src/index.ts),
// not when imported by tests.
const isEntry =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isEntry) {
  main().catch((err) => {
    console.error('[daily-learning] fatal:', err);
    process.exit(1);
  });
}