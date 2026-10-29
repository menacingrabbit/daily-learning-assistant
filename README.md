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
| **Google Cloud account** | Only for the 24/7 cloud setup — see [Running it in the cloud](#on-a-server) | free tier |

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

On a server, set `DATA_DIR` in `.env` to a folder outside the checkout (for example
`/var/lib/dla`), so the database does not depend on where the project lives — see
[Running it in the cloud](#on-a-server).

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

<a id="on-a-server"></a>
## ☁️ Running it in the cloud (step by step)

Everything above runs on your own computer, which has to be awake. This section puts the same
container on an always-on Google Cloud VM, so reminders arrive whether your laptop is open or
not — and the database sits on a real disk, so it survives every redeploy. The always-free
`e2-micro` tier costs **$0/month**.

After the one-time setup, your only job is `git push`. GitHub builds a new image, and the
server picks it up within five minutes:

```
GitHub repo ──push to main──► GitHub Actions ──build+push──► Artifact Registry
                                                                   │
                                                        pull (every 5 min)
                                                                   ▼
                                                     Compute Engine VM (e2-micro)
                                                     └─ /var/lib/dla/db.sqlite
```

There is no inbound port, no SSH key stored in CI, and no database server to run.

### Why a VM and not Cloud Run or Vercel

Both were checked, and neither can host this app unchanged:

- **Cloud Run** has no persistent disk. Its writable filesystem is RAM — Google's
  [container contract](https://docs.cloud.google.com/run/docs/container-contract) says *"It is
  an in-memory file system, so writing to it uses the instance's memory"* and *"Data written to
  the file system doesn't persist when the instance stops."* Your history would be wiped on
  every revision deploy. It also expects an HTTP server on `$PORT`; this app is a scheduler plus
  a Telegram long-poll, with nothing to listen on. The only mountable storage is Cloud Storage
  (object storage — no POSIX locking, unsuitable for SQLite) or Filestore/NFS (1 TB minimum,
  ~$200/month).
- **Vercel** functions stop after 300 seconds on Hobby
  ([limits](https://vercel.com/docs/functions/limitations)) — far too short to keep the
  Telegram `getUpdates` poll open.

A VM is the smallest Cloud option that is both free and keeps your history.

---

### 0) Accounts, keys and subscriptions

| What | Needed? | What it costs | Where |
|---|---|---|---|
| **Google Cloud** project with **billing enabled** | Yes — runs the VM and the image registry | $0 inside the free tier (see step 10). A card is required to enable billing. | [console.cloud.google.com](https://console.cloud.google.com) |
| **GitHub** account | Yes — holds the code and runs the build | $0 | [github.com](https://github.com) |
| **OpenRouter** key | Strongly recommended — without it topics come from a small built-in offline list | Free models exist; paid models bill per token | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **Telegram** account + bot | Strongly recommended — without it messages only go to the server log | $0 | [@BotFather](https://t.me/BotFather) |

Nothing else is needed: no domain, no managed database, no paid plan. New Google Cloud accounts
also get a separate $300 / 90-day trial on top of the always-free allowance.

### 1) Fork the repository

The automation builds from **your** GitHub repository, so fork it first:

1. Open [github.com/menacingrabbit/daily-learning-assistant](https://github.com/menacingrabbit/daily-learning-assistant)
   and click **Fork**.
2. Work with your copy from now on: `https://github.com/<your-user>/daily-learning-assistant`.
   Keep the upstream repo as a remote if you want future updates:
   ```bash
   git remote add upstream https://github.com/menacingrabbit/daily-learning-assistant.git
   ```

### 2) Create the Google Cloud project

Install the [gcloud CLI](https://cloud.google.com/sdk/docs/install) locally, or use
[Cloud Shell](https://console.cloud.google.com/cloudshell) in the browser.

```bash
gcloud auth login
gcloud projects create daily-learning-prod --name="Daily Learning"
gcloud config set project daily-learning-prod

# Enable billing: the free tier still requires a billing account on the project.
gcloud billing accounts list
gcloud billing projects link daily-learning-prod \
  --billing-account=XXXXXX-XXXXXX-XXXXXX

gcloud services enable compute.googleapis.com artifactregistry.googleapis.com
```

### 3) Create the VM

```bash
gcloud compute instances create daily-learning \
  --zone=us-west1-b \
  --machine-type=e2-micro \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=10GB \
  --boot-disk-type=pd-standard
```

> ⚠️ **The region matters.** The free `e2-micro` allowance only applies in `us-west1`
> (Oregon), `us-central1` (Iowa) and `us-east1` (South Carolina). Anywhere else the same VM
> bills at about **$6.11/month**. Latency to Telegram is irrelevant — one message a day.

### 4) Prepare the VM

```bash
gcloud compute ssh daily-learning --zone=us-west1-b
```

On the VM:

```bash
# 2 GB swap: the box has 1 GB RAM. Docker and Node fit without it, but swap keeps
# the VM comfortable and avoids surprise OOM kills.
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Docker + git
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git
sudo usermod -aG docker "$USER"
```

Log out and back in (or `newgrp docker`) so the group change applies:

```bash
exit
gcloud compute ssh daily-learning --zone=us-west1-b
docker --version && docker compose version
```

### 5) Create the image registry

Artifact Registry is where GitHub Actions puts the built image. Making the repository **public**
means the VM can pull it with no credentials to manage — and the image contains no secrets
(`.env` and your personal `topics.yaml` are excluded by `.dockerignore`).

```bash
gcloud artifacts repositories create dla \
  --repository-format=docker \
  --location=us-west1 \
  --description="daily-learning images"

gcloud artifacts repositories add-iam-policy-binding dla \
  --location=us-west1 \
  --member=allUsers \
  --role=roles/artifactregistry.reader
```

> If your organisation blocks public repositories, leave the second command out and instead
> authenticate the VM (`sudo gcloud auth configure-docker us-west1-docker.pkg.dev`) after
> granting its service account `roles/artifactregistry.reader`.

### 6) Let GitHub build on every push

Create a service account that GitHub Actions can use to push images:

```bash
gcloud iam service-accounts create github-deploy \
  --display-name="GitHub Actions image push"

gcloud projects add-iam-policy-binding daily-learning-prod \
  --member="serviceAccount:github-deploy@daily-learning-prod.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud iam service-accounts keys create gh-deploy.json \
  --iam-account=github-deploy@daily-learning-prod.iam.gserviceaccount.com
```

In your fork: **Settings → Secrets and variables → Actions**, then add:

| Kind | Name | Value |
|---|---|---|
| Secret | `GCP_SA_KEY` | the entire contents of `gh-deploy.json` |
| Variable | `GCP_PROJECT` | `daily-learning-prod` |
| Variable | `DEPLOY_ENABLED` | `true` |

The variable is what turns the workflow on. It exists so that a clone of the upstream project
(which has no Google Cloud account behind it) skips the job instead of failing on a missing key.

Then delete the key file from your computer (`rm gh-deploy.json`) — GitHub has its copy.

The workflow `.github/workflows/deploy.yml` is already in the repo. It runs on every push to
`main` (and on demand via **Actions → Deploy image → Run workflow**), builds the image, and
pushes both `:<commit-sha>` and `:latest`. Trigger it once now:

```bash
# on your computer — clone your fork if you have not already
git clone https://github.com/<your-user>/daily-learning-assistant.git
cd daily-learning-assistant
git commit --allow-empty -m "Trigger first image build"
git push origin main
```

Watch it in **Actions → Deploy image**. When it is green, the image exists.

### 7) Put the project on the VM and point it at your data

On the VM (`gcloud compute ssh daily-learning --zone=us-west1-b`):

```bash
sudo mkdir -p /opt/daily-learning /var/lib/dla
sudo chown "$USER":"$USER" /opt/daily-learning /var/lib/dla

git clone https://github.com/<your-user>/daily-learning-assistant.git /opt/daily-learning
cd /opt/daily-learning
cp .env.example .env
chmod 600 .env
nano .env
```

`.env` must contain at least:

```bash
# Where the database lives ON THE VM — outside the checkout, so git never touches it.
DATA_DIR=/var/lib/dla

# The image GitHub Actions builds.
IMAGE=us-west1-docker.pkg.dev/daily-learning-prod/dla/daily-learning:latest

OPENROUTER_API_KEY=sk-or-...
TELEGRAM_BOT_TOKEN=123456:ABC-YourTokenHere
TELEGRAM_CHAT_ID=123456789
```

`DATA_DIR` is the whole trick behind lossless deploys: the container always writes to
`/app/data`, and this line decides which host folder that is. Since it is outside the checkout,
a `git pull`, a re-clone, or a container rebuild cannot start you with an empty database.

### 8) Start it

```bash
cd /opt/daily-learning
docker compose pull
docker compose up -d
docker compose logs -f          # Ctrl+C only stops the log view
```

Confirm the database landed where you expect and the app can read it:

```bash
ls -l /var/lib/dla              # db.sqlite, plus -wal/-shm while it runs
docker compose run --rm daily-learning node dist/index.js --list
docker compose run --rm daily-learning node dist/index.js --testrun
```

`config/topics.yaml` is created on first start from the shipped example and is never
overwritten. Edit it to choose your subject, session length, reminder time and timezone.

### 9) Make deploys automatic

A small systemd timer checks the registry every five minutes and restarts the container only
when the image actually changed:

```bash
sudo tee /etc/systemd/system/dla-deploy.service >/dev/null <<'EOF'
[Unit]
Description=Pull the latest daily-learning image and restart the container
Wants=network-online.target
After=network-online.target docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/daily-learning
ExecStart=/bin/sh -c 'docker compose pull && docker compose up -d'
EOF

sudo tee /etc/systemd/system/dla-deploy.timer >/dev/null <<'EOF'
[Unit]
Description=Check for a new daily-learning image every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Unit=dla-deploy.service

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now dla-deploy.timer
systemctl list-timers dla-deploy.timer
```

From now on: **push to `main` → GitHub builds → within five minutes the VM is running the new
version, with the same database.** To check it happened:

```bash
journalctl -u dla-deploy.service -n 30
```

`restart: unless-stopped` in `docker-compose.yml` also brings the container back after a reboot,
so the timer and the app both survive restarts on their own.

### 10) Backups, rollback and running costs

**Backups.** The database is a normal folder on the VM's persistent disk. The hands-off option
is a weekly disk snapshot — pennies at this size:

```bash
gcloud compute resource-policies create snapshot-schedule weekly-backup \
  --region=us-west1 --weekly-schedule=SATURDAY --start-time=03:00 \
  --max-retention-days=28

gcloud compute disks add-resource-policies daily-learning \
  --resource-policies=weekly-backup --zone=us-west1-b
```

For an ad-hoc copy you can keep off the machine — stop the container so the `-wal` file is
folded in, archive the folder, then start it again:

```bash
# on the VM
cd /opt/daily-learning
docker compose stop
sudo tar czf /tmp/dla.tgz -C /var/lib/dla .
sudo chown "$USER" /tmp/dla.tgz
docker compose start
```

```bash
# on your computer
gcloud compute scp daily-learning:/tmp/dla.tgz . --zone=us-west1-b
```

To restore: stop the container, unpack the archive back into `/var/lib/dla`, start it again.
The `-wal` and `-shm` files belong to the database — keep them together.

**Rollback.** Every image is also tagged with its commit SHA. To pin a known-good version, set
`IMAGE=…/daily-learning:<sha>` in `.env` and run `docker compose up -d`; remove the pin to
return to `:latest`.

**Costs.**

| Item | Free allowance | This app | Cost |
|---|---|---|---|
| `e2-micro`, 24/7 | every hour of the month, one instance, in the three US regions | 744 h | **$0** |
| 10 GB standard disk | 30 GB-months | 10 GB | **$0** |
| Outbound traffic | 1 GB/month from North America | a few MB | **$0** |
| Weekly snapshots | not free, $0.026/GB-month | well under 1 GB | **~$0.00** |

Billed as soon as you leave the free tier: a second instance (~$6.11/mo), a different region
(same), a disk over 30 GB, or a reserved but unattached static IP (~$3.65/mo).

**Security.** Nothing to open. The VM makes outbound connections only — to OpenRouter and
Telegram — so there is no inbound firewall rule and no exposed port.

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
| `docker compose pull` says the image wasn't found (server) | No image exists yet — run **Actions → Deploy image → Run workflow** in your fork, wait for green, then pull again |
| Pushed to `main` but the VM still runs the old version | The timer checks every 5 minutes: `systemctl list-timers dla-deploy.timer`, then `journalctl -u dla-deploy.service -n 30` |
| Database empty after a deploy (server) | `DATA_DIR` is unset or points elsewhere — `docker compose config \| grep /app/data` shows the host path actually in use |
| Unexpected Google Cloud charge | The instance is outside `us-west1`/`us-central1`/`us-east1`, or it is a second instance on the same billing account |
| `permission denied` when running `docker` on the VM | `newgrp docker`, or log out and back in after `usermod -aG docker` |

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