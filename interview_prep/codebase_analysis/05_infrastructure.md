# Infrastructure Analysis

## 1. Docker Setup

### What it does

The `Dockerfile` builds a container image that includes both Python 3.12 and Node.js 20. The Node.js install is needed because there's a WhatsApp bridge component written in TypeScript/JavaScript.

### How it works (line by line)

**Base image:** `ghcr.io/astral-sh/uv:python3.12-bookworm-slim` — a lightweight Python 3.12 image that comes with `uv` (a fast Python package installer, alternative to pip).

**Node.js install (lines 3-13):** Installs Node.js 20 from the official NodeSource repository. This is needed for the WhatsApp bridge (`bridge/` directory). The GPG key setup and cleanup is standard Debian packaging practice.

**Two-phase Python install (lines 17-26):**
```dockerfile
# Phase 1: Copy only dependency metadata, install deps (cached layer)
COPY pyproject.toml README.md LICENSE ./
RUN ... uv pip install --system --no-cache . && rm -rf openclaw_finance bridge

# Phase 2: Copy actual source, install again
COPY openclaw_finance/ openclaw_finance/
COPY bridge/ bridge/
RUN uv pip install --system --no-cache .
```
This is a Docker layer caching optimization. By copying `pyproject.toml` first and installing dependencies, Docker caches that layer. If only source code changes (not dependencies), Docker skips the dependency install step, making rebuilds faster.

**WhatsApp bridge build (lines 29-31):** Runs `npm install && npm run build` inside the `bridge/` directory to compile the TypeScript bridge into JavaScript.

**Config directory (line 34):** Creates `~/.openclaw-finance/` inside the container for runtime config.

**Port (line 37):** Exposes port 18790 — the gateway's default listening port.

**Entrypoint/CMD (lines 39-40):**
- `ENTRYPOINT ["openclaw-finance"]` — the CLI command
- `CMD ["status"]` — default subcommand (shows service status)

So running `docker run <image>` runs `openclaw-finance status`. You can override with `docker run <image> gateway start`.

### .dockerignore

Excludes: `__pycache__`, compiled Python files, build artifacts, `.git`, `.env` (secrets), `node_modules/`, `bridge/dist/`, and `workspace/`. This keeps the image small and prevents leaking secrets or local build artifacts.

---

## 2. Heartbeat Service

**File:** `openclaw_finance/heartbeat/service.py`

### What it is

A background timer that periodically "wakes up" the AI agent to check if there's anything to do. Think of it like an alarm clock — every 30 minutes (default), it rings and asks the agent: "Hey, anything in HEARTBEAT.md that needs doing?"

### How it works

1. **Timer loop (lines 90-100):** An `asyncio` task that sleeps for `interval_s` seconds (default 1800 = 30 minutes), then runs `_tick()`.

2. **Tick logic (lines 102-124):**
   - Reads `HEARTBEAT.md` from the workspace directory
   - If the file doesn't exist or is empty → does nothing (skips silently)
   - If it has content → calls `on_heartbeat(HEARTBEAT_PROMPT)` — this is a callback function passed in at init time, which sends the prompt to the AI agent
   - Checks the agent's response — if it says `HEARTBEAT_OK`, nothing was needed

3. **HEARTBEAT.md parsing (lines 21-35):** The `_is_heartbeat_empty()` function reads the markdown file and decides if there's actionable content. It skips: empty lines, headers (`#`), HTML comments (`<!--`), and empty checkboxes (`- [ ]`). Only if it finds real content does it trigger the agent.

4. **Manual trigger (lines 126-130):** You can call `trigger_now()` to force an immediate heartbeat check without waiting for the timer.

### Why this design

The heartbeat is a pull-based polling mechanism. Instead of the system pushing tasks to the agent, the agent periodically checks a file for new work. This is simple and stateless — the workspace directory is the single source of truth for "what needs doing."

---

## 3. Cron System

### Types (`openclaw_finance/cron/types.py`)

The type system defines a clear data model:

- **CronSchedule:** Three scheduling modes:
  - `"at"` — run once at a specific timestamp (`at_ms` in milliseconds)
  - `"every"` — run repeatedly at an interval (`every_ms` in milliseconds)
  - `"cron"` — run on a cron expression (e.g. `"0 9 * * *"` = every day at 9am), with optional timezone

- **CronPayload:** What to execute:
  - `kind`: Either `"agent_turn"` (send a message to the AI agent) or `"system_event"`
  - `message`: The prompt/instruction
  - `deliver`: Whether to send the result somewhere
  - `channel`/`to`: Where to deliver (e.g. WhatsApp, phone number)

