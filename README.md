# Daily Learning Assistant

**A friendly agent that helps you learn a little every day — it picks the topic, reminds you, and checks in afterwards.**

Each morning it sends you one concrete learning topic, sized to the time you have. The next day, it asks a short recap question before moving on — so the topic actually sticks. Everything you cover is kept in a small local database, so it never suggests the same thing twice.

> 🎓 Learn any subject. It ships set up for *software architecture & engineering*, but one line in a config file changes it to history, data science, cooking, or anything else.

---

## What a day looks like

**Morning (08:00, your time)**

> 📚 Today's topic: **"Cache invalidation strategies — and how Redis handles them"**
>
> Learn how the three classic invalidation strategies work — write-through, write-behind and
> TTL expiry — when each one wins, and why TTL-based expiry stays the most common choice in
> practice. Read one solid explainer, then compare it against how Redis documents the approach.
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
| **Docker Desktop** | Yes — the easy path. Nothing else required. | 5 min, one-time download |
| **OpenRouter API key** | Optional — without it you get built-in offline topics | 2 min, free tier |
| **Telegram bot + chat id** | Optional — without them messages print in your terminal | 3 min via BotFather |
| **Node.js ≥ 24** | Only for contributors running the code directly | — |

> 💡 **No credentials? No problem.** Without Telegram/API keys the app runs in **dry-run mode**: messages print to your terminal and you can answer recaps by typing. Perfect for a safe first spin.

---

## 🚀 Quick start (no Node needed)

