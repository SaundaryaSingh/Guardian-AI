# 07 — Gotcha & Edge Case Questions for OpenClaw-Finance

> These are the tricky questions interviewers love. They probe whether you actually understand your system's failure modes, not just its happy path.

---

## Glossary (Learn These First!)

| Term | Simple Definition |
|------|-------------------|
| **Concurrency** | Multiple things happening at the same time (multiple users sending messages) |
| **Race Condition** | A bug where the outcome depends on the timing of events — like two people clicking "buy" at the same time |
| **Failover** | Automatically switching to a backup system when the primary fails — like a backup generator kicking in |
| **Prompt Injection** | An attack where someone tries to trick the AI by hiding instructions in their input |
| **Idempotency** | Running the same operation multiple times produces the same result — like pressing an elevator button once vs ten times |
| **Single Point of Failure** | One component that, if it breaks, takes down the whole system |
| **Graceful Degradation** | The system keeps working (partially) even when some components fail |
| **Audit Trail** | A log of everything that happened, so you can trace back what went wrong |
| **Circuit Breaker** | Like a fuse in your house — when too many failures happen, it "blows" to prevent cascade damage |

---

## Q1: What happens if two users send messages simultaneously on Telegram?

**Why interviewers ask this:** **Concurrency** (multiple things happening at the same time) is the #1 thing people forget about.

**Answer script:**
Honestly, right now it's a bottleneck. The agent loop processes messages sequentially from a single inbound queue. If User A and User B both send a message, they queue up. User B waits until User A's full agent loop finishes. The session manager keys on `channel:chat_id`, so different users get separate sessions and don't collide on data. But the agent loop itself is single-threaded, so there's no true parallelism. For a personal tool this is fine. For production, I'd add worker pool concurrency or move to a task queue like Celery.

**Follow-up probes:**
- "What if they share the same chat_id?" -> Sessions would conflict; same file gets written.
- "How would you fix it?" -> Worker pool with asyncio.Semaphore, or a proper task queue.
- "Does the MessageBus handle this?" -> The queue is async but consumption is serial.

---

## Q2: What if the LLM API is completely down? How does the system degrade?

**Why interviewers ask this:** Every AI system depends on an external API. Graceful degradation vs catastrophic failure.

**Answer script:**
If the LLM API is down — say Anthropic returns 500s — the LiteLLM provider retries up to 3 times with exponential backoff (waiting longer after each failed attempt: 5s, 10s, 20s). If all retries fail, it returns an error response. The agent loop gets that error and tries to continue, which is a limitation. There's no **circuit breaker** (like a fuse in your house) yet. The error text goes back to the user. In a better design, I'd detect consecutive failures, stop trying, and send a user-friendly message like 'AI service is temporarily unavailable' instead of wasting iterations on a broken provider.

**Follow-up probes:**
- "What if only the inner router LLM is down but the outer one works?" -> Partial degradation.
- "How would you implement a circuit breaker?" -> Track failure count, open circuit after N failures, half-open after cooldown.
- "What about fallback provider logic?" -> If the chosen provider is also down, no help.

---

## Q3: Yahoo Finance returns null values for a stock's P/E ratio. What happens?

**Why interviewers ask this:** Data quality is a real-world nightmare. Graceful handling of bad data.

**Answer script:**
Financial data tools return structured error responses instead of raising exceptions. If yfinance returns None for P/E, the tool formats it as a result the LLM can read, like `{'pe_ratio': None, 'error': 'Data unavailable'}`. The inner LLM sees this and can either retry with different metrics, try an alternative data source, or tell the user 'P/E data isn't available for this stock.' The system is designed for graceful degradation — one bad field doesn't kill the entire analysis. But if the entire API is down, every tool returns an error, and the LLM has to work with nothing.

**Follow-up probes:**
- "What if the data is wrong but not null?" -> No validation layer catches incorrect data. This is a real limitation.
- "Do you validate data types before sending to the LLM?" -> Only parameter validation on tool inputs, not output quality checks.
- "What about stale cached data?" -> Price queries have TTL=0 (never cached). Analysis has 7-day TTL. Prediction market data has 5-minute TTL.

---

## Q4: How do you handle API rate limits across 10+ data sources simultaneously?

**Why interviewers ask this:** Rate limiting (a bouncer at a club — only letting in a certain number of requests per minute) is real and complex with multiple APIs.

