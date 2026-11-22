<h1 align="center">Dr Duit</h1>

<p align="center"><b>Personal Wealth & Finance Management with AI Assistant (Uzi)</b></p>

**A self-hosted personal finance platform.** A real multi-currency ledger, budgets, and
investments — plus an AI assistant (Uzi) that can read and help manage them.
Self-hosted, on a machine or VPS you control.

|  | Chatbot bolted onto an app | Dr Duit Agent Harness |
|---|---|---|
| What the AI touches | a summary of your data | the ledger itself, through real write tools |
| When it's wrong | you find out later | a confirm card shows the change before it lands |
| What it can do | answer | act, on a schedule, unattended if you allow it |
| Extending it | wait for the vendor | connect an MCP server and it gains tools |

Every tool carries a permission level — `always_allow`, `needs_approval` (the default), or
`blocked` — enforced at dispatch for every tool in the app.

Nothing leaves your machine except the calls you explicitly configure (an AI provider, a price
feed, an optional connector), and there is no telemetry.
The one exception is a problem report you choose to send: you read it first, and it goes only when
you press Send.

## Compared with Claude and ChatGPT Personal Finance

|  | Claude Personal Finance | ChatGPT Personal Finance | Open Net Worth |
|---|---|---|---|
| **Can it act?** | No, it reads your accounts | No, it can't change your accounts | Yes: books transactions, runs your budget, places trades through your broker (approval by default) |
| **Comes to you first** | No, it waits for you to ask | No, it waits for you to ask | Daily briefings, weekly and monthly reports, Telegram pings when news hits what you hold |
| **Investment advice** | Not meant to give it | Planning questions | Judges a ticker against your own investment thesis |
| **Where it works** | US only, through Plaid (up to 16 accounts) | US only, through Plaid | Any country and currency: bank and broker connectors, or your bank emails and statements |
| **Where your data lives** | Anthropic's cloud | OpenAI's cloud | Your own machine |
| **Your AI** | Claude only | ChatGPT only | Your Claude Code or Codex subscription, an API key, or a local model |
| **What it covers** | Spending, bills, balances | Spending, cash flow, investments, loans | Everything you own, including property, cars and RSUs |
| **Who can get it** | Paid US plans, in beta | US ChatGPT Pro, in preview | Anyone: free and open source (AGPL-3.0) |

<sub>Based on each launch's announcement and coverage as of November 2026.</sub>

## The open-source alternative to Monarch, YNAB, Actual Budget, Firefly III and Ghostfolio

Monarch Money and YNAB keep your budget on their servers. Actual Budget and Firefly III keep it on
yours, and Ghostfolio does the same for a portfolio. Open Net Worth puts the budget, the holdings,
the loans and the property in one book on your own machine, and gives an AI agent the tools to keep
that book. If you searched for an open-source Monarch Money alternative, a YNAB alternative you can
self-host, or a Ghostfolio alternative that also budgets, this is the repository.

