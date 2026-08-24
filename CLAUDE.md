# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status: greenfield — no code yet

This repo currently contains only planning artifacts. There is **no `src/`, `package.json`, or build setup yet**. The authoritative design is `PLAN.md` — read it before building anything, and treat it as the source of truth for architecture and config decisions. `README.md` is currently just a title.

This CLAUDE.md records the *planned* architecture and run paths so work aligns with the plan; the concrete build/lint/test commands below do **not exist until they are implemented**.

## What this project is

A self-hostable agent that builds a daily learning habit. It reminds the user daily via a notification channel, checks whether the previous day's topic was engaged with, and offers a new topic sized to a configurable session length (default 30–45 min). Public on GitHub, MIT-licensed, runnable via Docker or plain npm.

## Planned tech stack

- **Language/runtime:** TypeScript / Node.js
- **Agent orchestration:** Vercel AI SDK (`ai`), lightweight tool-calling, no heavy framework
- **Model access:** OpenRouter via `@openrouter/ai-sdk-provider` (bring-your-own key; no single hardcoded provider/model)
- **Scheduling:** `node-cron` in-process (no external cron/n8n)
- **Persistence:** SQLite single file via `better-sqlite3`
- **Notification:** Telegram Bot API (2-min BotFather setup), behind a `Notifier` interface
- **Packaging:** Docker (`docker-compose.yml`) + plain npm scripts; both documented in README

## Planned architecture

Files under `src/`, matching the plan:

- `src/index.ts` — entrypoint; scheduler triggers the daily loop
- `src/agent/loop.ts` — core daily-run logic; `tools.ts` — Vercel AI SDK tool defs (`generateTopic`, `checkRecap`); `prompts.ts` — system prompts parameterized by config
- `src/notify/notifier.ts` — `send(msg)` / `receive(handler)` interface; `telegram.ts` — reference implementation
- `src/db/schema.ts` — `sessions` table (date, topic, recap_answer, status); `store.ts` — SQLite read/write helpers
- `src/config.ts` — loads and validates `topics.yaml` and `.env`

**Core loop (`loop.ts`):** load yesterday's session → if recap pending/unanswered, re-send it instead of advancing; else call the model with tools (acknowledge/grade recap, then `generateTopic` scoped by config + recent-topic history to avoid repeats) → write a new session row → `notifier.send()`. A separate `notifier.receive()` path captures the user's reply as the recap answer.

## Design invariants (do not break these)

- **Fully config-driven** — subject area, difficulty, session length, reminder time, and check-in style live in a user-editable `topics.yaml` (default `config/topics.example.yaml`), never hardcoded in code.
- **Pluggable notification** — all channels go through the `Notifier` interface; Telegram is the only implementation for v1.
- **No provider/model hardcoding** — model selection goes through OpenRouter, configured per-user via `.env` (`OPENROUTER_API_KEY`, `MODEL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`).
- **Local history only** — repeat-avoidance and memory come from the local SQLite `sessions` table, not external state.

## Planned run paths (document both in README once implemented)

- **Docker:** `docker compose up` with a filled-in `.env`
- **Local Node:** `npm install`, copy `.env.example` → `.env`, `npm run start` (optionally `npm run dev` with a watcher)

## Out of scope for v1

Web dashboard/UI (v2), multi-user/hosted SaaS, notification channels beyond Telegram (structure for pluggability only), spaced-repetition beyond the basic recap check-in.