**Answer script:**
Each data source has its own rate limit, handled at the tool level, not globally. AKShare has 1 request per second enforced with a sliding window. DexScreener allows 300 per minute. CoinGecko is 30 per minute on free tier. Polymarket and Kalshi are 300 each. The prediction market tool has a `_check_rate_limit` function that tracks timestamps and waits if needed. For the LLM provider, there's retry logic with exponential backoff on 429 errors. What's missing is a global rate limiter — if someone sends a query that triggers 5 tools simultaneously, each tool independently manages its own rate limit, but there's no coordination. Also, there's no per-user rate limiting on inbound messages.

**Follow-up probes:**
- "What happens if CoinGecko rate-limits you mid-analysis?" -> Tool returns error, inner LLM can retry or skip.
- "How would you add global rate limiting?" -> Token bucket or sliding window at the MessageBus level.
- "Do you cache to reduce API calls?" -> Yes, with TTLs. Price queries bypass cache.

---

## Q5: Someone sends a malicious prompt trying to get the agent to deploy a data pipeline without permission. What defenses exist?

**Why interviewers ask this:** Security with LLM agents. Threat model and **prompt injection** (tricking the AI by hiding instructions in input).

**Answer script:**
The data pipeline deployment has a multi-layer defense. First, the three-stage pipeline: scan is read-only, confirm requires user approval, and deploy checks credentials before doing anything. The LLM must explicitly decide to call the deployment tool — it's not automatic. The tool description says 'Always confirm pipeline details with the user before creating.' But I'll be honest — these are prompt-level guardrails, not cryptographic ones. If someone crafts a prompt that tricks the LLM into calling `create_token` directly, there's no hard signature verification. The `allow_from` list limits who can talk to the bot, which is the first line of defense. For production, I'd add a confirmation transaction that requires a separate human-signed approval.

**Follow-up probes:**
- "What if the prompt injection happens through a channel?" -> `is_allowed()` check happens before the message reaches the LLM.
- "Could someone bypass the `check_env` verification?" -> It just checks if keys exist, not if they're valid.
- "What about spending limits?" -> Currently no transaction amount caps. That's a real risk.

---

## Q6: The WhatsApp Node.js bridge process crashes. What happens to the Python side?

**Why interviewers ask this:** Dual-process architectures have interesting failure modes.

**Answer script:**
The WhatsApp channel and Node.js bridge communicate over a localhost WebSocket (phone call — always open). If the Node.js bridge crashes, the Python side's connection drops. The WhatsApp channel has auto-reconnect logic — it retries connecting every 5 seconds. During this time, messages from WhatsApp users are lost (there's no message queue in the bridge). The other channels — Telegram, Discord, Slack — keep working fine because they're independent async tasks. WhatsApp credentials are persisted locally, so when the bridge restarts, it reconnects without needing a new QR code scan.

**Follow-up probes:**
- "What if the Python process crashes but the Node.js bridge stays running?" -> Bridge has no client, sits idle. Python restarts and reconnects.
- "Could messages queue up in the bridge?" -> No, the bridge is a thin WebSocket relay, no persistence.
- "What about the bridge authentication timeout?" -> 5 seconds to send auth token, or connection is closed.

---

## Q7: The agent loop hits the 20-iteration max while still calling tools. What happens?

**Why interviewers ask this:** Iteration limits are a real constraint in agentic systems.

**Answer script:**
When the iteration counter hits 20, the loop forces a final response. It sends a message to the LLM saying 'You've reached the maximum iterations. Please provide a summary response now.' The LLM gives whatever answer it can with the information gathered so far. This is a safety valve — without it, a confused LLM could loop forever. The downside is the response might be incomplete. For example, if the LLM needed 25 iterations for a thorough cross-market comparison, it gets cut short. I set 20 because each iteration costs money and time. But it's hardcoded — ideally it would be configurable per query type.

**Follow-up probes:**
- "What if the LLM keeps calling the same tool repeatedly?" -> No detection for redundant tool calls. The iteration limit is the only safety net.
- "How did you choose 20?" -> Balance between thoroughness and cost/latency. Most queries complete in 3-5 iterations.
- "What about parallel tool calls?" -> Currently sequential.

---

## Q8: Two people edit `config.json` at the same time. What happens?

**Why interviewers ask this:** File-based configuration without locking is a classic concurrency problem.