- **CronJob:** A complete job definition with id, name, schedule, payload, runtime state, and timestamps.

- **CronStore:** A versioned list of jobs, persisted as JSON.

### Service (`openclaw_finance/cron/service.py`)

**Persistence:** Jobs are stored as JSON on disk at `store_path`. The service loads from disk on start and saves after every mutation.

**Timer mechanism (lines 185-202):** Instead of a fixed-interval loop, the cron service uses a "re-arm" pattern:
1. Find the earliest `next_run_at_ms` across all enabled jobs
2. Sleep until that time
3. When the timer fires, execute all due jobs
4. Recompute next runs and re-arm the timer

This is more efficient than polling every second — it sleeps exactly until the next job is due.

**Job execution (lines 221-252):**
- Calls `on_job(job)` callback (which routes to the AI agent)
- Records success/failure status
- For one-shot jobs (`kind == "at"`): either deletes the job (`delete_after_run=True`) or disables it
- For recurring jobs: computes the next run time using `_compute_next_run()`

**Cron expression support (lines 31-43):** Uses the `croniter` library to parse standard cron expressions with timezone support. Falls back gracefully on parse errors.

**Public API:** `list_jobs()`, `add_job()`, `remove_job()`, `enable_job()`, `run_job()` (manual trigger), `status()`.

---

## 4. Configuration Management

### Config file location

`~/.openclaw-finance/config.json` (the default, can be overridden).

### Schema (`config/schema.py`)

Uses Pydantic for validation. The root `Config` class contains:

| Section | Purpose |
|---------|---------|
| `agents` | Agent defaults: model, workspace path, max tokens, temperature, memory window |
| `channels` | Chat platform configs: WhatsApp, Telegram, Discord, Feishu, DingTalk, Email, Slack, QQ, Mochat |
| `providers` | LLM provider configs: API keys and base URLs for Anthropic, OpenAI, DeepSeek, Groq, Gemini, and ~12 more |
| `gateway` | Server host/port (default `0.0.0.0:18790`) |
| `tools` | Tool configs: web search, financial data APIs, meme coin monitor, shell exec, MCP servers |

### Provider matching logic (lines 275-295)

The `_match_provider()` method determines which LLM provider to use for a given model name:

1. **Keyword matching:** Iterates through a `PROVIDERS` registry (imported from `providers/registry`). Each provider spec has keywords (e.g. `"claude"` matches Anthropic, `"gpt"` matches OpenAI). First match wins.

2. **Fallback:** If no keyword match, tries the first provider that has an API key configured (skipping OAuth providers which require explicit selection).

### Config loading (`config/loader.py`)

1. Loads JSON from disk
2. Runs `_migrate_config()` to handle legacy format changes (e.g. moves `tools.exec.restrictToWorkspace` to `tools.restrictToWorkspace`)
3. Converts camelCase keys to snake_case (JSON uses camelCase, Pydantic uses snake_case)
4. Validates through `Config.model_validate()`
5. Falls back to `Config()` (all defaults) on any error

### Environment variables

Config supports env var overrides via pydantic-settings:
- Prefix: `OPENCLAW_FINANCE_`
- Nested delimiter: `__`
- Example: `OPENCLAW_FINANCE_AGENTS__DEFAULTS__MODEL=deepseek/deepseek-chat`

---

## 5. Utility Functions

**File:** `openclaw_finance/utils/helpers.py`

| Function | Purpose |
|----------|---------|
| `ensure_dir(path)` | Creates a directory (and parents) if it doesn't exist |
| `get_data_path()` | Returns `~/.openclaw-finance/` |
| `get_workspace_path(workspace)` | Returns `~/.openclaw-finance/workspace/` or a custom path |
| `get_sessions_path()` | Returns `~/.openclaw-finance/sessions/` |
| `get_skills_path(workspace)` | Returns `<workspace>/skills/` |
| `timestamp()` | Current time as ISO string |
| `truncate_string(s, max_len)` | Truncates with `...` suffix |
| `safe_filename(name)` | Replaces unsafe characters (`<>:"/\|?*`) with underscores |
| `parse_session_key(key)` | Splits `"channel:chat_id"` into a tuple |

These are simple helper functions with no external dependencies. All path functions use `ensure_dir()` to guarantee directories exist.

---

## 6. How These Pieces Fit Together