**What is Docker?** Docker runs this app inside a sealed box on your computer. You install
Docker once, and then never install Node, npm, or any library again. The app's own files still
live in normal folders on your computer (see [Where your stuff lives](#where-your-stuff-lives)),
so nothing is hidden away.

### 1) Install Docker Desktop (one-time, ~5 minutes)

- **macOS** — [Download for Mac](https://www.docker.com/products/docker-desktop). Pick
  **Apple silicon** for M1/M2/M3/M4, or **Intel chip** (check via *About This Mac* in the
  Apple menu). Open the `.dmg`, drag Docker to Applications, launch it.
- **Windows 10/11** — [Download for Windows](https://www.docker.com/products/docker-desktop),
  run the installer, accept the **WSL 2** prompt, restart when asked.
- **Linux** — Docker Engine plus the Compose plugin:
  ```bash
  sudo apt-get update && sudo apt-get install docker.io docker-compose-v2
  sudo usermod -aG docker $USER   # then log out and back in
  ```

### 2) Start Docker and check it works

Docker Desktop must be **running** — look for the whale icon in your menu bar or system tray.
It does not always start automatically after a reboot.

```bash
docker --version
docker compose version
```

Both must print a version. Note the space: `docker compose`, not the old `docker-compose`.

> "Cannot connect to the Docker daemon" means Docker Desktop isn't running yet. Start it and
> wait for the whale icon to stop animating.

### 3) Get the project

```bash
git clone https://github.com/menacingrabbit/daily-learning-assistant.git
cd daily-learning-assistant
```

No Git? Download the ZIP from the repo page, unzip it, and open a terminal in that folder.

### 4) Build the box (first time only, 2–5 minutes)

```bash
docker compose build
```

### 5) See it work right now

```bash
docker compose run --rm daily-learning node dist/index.js --once
```

This runs one full "day" of the assistant. You should see something like:

```
[docker-entrypoint] No /app/config/topics.yaml yet - creating it from the shipped example.

--- [console out] ---
📚 Today's topic: **Read one good explainer end to end**

Find a solid article, chapter or talk on a topic in the subject...
--- [console end] ---
```

No API key and no Telegram were needed — the app used its built-in offline topics and printed
to your terminal. A database was created at `data/db.sqlite`. Run it again, or use `--list` to
see what it has suggested so far.

### 6) Start the daily loop

```bash
docker compose up
```

```
daily-learning | [daily-learning] notifier=console model=fallback next=every 08:00 Europe/Berlin
daily-learning | [daily-learning] listening for replies… (Ctrl+C to quit)
```

It now waits for 08:00 in the timezone set in `config/topics.yaml`. **Nothing else visible
happens until then — that is normal, not broken.** Press `Ctrl+C` to stop.

There is **nothing to open in a browser**: no web page, no port. The output is the terminal,
and later Telegram.

Prefer it in the background? `docker compose up -d`, then watch with `docker compose logs -f`
(`Ctrl+C` there only stops the log view, not the app).

<a id="where-your-stuff-lives"></a>
### 7) Where your stuff lives

The box is disposable; two folders on **your** computer are linked into it:

| Folder | What it holds |
|---|---|
| `./config` | What you want to learn. `topics.yaml` was created for you on first run. |
| `./data` | What you have already learned — `db.sqlite` (plus `-wal`/`-shm` files while it runs). |

You can rebuild or update the box at any time and these folders are untouched. **To back up,
stop the container (`docker compose stop`) and copy the whole `data/` folder** — the `-wal`
and `-shm` files are part of the database.

### 8) Make it yours (optional)

```bash
cp .env.example .env
```

Open `.env` in any text editor and fill in the steps from
[Make it a real daily ritual](#-make-it-a-real-daily-ritual-optional-but-recommended) below.
Without it you stay in dry-run mode, which is fine.

Apply the change with `docker compose up` (or `docker compose restart` if it ran in the
background). **No rebuild needed** — environment is read at container start.

### 9) Updating later

```bash
git pull
docker compose build
docker compose up -d
```

### Windows / PowerShell

The same commands work. Two differences: `cp` is `Copy-Item` in PowerShell (or `copy` in CMD),
and paths containing spaces need quotes. Edit `.env` in VS Code or Notepad to avoid stray
characters.

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
docker compose up            # runs until you stop it (Ctrl+C)
# or in the background:
docker compose up -d && docker compose logs -f
```

Now the bot messages you each morning, and your recaps arrive as long as the container runs.
That means your computer must be awake and Docker Desktop running — a sleeping laptop sends
nothing. The container only makes outbound connections, so you never need to open a port.

If the service was *not* running when `reminder_time` came around (a restart, an update, a
laptop that was asleep), it catches up on the next start: when the service starts after
`reminder_time` and today's topic was never sent, it sends it straight away instead of
waiting for tomorrow. Restarting later the same day after the topic already went out does
nothing extra.

---

## 🐋 Docker reference

One-shot commands (the container's `CMD` is overridden, the entrypoint still runs):

```bash
docker compose run --rm daily-learning node dist/index.js --once     # one full day, real DB
docker compose run --rm daily-learning node dist/index.js --testrun  # throwaway DB
docker compose run --rm daily-learning node dist/index.js --list     # recent topics
```

> ⚠️ `--testrun` uses a temporary database, but it is **not** notification-isolated: if
> Telegram credentials are set, it still sends a real message.

Useful container commands:

```bash
docker compose logs -f        # follow output
docker compose restart        # after editing .env
docker compose stop           # stop, keep everything
docker compose down           # remove the container (./config and ./data are kept)
```

`config/topics.yaml` is created from the shipped example on first run and is **never
overwritten** afterwards — edit it freely. If you delete it, the next start recreates it with
the defaults. To make `./config` read-only (`:ro` in `docker-compose.yml`), create
`topics.yaml` first.

---

## 🧑‍💻 Running it directly with Node (contributors)

Only needed if you want to change the code. If you just want to use it, the Docker quick start
above is all you need.

```bash
# Node.js ≥ 24 — https://nodejs.org/en/download (macOS/Linux: nvm install 24)
npm ci --ignore-scripts
cp .env.example .env                               # API keys go here
cp config/topics.example.yaml config/topics.yaml   # what you want to learn
npm run once                                       # one full day, right now
```

> **Why `--ignore-scripts`?** `better-sqlite3` ships prebuilt binaries, but also carries an
> implicit `node-gyp rebuild` install script that compiles from source. Without a C++ toolchain
> and Python that build fails — which is exactly what happened in Docker. Skipping install
> scripts uses the prebuilt binary instead.

> `.env` stays private (it's in `.gitignore`). Be careful: **never commit your real keys.**

`npm run start` runs the scheduler until Ctrl+C; `npm run dev` adds auto-reload on code
changes.

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
| `Cannot connect to the Docker daemon` | Docker Desktop isn't running — start it, wait for the whale icon, retry |
| `docker compose` not found but `docker-compose` works | Old Compose. Update Docker Desktop, or use `docker-compose` consistently |
| Container starts and immediately restarts | Startup errors are only in the logs: `docker compose logs --tail=50` |
| Edited `.env` but nothing changed | Restart the container — env is read at start: `docker compose up` |
| `config/` or `data/` owned by root (Linux) | `sudo chown -R $USER:$USER config data` |
| `Config file not found` | `config/topics.yaml` is missing. Create it: `cp config/topics.example.yaml config/topics.yaml` |
| Dry-run shows generic "offline" topics | No `OPENROUTER_API_KEY` — add it to `.env`, restart |
| `npm install` fails in `better-sqlite3` with `gyp ERR! find Python` | Use `npm ci --ignore-scripts` — the prebuilt binary needs no compiler |
| Bot created but no messages arrive | Check `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` both present & correct; chat id is numeric |
| Wrong reminder clock | Check `timezone` matches where you live (IANA names like `Europe/Berlin`) |
| "model not found" from OpenRouter | The `MODEL` you set doesn't exist — see [OpenRouter model list](https://openrouter.ai/models) |
| You want an early test without waiting | Run one full day cycle immediately — see [Commands reference](#commands-reference) |

---

## Commands reference

| What you want | Docker | With Node |
|---|---|---|
| run the daily scheduler | `docker compose up` | `npm run start` |
| run one day now | `docker compose run --rm daily-learning node dist/index.js --once` | `npm run once` |
| test without touching history | `… node dist/index.js --testrun` | `npm run testrun` |
| list recent topics | `… node dist/index.js --list` | `npm run list` |
| auto-reload while coding | — | `npm run dev` |
| run the tests | — | `npm test` / `npm run typecheck` |

Any command can point at a different config file:

```bash
docker compose run --rm daily-learning node dist/index.js --once --config=/app/config/other.yaml
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