**Answer script:**
Config is loaded once at startup into a Pydantic model. There's no file watching or hot-reload — changing `config.json` requires restarting the service. So the actual risk is lower than it seems. But if two people edited the file and then restarted, last write wins — there's no merge strategy. If the process crashes mid-write to config, it could corrupt the file. The Pydantic validation on load catches corrupt JSON and falls back to defaults, which is good. But a production system would use a database or at minimum atomic file writes with `os.replace()`.

**Follow-up probes:**
- "How would you fix the config write issue?" -> Atomic rename: write to temp file, then `os.replace()`.
- "What about config migration?" -> There's one migration rule. Major schema changes need manual intervention.
- "Could you use environment variables instead?" -> Yes, with prefix and delimiters for nesting.

---

## Q9: A cron job scheduled every 5 minutes takes 10 minutes to complete. What happens?

**Why interviewers ask this:** Cron systems have tricky overlap behavior.

**Answer script:**
There's no locking mechanism. The cron service finds the earliest next run time, sleeps until then, executes all due jobs, then recomputes the next run. If job A starts at minute 0 and finishes at minute 10, and job A is scheduled for minute 5, the timer fires again at minute 5 while job A is still running. The same job would start a second instance. There's no mutex or 'skip if already running' flag. For a personal tool this is unlikely to cause problems. But for long-running tasks, I'd add an `is_running` flag per job and skip execution if the previous instance hasn't finished.

**Follow-up probes:**
- "How would you implement job locking?" -> `asyncio.Lock` per job, or a flag checked before execution.
- "What if the job fails?" -> Logged as error, no retry. Next scheduled run proceeds normally.
- "Does the job store survive restarts?" -> Yes, saved as JSON on disk. Loaded on startup.

---

## Q10: The Feishu channel's SDK runs in a separate thread. How does it communicate with async Python?

**Why interviewers ask this:** Thread-to-async bridging is a subtle concurrency issue.

**Answer script:**
The Feishu SDK runs its WebSocket connection in a background thread, not on the asyncio event loop. When a message arrives in that thread, it needs to call the async message handler. The code uses `asyncio.run_coroutine_threadsafe()` to bridge from the thread to the event loop — it submits a coroutine to the loop from the Feishu thread. This works because `run_coroutine_threadsafe()` is thread-safe. The risk is if the event loop is blocked (e.g., a synchronous tool call holding the loop), the coroutine would queue up and delay. The Feishu channel also deduplicates messages using an `OrderedDict` capped at 1000 entries.

**Follow-up probes:**
- "What if the event loop is blocked when `run_coroutine_threadsafe` is called?" -> The coroutine queues up. It won't be lost, just delayed.
- "Why not make the entire system synchronous?" -> Other channels are async-native. Mixing would be worse.
- "How does Feishu handle rich text parsing?" -> Nested JSON post format is parsed into markdown.

---

## Q11: The LLM sends a tool call with null values for required parameters. What happens?

**Why interviewers ask this:** LLMs are notoriously unreliable with structured output.

**Answer script:**
Every tool has a JSON Schema definition. Before execution, `validate_params()` checks the parameters against the schema. It handles nulls specifically — if the LLM sends `None` for an optional field, it skips type checking for that field. But if a required field is missing or null, validation fails and returns an error message like 'Invalid parameters for tool X: missing required field Y.' This error goes back to the LLM as a tool result, and the LLM can retry with corrected parameters. What it doesn't cover is semantic validation — it won't catch if the LLM passes a valid-looking but nonsensical ticker symbol.

**Follow-up probes:**
- "What if the LLM sends a string where a number is expected?" -> Type validation catches it and returns an error.
- "How many iterations could this waste?" -> Each failed validation is one iteration. With 20 max, a few bad calls are recoverable.
- "Do all tools have schemas?" -> Yes, registered via `ToolRegistry` with `parameters` field.

---

## Q12: What's the single biggest security risk in the system that you'd fix first?

**Why interviewers ask this:** Can you prioritize security issues and be honest about weaknesses?

**Answer script:**
API keys and service credentials in plaintext `config.json`. The API keys, email passwords, and all service credentials are stored as plain strings. If someone gets read access to `~/.openclaw-finance/config.json`, they get everything — API keys, email access, LLM API keys. The file permissions aren't explicitly set to restrictive mode (600). Second biggest: no rate limiting on inbound messages. A user could spam the bot, triggering expensive LLM calls. Third: the shell command execution uses a denylist pattern, which is inherently bypassable. I'd fix the secrets issue first by using OS keychain integration or at minimum encrypting the config file. For production, integrate with a secrets manager.

