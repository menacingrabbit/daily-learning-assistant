import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cron from 'node-cron';
import { FallbackLlm } from './agent/fallback.js';
import { OpenRouterLlm } from './agent/llm.js';
import { runDaily } from './agent/loop.js';
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
export function createServices(options: { configPath?: string } = {}): Services {
  const { app: config, env: runtime } = loadConfig({ configPath: options.configPath });
  mkdirSync(dirname(runtime.dbPath), { recursive: true });

  const store = new Store(runtime.dbPath);
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

export function parseCliArgs(argv: string[]): { once: boolean; config?: string } {
  let once = false;
  let config: string | undefined;
  for (const arg of argv.slice(2)) {
    if (arg === '--once') once = true;
    else if (arg.startsWith('--config=')) config = arg.slice('--config='.length);
    else if (arg === '--config') {
      const idx = argv.indexOf(arg);
      const next = argv[idx + 1];
      if (next) config = next;
    }
  }
  return { once, config };
}

async function main(): Promise<void> {
  const { once, config } = parseCliArgs(process.argv);
  const svc = createServices({ configPath: config });
  const llm = buildLlm(svc.runtime);
  const { store, notifier, config: appConfig } = svc;

  if (appConfig.checkinStyle === 'spaced_review') {
    console.warn(
      '[daily-learning] checkin_style=spaced_review is not implemented yet; using confirm_only behavior.',
    );
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