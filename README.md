# Daily Learning Assistant

**A friendly agent that helps you learn a little every day — it picks the topic, reminds you, and checks in afterwards.**

Each morning it sends you one concrete learning topic, sized to the time you have. The next day, it asks a short recap question before moving on — so the topic actually sticks. Everything you cover is kept in a small local database, so it never suggests the same thing twice.

> 🎓 Learn any subject. It ships set up for *software architecture & engineering*, but one line in a config file changes it to history, data science, cooking, or anything else.

---

## What a day looks like

**Morning (08:00, your time)**

> 📚 Today's topic: **"Cache invalidation strategies — and how Redis handles them"**
>
> Learn the three classic invalidation strategies and when each wins. Build a small demo that
> evicts a cached value on write, then read on why TTL-based expiry is the most common choice.
>
> ⏱ ~30 min · Resources: link-to-a-good-post, docs

**The next day** — before a new topic:

> 💬 Recap check: *"Yesterday's topic was 'Cache invalidation…'. Reply with a short recap of what you learned."*
>
> 👉 You reply in a few sentences. The assistant reads it, gives short feedback, and only then sends today's new topic.

If you never replied, it re-sends the recap instead of skipping ahead — no mountains of unlearned topics piling up.

---

## Should I use this?

Checklist — this project fits you if:

- You want to actually study a subject **regularly** with a small daily commitment.
- You like having the topic *chosen and sized for you* rather than choosing yourself at a moment of decision fatigue
- You're okay running a small self-hosted bot (a few minutes of setup, once).
- You don't mind a text message being your study coach.

It's **not** a video-course platform, a quiz app, or a cloud subscription. It's a small, friendly agent on your own machine (or server).

---

## What you'll need

| Thing | Do you need it? | Effort |
|---|---|---|
| **Node.js ≥ 24** (or Docker) | Yes — to run the app | 2 min |
| **OpenRouter API key** | Optional for trying out — required for real AI topics | 2 min, free tier |
| **Telegram bot + chat id** | Optional → dry-run mode shows messages in the terminal | 3 min via BotFather |

> 💡 **No credentials? No problem.** Without Telegram/API keys the app runs in **dry-run mode**: messages print to your terminal and you can answer recaps by typing. Perfect for a safe first spin.

---

## 🚀 Get started (about 5 minutes)

### 1) Install Node & clone the project

```bash
# macOS / Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 24

# Windows — grab the installer from https://nodejs.org/en/download
```

Then download this repo:

```bash
git clone https://github.com/<you>/daily-learning-assistant.git
cd daily-learning-assistant
```

### 2) Install dependencies

```bash
npm install
```

### 3) Create your two config files from the examples

```bash
cp .env.example .env                    # API keys go here
cp config/topics.example.yaml config/topics.yaml   # what you want to learn
```