```
┌─────────────────────────────────────────────────┐
│                   Docker Container               │
│                                                   │
│  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Python App  │  │  Node.js WhatsApp Bridge │  │
│  │  (openclaw-  │  │  (bridge/)               │  │
│  │   finance)   │  └──────────────────────────┘  │
│  └──────┬───────┘                                  │
│         │                                          │
│  ┌──────┴───────────────────────────────────────┐ │
│  │              Config Layer                     │ │
│  │  ~/.openclaw-finance/config.json              │ │
│  │  → Pydantic validation → Config object        │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌─────────────┐  ┌───────────────────────────┐   │
│  │  Heartbeat  │  │      Cron Service         │   │
│  │  Service    │  │                           │   │
│  │  (30min     │  │  - one-shot ("at")        │   │
│  │   timer)    │  │  - recurring ("every")    │   │
│  │             │  │  - cron expressions       │   │
│  │  Reads      │  │                           │   │
│  │  HEARTBEAT  │  │  Jobs stored in           │   │
│  │  .md        │  │  cron_jobs.json           │   │
│  └──────┬──────┘  └────────────┬──────────────┘   │
│         │                      │                   │
│         └──────────┬───────────┘                   │
│                    │                               │
│         ┌──────────▼──────────┐                    │
│         │    AI Agent (LLM)  │                    │
│         │  - Executes tasks  │                    │
│         │  - Returns results │                    │
│         │  - Delivers to     │                    │
│         │    channels        │                    │
│         └────────────────────┘                    │
└────────────────────────────────────────────────────┘
```

**Flow:**
1. Config loads first → provides API keys, model settings, channel configs
2. Heartbeat and Cron services start as background asyncio tasks
3. Both services periodically trigger the AI agent via callbacks
4. The agent executes tasks and can deliver results to configured channels (WhatsApp, Telegram, etc.)
5. Cron jobs can optionally deliver results to specific channels/recipients

---

## 7. Key Design Decisions

1. **File-based state:** Both config and cron jobs use JSON files on disk. No database. Simple, inspectable, easy to debug.

2. **Callback-driven architecture:** Heartbeat and Cron services don't know about LLMs or channels. They accept callback functions (`on_heartbeat`, `on_job`) that are wired up externally. This keeps infrastructure code decoupled from business logic.

3. **Async-first:** Both services use `asyncio` for non-blocking timers. This allows multiple services to run concurrently in a single process.

4. **Pydantic for config validation:** Strong typing with clear defaults. Every config section has a sensible default value, so a minimal `config.json` works.

5. **camelCase ↔ snake_case conversion:** The JSON config uses camelCase (JavaScript convention) while Python uses snake_case. The loader transparently converts between them.

6. **Security by default:** `restrict_to_workspace` defaults to `True` — the agent can't access files outside its workspace unless explicitly configured.

7. **Docker layer caching:** The two-phase Python install is a standard Docker optimization — dependency install is cached separately from source copy.

8. **Heartbeat as file polling:** Using `HEARTBEAT.md` as a task queue is a simple, debuggable pattern. Anyone can create tasks by editing a markdown file.

---

## 8. Limitations

1. **No concurrency control in cron:** If a job takes longer than the interval between runs, multiple instances could theoretically overlap (no locking mechanism). The timer re-arms after execution, but there's no guard against a slow job.

2. **Single-process bottleneck:** All services (heartbeat, cron, gateway, channels) run in one Python process. A crash or OOM kills everything.

3. **File-based persistence has no atomicity guarantees:** `_save_store()` writes the entire JSON file. If the process crashes mid-write, the cron store could be corrupted. No WAL, no atomic rename.

4. **Heartbeat is file-only:** The heartbeat only checks a single file (`HEARTBEAT.md`). There's no way to register multiple heartbeat watchers or use a different polling mechanism.

5. **No job retry:** Failed cron jobs are logged as errors but not retried. If a job fails, it just moves to the next scheduled run.

6. **Config migration is minimal:** Only one migration rule exists (`tools.exec.restrictToWorkspace` → `tools.restrictToWorkspace`). Major config schema changes would require manual intervention.

7. **No config hot-reload:** Config is loaded once at startup. Changing `config.json` requires restarting the service.

8. **Timer precision:** Both heartbeat and cron use `asyncio.sleep()`, which is not real-time. System sleep/hibernation or heavy load could cause missed or delayed runs.

9. **Cron expression parsing silently fails:** If `croniter` fails to parse an expression, `_compute_next_run()` returns `None`, effectively disabling the job with no error to the user.

10. **No distributed locking:** If you run multiple containers (e.g. for scaling), they'd each have their own cron store and could execute the same jobs independently. The file-based store isn't shared.