| Looking for | What it is | How Open Net Worth differs | Read more |
|---|---|---|---|
| **Open-source Monarch Money alternative** | Hosted budgeting and net worth app, US and Canada only, $99.99 a year | Free and self-hosted; any currency; you pick the AI model, a local one included; the MCP server runs where your data lives | [Monarch Money alternative](https://opennetworth.ai/blog/open-net-worth-vs-monarch-money/) |
| **Open-source YNAB alternative** | A zero-based budgeting method and its hosted app, from $109 a year | Zero-Based envelopes, Ready to Assign and targets, beside your investments and property; the YNAB import is on by default | [YNAB alternative](https://opennetworth.ai/blog/open-net-worth-vs-ynab/) · [Migrate from YNAB](https://opennetworth.ai/blog/migrate-from-ynab/) |
| **Actual Budget alternative** | Local-first envelope budget, MIT, no AI in the app | Adds holdings with live prices, accounts in any currency, and an agent that changes the books under rules you set | [Actual Budget alternative](https://opennetworth.ai/blog/open-net-worth-vs-actual-budget/) |
| **Firefly III alternative** | Self-hosted income and expense manager with rules, recurring transactions and a REST API, no AI by design | Adds holdings, property, a zero-based budget and the agent in the same book | [Firefly III alternative](https://opennetworth.ai/blog/firefly-iii-alternative/) |
| **Ghostfolio or Wealthfolio alternative** | Portfolio trackers: Ghostfolio is AGPL-3.0 and free to self-host, Wealthfolio is local-first | Your budget, loans and property sit beside the holdings | [Ghostfolio alternative](https://opennetworth.ai/blog/ghostfolio-alternative/) |
| **Open-source Claude Personal Finance alternative** | Anthropic's read-only view of your accounts inside Claude, US only, through Plaid | Works in any country; the data stays on your machine; the agent can change the books; runs on a Claude plan that includes Claude Code | [Claude Personal Finance alternative](https://opennetworth.ai/blog/claude-personal-finance-alternative/) |
| **Open Muse or dots for your money** | Meta's and OpenAI's general agents, running in their makers' clouds | One ledger of everything you own and owe, in a file on your computer; the agent asks first by default | [Muse vs dots vs Open Net Worth](https://opennetworth.ai/blog/muse-vs-dots-vs-self-hosted-ai-wealth-assistant/) |

Each post also says where the other tool is the better pick. Monarch and YNAB have phone apps and
household sharing, Actual Budget is the more established budget, and Ghostfolio is the more focused
portfolio tracker. All of them side by side:
[Open source net worth trackers compared](https://opennetworth.ai/blog/open-source-net-worth-tracker/).

## What's inside

| | |
|---|---|
| **Ledger** | Every account you own or owe, in any currency: banks, cards, loans, investments, retirement. Transfers, splits, reconcile, and statement import with a review step before anything books. |
| **Budget** | Zero-based envelopes (Ready to Assign, targets, credit card payments) or a simple 50/30/20 split, plus a cash flow projection. |
| **Investments** | Holdings, buys, sales, dividends, lots and realized gains, options, RSU and other equity grants, watchlists and price alerts. |
| **Planning** | Big dated commitments and how each is funded, and a retirement outlook: the odds your money lasts and the age you could retire. |
| **Lucius** | The AI agent on every screen. He works your real book through real tools: logs and sorts transactions, reconciles accounts, builds reports. Connect an MCP server and he acts in other apps too, like placing a trade with your broker. You choose what he does on his own and what he asks you first. |
| **Automations** | Jobs Lucius runs on a schedule or when something happens: a daily briefing, a weekly report, a bank sync, logging purchases from email. |
| **Skills and memory** | Saved playbooks he follows for a job (built in, or your own), and facts he remembers about you between conversations. |
| **Connectors** | Bank and broker sync (SimpleFIN, Plaid, Enable Banking, Lunch Flow, Alpaca, Interactive Brokers), YNAB, Lunch Money, your mailbox, Telegram, web search, and any MCP server. |
| **Your AI** | An API key (Anthropic, OpenAI or any OpenAI-compatible endpoint, including a local model), or the Claude Code, Codex or Antigravity sign-in you already have. Other AI apps can use your book too, through `onw mcp`. |

## Is this for you?

**Yes, if** you want to self-host your own finances, you're comfortable running a small app on
your own machine or a server you control, and you'd rather have an AI agent *do* the work
(categorize a transaction, reconcile an account, explain a swing in net worth, act in the apps you
connect) than just chat about screenshots of it.

**Not yet, if** you need a polished, install-and-forget consumer product, multi-user or family
accounts, or mobile apps.

## Requirements

- **The desktop app:** macOS on Apple Silicon, Windows 10/11 (x64), or Linux (x86_64, AppImage
  or `.deb`). It bundles its own Python, so nothing else needs installing. Intel Macs and arm64
  Linux have no desktop build yet; what differs on Windows is listed in
  [`docs/WINDOWS.md`](docs/WINDOWS.md).
- **Running a server from source:** Python 3.12+ and Node.js 22+ (macOS, Linux or Windows).
- **An AI model** — first run asks for one, with no skip: an API key (Anthropic, OpenAI, or any
  OpenAI-compatible endpoint), an existing Claude Code, Codex or Antigravity CLI sign-in on the
  same machine (detected for you), or a free local model through Ollama.

## Getting started

### Option A — the desktop app (recommended)

Download it from [opennetworth.ai](https://opennetworth.ai), or from the public
[releases page](https://github.com/open-net-worth-ai/open-net-worth-releases/releases/latest):

| Platform | Download | Terminal install |
|---|---|---|
| macOS (Apple Silicon; signed and notarized DMG) | [opennetworth.ai/download/mac](https://opennetworth.ai/download/mac) | `curl -fsSL https://opennetworth.ai/install.sh \| sh` |
| Windows 10/11 x64 (installer) | [opennetworth.ai/download/windows](https://opennetworth.ai/download/windows) | `irm https://opennetworth.ai/install.ps1 \| iex` (PowerShell) |
| Linux x86_64 (AppImage, or `.deb` from the releases page) | [opennetworth.ai/download/linux](https://opennetworth.ai/download/linux) | `curl -fsSL https://opennetworth.ai/install.sh \| sh` |

The Windows installer is **not code-signed yet**, so SmartScreen may show a warning: choose
**More info → Run anyway**. `install.ps1` verifies the download against the release's
`SHA256SUMS`; add `-RequireSigned` to refuse an unsigned installer. `install.sh` verifies the same
checksum before it installs anything. The macOS and Windows apps update themselves in place;
a Linux AppImage replaces itself after checking its SHA-256, and a `.deb` points you to the
releases page.

Then follow the first-run screen: it asks where your book lives (a local folder, or an existing
server), creates your login, picks a base currency, and hands off to Lucius to add your first
account. Your data defaults to `~/.open-net-worth/`, outside the app, so updating or reinstalling
never touches it. See the
[desktop guide](docs/product/operations/desktop.md) for background mode, start at login, watched
folders and keyboard shortcuts.

### Option B — a server

**1. Install it.** You don't need Python or Node.js on your system. This is for macOS and Linux;
on Windows, follow [these steps](docs/product/getting-started/installation.md#windows) instead.

```bash
curl -fsSL https://github.com/open-net-worth-ai/open-net-worth-releases/releases/latest/download/install-server.sh | sh
```

If it says `onw` was added to your `PATH`, run the `source` line it shows (for zsh,
`source ~/.zshenv`) or open a new terminal. It finishes by listing the commands you're likely to
need next.

**2. Start it.** Your browser opens the app, and first run takes it from there.

```bash
onw start --open
```

**3. Optional: keep it running and up to date.** Press <kbd>Ctrl</kbd>+<kbd>C</kbd> to stop the
copy from step 2, then run the command below. It starts the app at login, restarts it after a
crash and installs each new signed release. Leave out `--auto-upgrade` to update by hand. See
[Keeping it running](#keeping-it-running).

```bash
onw start --autostart --auto-upgrade
```

Other commands you may need ([full list](docs/product/getting-started/installation.md#the-onw-command)):

| Command | What it does |
|---|---|
| `onw start --background` | Run it without keeping this terminal, until `onw stop` or a reboot |
| `onw stop` | Stop it |
| `onw restart` | Restart it, the way it was running |
| `onw status` | Show whether it's running, its URL, version and folder |
| `onw logs` | Show the end of its log. `-f` keeps following it |
| `onw upgrade` | Update to the newest release |
| `onw reset-password` | Set a new password if you've forgotten it |
| `onw version` | Print the installed version |

Good to know:

- **Your data** lives in one working folder, `~/.open-net-worth/`, holding `data/`, `cache/`,
  `logs/` and `backups/`. First run lets you put it elsewhere and remembers the choice. No `.env`
  file is needed.
- **The desktop app** can connect to a server like this instead of using a local book.
- **Other AI apps** like Claude Desktop, Cursor or ChatGPT can use your book while the server is
  running. See [Use your book from other AI apps](docs/product/operations/connect-ai-apps.md).
- **Working on the code?** Run `make setup start` from a checkout (Python 3.12+ and Node.js 22+).

### Option C — Docker

**1. Download the Compose file** into an empty folder.

```bash
curl -fsSLO https://github.com/open-net-worth-ai/open-net-worth-releases/releases/latest/download/docker-compose.yml
```

**2. Pick a password and start it.** Use at least 8 characters. Compose won't start without a
password.

```bash
AUTH_PASSWORD='pick a password' docker compose up -d
```

In Windows PowerShell, use `curl.exe` in step 1, and run this in step 2:

```powershell
$env:AUTH_PASSWORD='pick a password'; docker compose up -d
```

**3. Open <http://localhost:8080>** and log in with that password.

Good to know:

- **Why the password is required:** your browser reaches the container from Docker's bridge, not
  from localhost, so the "same machine, no login" shortcut never applies. Without a password,
  nothing could operate the instance. Details are in the
  [first-run guide](docs/product/getting-started/first-run.md#docker).
- **Your data** lives in a named volume that survives `docker compose down`. Migrations run at
  boot.
- **The version** is the public image `ghcr.io/open-net-worth-ai/open-net-worth`, pinned by that
  Compose file to the release it came with. `ONW_VERSION=x.y.z` runs another.
- **Working on the code?** From a checkout, add `-f compose.build.yml --build` to build the image
  locally.

### Option D — VPS Ubuntu (Self-Hosted + Autostart)

Panduan instalasi langkah-demi-langkah pada VPS Ubuntu (22.04 LTS atau 24.04 LTS) hingga berjalan otomatis di background sebagai systemd service (`autostart`).

#### 1. Persiapan Server & Dependensi Sistem

Login ke VPS Ubuntu via SSH, perbarui sistem, dan install paket pendukung:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential libssl-dev pkg-config
```

#### 2. Install Python 3.12+ dan Node.js 22+

Aplikasi membutuhkan **Python 3.12+** dan **Node.js 22+**:

- **Install Python 3.12+:**
  ```bash
  # Pada Ubuntu 24.04: Python 3.12 sudah default
  sudo apt install -y python3 python3-pip python3-venv

  # Atau menggunakan uv (direkomendasikan & lebih cepat):
  curl -LsSf https://astral.sh/uv/install.sh | sh
  source ~/.bashrc
  uv python install 3.12
  ```

- **Install Node.js 22 LTS (via NodeSource):**
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
  node -v # Pastikan >= v22.x.x
  npm -v
  ```

#### 3. Clone Repository & Setup Otomatis

Clone repository proyek dan jalankan `make setup` untuk membuat virtualenv, mengunduh dependencies backend/frontend, build asset web, dan inisialisasi database:

```bash
git clone https://github.com/upiuzi/drduit-core.git
cd drduit-core
make setup
```

Setelah `make setup` selesai, CLI `onw` akan terinstall di `.venv/bin/onw`.

> [!TIP]
> Agar perintah `onw` dapat dipanggil langsung dari mana saja, tambahkan path virtualenv ke shell profile:
> ```bash
> echo 'export PATH="$HOME/drduit-core/.venv/bin:$PATH"' >> ~/.bashrc
> source ~/.bashrc
> ```

#### 4. Konfigurasi Jaringan & Firewall VPS

Agar aplikasi bisa diakses dari browser komputer/HP Anda melalui IP publik VPS:

- Buka port di firewall (contoh port default `8080`):
  ```bash
  sudo ufw allow 8080/tcp
  sudo ufw reload
  ```

- Jika mengakses langsung tanpa reverse proxy (menggunakan IP publik `http://IP_VPS:8080`):
  Aplikasi secara default mengikat ke `127.0.0.1`. Untuk VPS, tentukan `HOST=0.0.0.0`.

#### 5. Menjalankan Autostart (Systemd Service)

Gunakan fitur `onw autostart` bawaan untuk mengonfigurasi `systemd`. Ini memastikan aplikasi:
- Berjalan otomatis saat VPS menyala/booting.
- Auto-restart jika terjadi crash.
- Tetap berjalan di background meski sesi SSH ditutup.

Jalankan perintah ini dari direktori proyek:

```bash
HOST=0.0.0.0 PORT=8080 onw autostart on
```
*(Atau jalankan: `HOST=0.0.0.0 PORT=8080 make autostart`)*

Aktifkan **linger** agar service user terus berjalan saat logout SSH:
```bash
sudo loginctl enable-linger $USER
```

#### 6. Memeriksa Status & Log

- **Cek Status Service:**
  ```bash
  onw autostart status
  # atau
  systemctl --user status drduit.service
  ```
  *(Jika login sebagai `root`, cek dengan `systemctl status drduit.service`)*

- **Melihat Log Aplikasi:**
  ```bash
  onw logs -f
  # atau
  journalctl --user -u drduit.service -f
  ```

- **Restart / Stop Service:**
  ```bash
  onw restart         # Restart service
  onw autostart off   # Hentikan dan matikan autostart
  ```

#### 7. Akses Aplikasi di Browser

Buka browser Anda dan akses:
```
http://IP_VPS_ANDA:8080
```
Ikuti wizard pertama untuk membuat akun, memilih mata uang dasar (misalnya IDR), dan menghubungkan provider AI (Anthropic / OpenAI / Ollama lokal).

---

#### 8. (Opsional) Domain & Nginx Reverse Proxy dengan HTTPS

Jika Anda ingin mengakses menggunakan domain (misal `duit.domainanda.com`) dengan SSL gratis:

1. **Install Nginx & Certbot:**
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

2. **Buat file konfigurasi Nginx:**
   ```bash
   sudo nano /etc/nginx/sites-available/drduit
   ```
   Isi konfigurasi berikut:
   ```nginx
   server {
       server_name duit.domainanda.com;

       location / {
           proxy_pass http://127.0.0.1:8080;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
   }
   ```

3. **Aktifkan site dan pasang SSL:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/drduit /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d duit.domainanda.com
   ```

> [!IMPORTANT]
> Saat menggunakan reverse proxy, pastikan Anda menyetel password login di **Settings → Security** dan menambahkan `AUTH_TRUST_LOOPBACK=false` di environment agar akses dari luar selalu terproteksi password.

## Coming from YNAB or Lunch Money?

Add the **YNAB** or **Lunch Money** connector with a personal access token and your transactions
flow in, refreshed every 6 hours. Categories and budgets are not copied: set them up here, or let
Lucius or an Automation categorize as transactions arrive. The budget works the way YNAB's does
(every dollar assigned, Ready to Assign, envelopes that hold their overspend until month end).
Steps: [Bank and brokerage connectors](https://docs.opennetworth.ai/connectors/bank-brokerage/).

## Keeping it running

The desktop app does this itself: **Settings → Desktop** has *Keep running in the background* and
*Start at login*. For a server, Open Net Worth is one Python process (`onw start`, which runs uvicorn and serves both the API and
the built frontend on the same port) — there is no separate web server (no Apache, no nginx) in
front of it, and none is required.

- **Docker** already restarts itself: `docker-compose.yml`
  sets `restart: unless-stopped`, which covers a crash and a host reboot, as long as the Docker
  daemon itself starts on boot (the default on Docker Desktop and most Linux installs).
- **Not using Docker?** One command installs it as a boot service, so it starts at login/boot and
  restarts on crash, with no terminal window to keep open:

  ```bash
  onw start --autostart
  ```

  (`onw autostart on` is the same thing, and `onw autostart off` turns it off again. From a source checkout, `make autostart` runs setup
  first, then the same thing.) This installs a per-user **launchd** LaunchAgent on macOS, a
  per-user **systemd** unit (plus `loginctl enable-linger`, so it starts even before you log in) on
  Linux, or a per-user **Task Scheduler** task on Windows — no sudo or admin needed on any of them.
  `onw autostart` on its own shows whether it's on; `onw autostart off` stops it and removes the
  service. Logs land in `~/.open-net-worth/logs/app.log`.

  <details>
  <summary>What that installs, if you'd rather see it or do it by hand</summary>

  The service runs the same interpreter `onw` runs on, so it is identical for a uv install and a
  checkout's `.venv`; it also carries your shell's `PATH` (launchd and systemd give a fresh
  process a minimal one) and any of `HOST`, `PORT`, `ONW_ROOT`, `DATA_DIR`, `CACHE_DIR`,
  `LOGS_DIR`, `UV_TOOL_DIR`, `UV_TOOL_BIN_DIR`, `UV_CACHE_DIR`, `UV_PYTHON_INSTALL_DIR`,
  `XDG_DATA_HOME` that were set when you installed it.

  macOS (`~/Library/LaunchAgents/ai.opennetworth.app.plist`):

  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0"><dict>
    <key>Label</key><string>ai.opennetworth.app</string>
    <key>ProgramArguments</key>
    <array>
      <string>/path/to/python3</string>
      <string>-m</string><string>backend.cli</string><string>start</string>
    </array>
    <key>WorkingDirectory</key><string>/Users/you/.open-net-worth</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
  </dict></plist>
  ```

  Linux (`~/.config/systemd/user/open-net-worth.service`):

  ```ini
  [Unit]
  Description=Open Net Worth
  After=network.target

  [Service]
  WorkingDirectory=/home/you/.open-net-worth
  ExecStart=/path/to/python3 -m backend.cli start
  Restart=on-failure

  [Install]
  WantedBy=default.target
  ```

  See `backend/cli/autostart.py` for the exact commands (`launchctl bootstrap` /
  `systemctl --user enable --now`).

  </details>

- **Updating.** The desktop app updates itself (see the
  [desktop guide](docs/product/operations/desktop.md#updates)); re-running its installer also
  works. A server installed with uv: `onw upgrade` by hand, which a running server installs and
  restarts into once it's idle, or start it with `onw start --autostart --auto-upgrade` to do that
  for each new signed release — off unless you ask for it
  ([Upgrading](docs/product/operations/upgrading.md)).
  For Docker, download the new release's `docker-compose.yml` (it pins the image version) or set
  `ONW_VERSION=x.y.z`, then `docker compose up -d` (a checkout: `git pull && make setup`). Your data is outside all of them, and migrations run at the next start.

## Configuration

Everything needed to *run* the app is an optional environment variable — see `.env.example` for
the full list (working folder, host/port, CORS).

Everything needed to make it *useful* is configured **inside the running app** and stored
there: the AI provider and model under **Settings**, and banks, brokers, email, Telegram, web
search and price sources under **Connectors**. You never hand-edit a config file for those.

Set `ONW_ROOT` only to pin the working folder from outside the app: a container, or a second
instance on the same machine (which also needs its own `PORT`).

## Your data

One working folder (default `~/.open-net-worth/`): a single SQLite database plus a small set of
file-backed stores, alongside `cache/`, `logs/` and `backups/`. It never leaves your machine
except for calls you configured yourself.

Settings → Data gives you a one-click full backup `.zip`, automatic daily backups, and
restore-from-backup — a checkpoint is saved first, so a restore is itself undoable.

## Running it beyond localhost

Open Net Worth is built for **one operator on a machine you control**. Treat it like a
self-hosted password manager, not a public web app.

- **The local machine is trusted by default.** With `AUTH_TRUST_LOOPBACK=true` (the default), any
  process on the same machine can call the API without a password — so the person sitting at the
  machine never has to log in. Set it to `false` on a shared machine.
- **A password only gates non-localhost requests.** It is not, by itself, what stands between
  your data and the network.
- **Behind a reverse proxy, loopback trust stops working as intended.** A same-host proxy
  (nginx, Caddy, a tunnel) makes every remote request arrive from `127.0.0.1`, so it is trusted.
  Set `AUTH_TRUST_LOOPBACK=false` before putting this behind one.
- **Before exposing it anywhere** — a LAN, a tunnel, a public domain — set a strong password
  (Settings → Security), turn off loopback trust, and put it behind HTTPS. The app does not
  terminate TLS itself.

Found a vulnerability? See [`SECURITY.md`](SECURITY.md) — please do not open a public issue.

## Documentation

- **[docs.opennetworth.ai](https://docs.opennetworth.ai)** — the full user guide. The same docs
  are built into the app, searchable, under `/help`.
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — stores, fields, and how the money math works.
- [`CLAUDE.md`](CLAUDE.md) — the codebase map, if you are reading code rather than using the app.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — dev setup, the dependency rule, test policy.

## Stack

- **Backend** — Python 3.12, FastAPI, SQLAlchemy + Alembic (SQLite by default, Postgres supported)
- **Frontend** — React 19, TypeScript, Vite
- **AI** — Anthropic Claude by default, or any OpenAI-compatible endpoint; your key
- **Prices** — Yahoo Finance, CoinGecko

## License

AGPL-3.0 — see [`LICENSE`](LICENSE). Third-party dependency licenses are in [`NOTICE`](NOTICE).