> `.env` stays private (it's in `.gitignore`). Be careful: **never commit your real keys.**

### 4) Try it — run one full day right now

```bash
npm run once
```

You'll see something like:

```
📚 Today's topic: **Teach the current topic out loud** …
```

Running in dry-run mode (no Telegram configured yet) the message prints to the terminal. A tiny database is created at `data/db.sqlite` to remember your sessions. The topic you just saw is your first day's lesson.

> **Just want to test the trigger without touching your real history?** Use the isolated test mode:
>
> ```bash
> npm run testrun
> ```
>
> It fires the exact same daily loop the scheduler runs, but against a throwaway database — nothing is written to `data/db.sqlite`, and the result (the suggested topic) prints to the terminal.

---

## ✨ Make it a real daily ritual (optional but recommended)

Two more setup steps and the bot messages arrive on your phone:

### A. Telegram bot (2 minutes)

1. Open [@BotFather](https://t.me/BotFather), send `/newbot`, follow the prompts, and copy your **bot token**.
2. Paste it into `.env`:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC-YourTokenHere
   ```
3. Send your bot any message (e.g. `hi`), then open this URL in a browser (put in your token) to find your **chat id**:
   ```
   https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
   ```
   You'll see a number like `"chat": {"id": 123 456 789}` — paste that too:
   ```
   TELEGRAM_CHAT_ID=123456789
   ```

### B. Add your OpenRouter key (free tier works)

1. Create a key at [openrouter.ai/keys](https://openrouter.ai/keys).
2. Add it to `.env`:
   ```
   OPENROUTER_API_KEY=sk-or-...
   ```
   Optionally change `MODEL` (default `anthropic/claude-sonnet-4.6`).

### C. Choose what you want to learn

Edit `config/topics.yaml`:

```yaml
subject: "software architecture & engineering"  # anything you like
session_length_minutes: 30                     # how long you want per day
difficulty: intermediate                        # easy | intermediate | advanced
reminder_time: "08:00"                          # when the bot messages you
timezone: Europe/Berlin                         # IANA timezone for reminder_time

# Optional — preferred language/tools for hands-on topics. Omit it and the
# model picks whatever fits; the subject doesn't have to be technical.
# stack: "TypeScript/Node"
```

### D. Start it

```bash
npm run start        # runs until you stop it (Ctrl+C)
# or during development:
npm run dev          # with auto-reload on code changes
```

Now the bot messages you each morning, and your recaps arrive as long as you run it.

---

## 🐋 Prefer Docker?

```bash
cp .env.example .env
cp config/topics.example.yaml config/topics.yaml
docker compose up -d
```

The container mounts `./config` and `./data`, so your config and history survive any update. Update later with `docker compose pull && docker compose up -d`.

---

## 🤔 How does it actually work?

It's deliberately small and boring — no database to provision, no cloud:

```
Node.js scheduler (node-cron)   →   on your schedule, runs the daily loop:
   1. Load yesterday's session from SQLite        (local data/db.sqlite)
   2. Pending recap not answered?  →  send the recap again (no new topic)
   3. Recap answered?             →  grade it, give feedback
   4. Ask the model (OpenRouter) for today's topic, avoiding repeats
   5. Save the day's session, send the topic via Telegram
   ↪ Your reply in chat is recorded as that day's recap answer
```

- **Persistence:** a single SQLite file. Your whole history lives in `data/db.sqlite` — no external DB to install.
- **Model:** any OpenRouter model (OpenAI, Anthropic, Gemini…) — you pick, key is yours.
- **Channel:** Telegram out of the box; the pluggable `Notifier` interface means Discord/Slack/email are simple follow-ups.

---

## 🛟 Troubleshooting

| Symptom | Fix |
|---|---|
| `npm run once` prints "Config file not found" | You forgot step 3 — copy `config/topics.example.yaml` → `config/topics.yaml` |
| You get no topic — dry-run shows generic "offline" topics in terminal | No `OPENROUTER_API_KEY` in `.env` — add it, restart |
| Bot created but no messages arrive | Check `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` both present & correct; chat id is numeric |
| Wrong reminder clock | Check `timezone` matches where you live (IANA names like `Europe/Berlin`) |
| "model not found" from OpenRouter | The `MODEL` you set doesn't exist — see [OpenRouter model list](https://openrouter.ai/models) |
| You want an early test without waiting | Run `npm run once` anytime — it runs one full day cycle immediately |

---

## Commands reference

```bash
npm run start        # run the daily scheduler + Telegram polling
npm run once         # run one full day cycle immediately and exit
npm run testrun      # simulate the daily trigger against an isolated temp DB (real history untouched)
npm run dev          # same as start, but auto-reload on code changes
npm test             # run the test suite (vitest)
npm run typecheck    # type-check the code (tsc --noEmit)
npm run list         # admin view: most recent suggested topics (date, title, minutes, truncated summary)

# Any command can point at a different config file:
npm run once -- --config=path/to/topics.yaml
```

## Project layout (for contributors)

```
src/
  index.ts        # wiring: config, DB, notifier, scheduler
  agent/          # the daily loop, prompts, and the AI tools
  notify/         # Notifier interface + Telegram/Console implementations
  config.ts       # loads & validates topics.yaml + .env
  db/             # SQLite schema + store
tests/            # unit tests (vitest)
```

---

## License

MIT — see [LICENSE](LICENSE). Build on it, fork it, teach your own subject.