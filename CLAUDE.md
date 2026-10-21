# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status: implemented — v1 is working

This is a fully built, testable project (not greenfield). `PLAN.md` is the design source of truth,
but where code and plan diverge the code wins — update this file and/or `PLAN.md` when you change
behavior. Everything below is real and runnable.

## What this project is

A self-hostable agent that builds a daily learning habit. It reminds the user daily via a
notification channel, checks whether the previous day's topic was engaged with, and offers a new
topic sized to a configurable session length (default 30 minutes). Public on GitHub, MIT-licensed,
runnable via Docker or plain npm.

## Tech stack (implemented)

- **Language/runtime:** TypeScript / Node.js ≥ 24, ESM (`"type": "module"`), run with `tsx`.
- **Agent orchestration:** Vercel AI SDK (`ai` v7) tool-calling for structured output
  (`generateTopic`, `checkRecap` in `src/agent/tools.ts`).
- **Model access:** OpenRouter via `@openrouter/ai-sdk-provider` (bring-your-own key).
- **Scheduling:** `node-cron` in-process, timezone-aware, `noOverlap: true`.
- **Persistence:** single SQLite file via `better-sqlite3` (WAL mode).
- **Notification:** `Notifier` interface; Telegram (`getUpdates` long-polling) + Console (dry-run)
  implementations.
- **Config/validation:** `yaml` for the topics config, `zod` for all schema validation.
- **Packaging:** Docker (`docker-compose.yml`) + plain npm scripts.

## Project layout (implemented)

```
src/
  index.ts          # entrypoint + CLI: createServices, buildLlm, parseCliArgs, main()
                      (scheduler, --once, --testrun, --list, --config=<path>)
  config.ts         # loadConfig(): loads + validates topics.yaml; picks up .env next to it
  agent/
    loop.ts         # runDaily() — the core daily loop; LoopDeps (DI), LoopOutcome
    llm.ts          # Llm interface + OpenRouterLlm (real model calls)
    fallback.ts     # FallbackLlm — offline seed topics (no OPENROUTER_API_KEY needed)
    prompts.ts      # systemPrompt, topicPrompt, recapCheckPrompt, message formatters
    tools.ts        # AI SDK tool defs + zod schemas (TopicResult, RecapResult)
  notify/
    notifier.ts     # Notifier interface (send, startListening, stop, name)
    telegram.ts     # TelegramNotifier (sendMessage / getUpdates long-polling)
    console.ts      # ConsoleNotifier — dry-run: prints output, reads replies from stdin
  db/
    schema.ts       # sessions table DDL
    store.ts        # Store: save/get sessions, recap state, recentTitles, inMemory()
tests/              # vitest unit tests (config, loop, store, index)
```

**Core loop (`src/agent/loop.ts`, `runDaily`)**: load the previous session → if a recap is pending
and unanswered, re-send it instead of advancing → else (recap_question style) grade yesterday's
recap → generate a topic scoped by config + recent-topic history → persist a new session row →
`notifier.send()`. `runDaily` takes `LoopDeps` (store, notifier, llm, config + optional `now`/`tag`),
so tests inject fakes.

## Config

`config/topics.yaml` (user-editable; copy from `config/topics.example.yaml`):

```yaml
subject: "software architecture & engineering"
session_length_minutes: 30
difficulty: intermediate                    # easy | intermediate | advanced
checkin_style: recap_question               # recap_question | confirm_only | spaced_review (not implemented)
reminder_time: "08:00"
timezone: Europe/Berlin
```

`.env` (next to the config file or in the project root; never commit real keys):
`OPENROUTER_API_KEY`, `MODEL` (default `anthropic/claude-sonnet-4.6`), `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_CHAT_ID`, `DB_PATH` (default `data/db.sqlite`).

Absent credentials degrade gracefully: no OpenRouter key → `FallbackLlm` (offline seed topics); no
Telegram token/chat id → `ConsoleNotifier` (dry-run, replies from stdin).

## Run paths

| Command | What it does |
|---|---|
| `npm run start` | run the scheduler + Telegram polling until Ctrl+C |
| `npm run dev` | same as start, auto-reload on code changes (`tsx watch`) |
| `npm run once` | run one full day cycle immediately against the **real** DB, then exit |
| `npm run testrun` | simulate the daily trigger against an **isolated temp DB** (real history untouched), print result, exit |
| `npm run list` | print the most recent suggested topics (`--list`): date, title, minutes, truncated summary |
| `npm test` | vitest unit tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | `tsc -p tsconfig.build.json` → `dist/` |
| `docker compose up` | containerized run (mounts `./config` and `./data`) |

CLI flags: `--once`, `--testrun`, `--list`, `--config=<path>` (or `--config <path>`).

## Design invariants (do not break these)

- **Fully config-driven** — subject, difficulty, session length, reminder time, check-in style live
  in `topics.yaml`, never hardcoded.
- **Pluggable notification** — all channels go through `Notifier`; Telegram and Console are the v1
  implementations.
- **No provider/model hardcoding** — model selection via OpenRouter, configured per-user (`.env`).
- **Local history only** — repeat-avoidance and memory come from the local SQLite `sessions` table.
- **Offline-friendly** — the app must run end-to-end without credentials (fallback topics + console
  notifier) so it's testable/dry-runnable anywhere.

## Testing notes

- `Store.inMemory()` gives a throwaway SQLite backing store for tests.
- `runDaily` is exercised directly with fake `Notifier`/`Llm` in `tests/loop.test.ts`.
- `--testrun` uses a temp DB and never writes to `data/db.sqlite`; keep it that way when you touch
  it (it also cleans up after itself).
- `parseCliArgs`, `cronExpression` and `createServices` are unit-tested in `tests/index.test.ts`
  (including the `dbPath` override used by `--testrun`).

## Out of scope for v1 (do not build without discussion)

Web dashboard/UI (v2), multi-user/hosted SaaS, notification channels beyond Telegram/Console
(structure for pluggability only), spaced-repetition beyond the basic recap check-in (`spaced_review`
currently warns and falls back to `confirm_only`).