**Follow-up probes:**
- "How would you encrypt the config?" -> Use `cryptography` Fernet symmetric encryption with a key derived from a master password.
- "What about the `SecretStr` Pydantic field?" -> Currently not used. Adding it would prevent secrets from appearing in `repr()` and logs.
- "Is the `restrict_to_workspace` flag effective?" -> It prevents file access outside workspace, but symlink creation is blocked via regex which is bypassable.

---

## Q13: What would you do differently if you were building this for BNY Mellon as a production system?

**Why interviewers ask this:** The "honesty + growth" question. Distinguishing personal project from enterprise software.

**Answer script:**
Five things, in priority order. First, replace JSONL sessions with PostgreSQL — file-based storage doesn't scale for concurrent users. Second, add proper authentication at the gateway level — right now the HTTP endpoint has no auth. Third, implement structured audit logging for every tool call and access control event — compliance requires this. Fourth, add a task queue like Celery instead of a single-process agent loop — that gives horizontal scaling, retry logic, and job isolation. Fifth, add input sanitization and output filtering — right now the LLM can be tricked into running shell commands. The system is well-designed architecturally — the message bus, channel abstraction, and provider registry are solid patterns. But it needs hardening for enterprise use.

**Follow-up probes:**
- "What about monitoring?" -> Add Prometheus metrics, distributed tracing, and alerting on failure rates.
- "How would you handle compliance?" -> Audit logs, data residency, PII handling for financial data.
- "What about the data pipeline feature?" -> Remove it entirely for a bank. It's a fun demo but not appropriate for financial services.

---

## Q14: The memory consolidation summarizes old messages using the LLM. What if the summary is wrong?

**Why interviewers ask this:** LLM-generated summaries can hallucinate or misrepresent.

**Answer script:**
This is a real risk. When a session exceeds 50 messages, the LLM summarizes old messages into `MEMORY.md` and compresses the session to the last 25 messages. If the LLM misinterprets a conversation — say, remembering 'user is bullish on Tesla' when they were actually asking hypothetically — that wrong fact persists in memory and influences all future responses. The `HISTORY.md` log is append-only and grep-searchable, which helps with debugging. But `MEMORY.md` is a living document that gets overwritten. There's no version history or rollback. For a personal tool, the user can manually edit `MEMORY.md`. For production, I'd add confidence scoring and a review mechanism.

**Follow-up probes:**
- "How often does consolidation run?" -> When session exceeds 50 messages. Financial history compresses at 10KB.
- "What's in MEMORY.md?" -> Facts about investment preferences, analysis patterns, learned context.
- "Could you use embeddings instead?" -> Yes, vector store for retrieval would be more robust than LLM summarization.

---

## Q15: If you had 5 minutes to explain the architecture to a senior engineer, what would you say?

**Why interviewers ask this:** Can you distill complexity into a clear narrative?

**Answer script:**
It's a multi-channel AI agent with four layers. **Channels** — 9 chat platforms all implement the same interface and publish messages to a **Message Bus** (post office between departments) — an async producer-consumer queue. The **Agent Loop** (detective investigating a case) picks up messages, detects financial intent, builds context from memory and profile, then runs an LLM with up to 20 tool iterations. Tools include financial data APIs, web search, and shell execution. The LLM decides what tools to call — no hardcoded routing. **Sessions** are per-user JSONL files with in-memory cache, and long-term memory is consolidated by the LLM into markdown files. The provider layer abstracts 14+ LLM providers through LiteLLM. Key trade-offs: single-process bottleneck, file-based persistence, no streaming, and sequential tool execution.

---

## Summary: Key Patterns to Remember

| Pattern | Where It Appears | Gotcha |
|---------|-----------------|--------|
| Producer-Consumer | MessageBus | Serial consumption blocks concurrent users |
| Graceful Degradation | Tool errors | Error text goes to LLM, not hard-failed |
| Retry with Backoff | LLM provider | 3 retries, then error response |
| Session Per User | JSONL files | No file locking, no concurrent write protection |
| TTL-based Cache | Financial data | Price=0s, Analysis=7d, Prediction=5min |
| Allowlist Auth | All channels | Empty = open access (by design) |
| Iteration Limit | Agent loop | 20 max, forced summary on overflow |
| Thread-to-Async | Feishu channel | `run_coroutine_threadsafe` bridge |
| Process Bridge | WhatsApp | Node.js + Python over localhost WebSocket |
| File-based State | Config, Cron | No atomicity, no hot-reload |
