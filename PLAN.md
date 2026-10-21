# Daily Learning Agent — Project Plan

## Overview
An open-source, self-hostable agent that helps the user build a daily learning
habit (primarily software development / engineering / architecture topics,
but fully configurable for any subject). It reminds the user daily, checks
whether the previous day's topic was actually engaged with, and offers a new
topic sized to a configurable session length (default 30-45 minutes).

The project must be:
- Publicly shareable on GitHub, MIT-licensed
- Runnable by anyone via `docker compose up` OR plain `npm install && npm start`
- Fully config-driven (no hardcoded subject area, model, or notification
  channel specifics) so others can fork and adapt it to their own domain

## Core Features
1. **Daily reminder** — sends a new learning topic each day via Telegram,
   sized to the configured session length.
2. **Recap check-in** — before offering a new topic, checks whether
   yesterday's topic was engaged with via a short recap question answered
   back in chat. If unanswered, re-send the pending recap instead of
   skipping ahead to a new topic.
3. **Topic generation** — LLM-generated, scoped by config (subject area,
   difficulty, session length), avoiding repeats using local history.
4. **Session history** — every topic + recap outcome is logged locally so
   the agent has memory of what's already been covered.
5. **Config-driven subject area** — subject, difficulty, session length,
   and check-in style all live in a user-editable config file, not code.
6. **Pluggable notification channel** — a small `Notifier` interface with
   Telegram as the reference implementation; Discord/Slack/email can be
   added later without touching core agent logic.
7. **Pluggable model choice via OpenRouter** — model selection happens
   through OpenRouter (not a single hardcoded provider/model), configurable
   per user via `.env`, so adopters can pick their own cost/quality
   tradeoff.

## Tech Stack
| Layer | Choice | Notes |
|---|---|---|
| Language/runtime | TypeScript / Node.js | |
| Agent orchestration | Vercel AI SDK | lightweight tool-calling, no heavy framework |
| Model access | OpenRouter API | via `@openrouter/ai-sdk-provider`; bring-your-own key |
| Scheduling | `node-cron` (in-process) | no external cron/n8n dependency |
| Persistence | SQLite (single file) | e.g. `better-sqlite3`; zero-config, no DB to provision |
| Notification | Telegram Bot API | 2-minute setup via BotFather for any adopter |
| Packaging | Docker + `docker-compose.yml`, plus plain `npm` scripts | both run paths documented |
| Distribution | GitHub repo, MIT license, `.env.example` + `topics.example.yaml` | clone → configure → run |

## Repo Structure
```
daily-learn-agent/
├── src/
│   ├── agent/
│   │   ├── tools.ts        # generateTopic, checkRecap tool defs (AI SDK)
│   │   ├── loop.ts         # core daily run logic
│   │   └── prompts.ts      # system prompt templates, parameterized by config
│   ├── notify/
│   │   ├── notifier.ts     # interface: send(msg), receive(handler)
│   │   └── telegram.ts     # reference implementation
│   ├── db/
│   │   ├── schema.ts       # sessions table: date, topic, recap_answer, status
│   │   └── store.ts        # SQLite read/write helpers
│   ├── config.ts           # loads + validates topics.yaml / .env
│   └── index.ts            # entrypoint: scheduler triggers loop.ts daily
├── config/
│   └── topics.example.yaml
├── .env.example             # OPENROUTER_API_KEY, MODEL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
├── Dockerfile
├── docker-compose.yml
├── README.md
└── LICENSE                  # MIT
```

## Config Schema (`topics.example.yaml`)
```yaml
subject: "software architecture & engineering"
session_length_minutes: 30
difficulty: "intermediate"
stack: "TypeScript/Node"          # optional: preferred language/tools for hands-on work
checkin_style: "recap_question"   # options: recap_question | confirm_only | spaced_review
reminder_time: "08:00"
timezone: "Europe/Berlin"
```

## `.env.example`
```
OPENROUTER_API_KEY=
MODEL=anthropic/claude-sonnet-4.6
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

## Core Agent Loop (`loop.ts`, conceptual)
1. Load yesterday's session row from SQLite (topic, whether recap was answered).
2. If a recap is pending and unanswered → re-send it instead of moving on.
3. If answered → call the model with tools: acknowledge/grade the recap,
   then `generateTopic` for today, scoped by config (subject, difficulty,
   minutes available, recent topics to avoid repeats).
4. Write a new session row (`date`, `topic`, `status: pending`).
5. `notifier.send()` the topic plus a short rationale.
6. Separately: `notifier.receive()` handler listens for the user's reply
   (Telegram polling or webhook) and writes it as that date's recap answer.

## Tool Definitions (Vercel AI SDK `tool()` calls)
- `generateTopic({ subject, difficulty, minutesAvailable, recentTopics })`
  → `{ title, summary, resources[], estimatedMinutes }`
- `checkRecap({ topic, userAnswer })`
  → `{ understood: boolean, feedback: string }`
- DB writes (`logResult`) can be plain function calls rather than model
  tools — implementer's discretion.

## Run Paths (both must be documented in README)
- **Docker:** `docker compose up` with a filled-in `.env`
- **Node.js locally:** `npm install`, copy `.env.example` → `.env`,
  `npm run start` (optionally `npm run dev` with a watcher)

## Out of Scope (for v1)
- Web dashboard / visual UI (potential v2)
- Multi-user / hosted SaaS mode (this is self-hosted, single-user per instance)
- Notification channels beyond Telegram (structure for pluggability, but
  only implement Telegram initially)
- Spaced-repetition scheduling beyond the basic recap check-in (potential
  future `checkin_style` option)

## Deferred / later (low priority)
- **Exercise recap grading end-to-end.** `--testrun` always uses a fresh temp
  DB, so it never has a pending recap and `checkRecap` is never exercised by
  it — the most complex model call has no real-world coverage today. Revisit
  with either a `--testrun-recap` style flag that seeds a pending session, or
  a dedicated manual check in the README. Not urgent: the unit tests cover the
  loop's grading branch with a fake `Llm`.
