# Bonus Technical Questions (Deeper Dive)

These questions test whether you truly understand the code you built — the "how" and "why" behind Docker, WebSockets, async patterns, security, and channel integrations.

---

## Glossary (Learn These First!)

| Term | Simple Definition |
|------|-------------------|
| **Docker** | A tool that packages your app with everything it needs to run anywhere — like a shipping container for software |
| **WebSocket** | A two-way communication channel that stays open — like a phone call vs sending a letter (HTTP) |
| **HTTP** | The standard way computers talk over the internet — like sending a letter, you write it, send it, wait for a reply |
| **CORS** | Cross-Origin Resource Sharing — a browser security rule that blocks websites from talking to other websites unless allowed |
| **Async** | Non-blocking — the program can do other things while waiting for a response |
| **Thread** | A separate sequence of instructions that runs in parallel within a program |
| **Cron** | A system for scheduling tasks to run at specific times — like a calendar alarm |
| **FIFO** | First In, First Out — the oldest item gets processed first |
| **HMAC** | A way to verify that a message hasn't been tampered with |
| **GIL** | Global Interpreter Lock — Python's way of handling threads |
| **IMAP/SMTP** | Email protocols — IMAP reads email, SMTP sends it |
| **QR Code** | A square barcode you scan with your phone (used for WhatsApp login) |

---

## 1. Docker & Deployment

### Q: Walk me through your Dockerfile. Why do you install dependencies twice?

**Why interviewers ask this:** Docker layer caching is a standard optimization — understanding how Docker builds images.

**Answer script:**
First, I copy just `pyproject.toml` and run `uv pip install`. Docker **caches** that layer (like keeping frequently used tools on your desk). Then I copy the actual source code and install again. If I only change Python code — not dependencies — Docker skips the dependency install entirely because the cached layer is still valid. It cuts rebuild time from minutes to seconds.

**Follow-up probes:**
- What would happen if you copied everything in one `COPY` step?
- How does the `.dockerignore` help keep the image small?
- Why do you also install Node.js in the same Dockerfile?

---

### Q: Your container runs both Python and Node.js. How do you manage two runtimes in one container?

**Why interviewers ask this:** Running multiple runtimes in one container shows architectural pragmatism.

**Answer script:**
The WhatsApp bridge is written in Node.js because the best WhatsApp library — Baileys — only exists in JavaScript. Rather than rewrite months of work in Python, I run a Node.js process alongside the Python app. In **Docker** (like a shipping container for software), I install Node.js 20, build the TypeScript bridge, and both processes run inside the same container. They talk to each other over a localhost WebSocket (a two-way communication channel — like a phone call).

**Follow-up probes:**
- What are the downsides of multi-runtime containers vs. sidecar containers?
- How would you scale this to Kubernetes?
- What if the Node.js bridge crashes — does the Python app survive?

---

### Q: What is the difference between `ENTRYPOINT` and `CMD` in your Dockerfile?

**Why interviewers ask this:** Basic Docker knowledge, but many candidates confuse the two.

**Answer script:**
`ENTRYPOINT` sets the main executable — in this case `openclaw-finance`. `CMD` provides default arguments — here it's `status`. So running `docker run <image>` executes `openclaw-finance status`. But you can override the CMD with `docker run <image> gateway start`, which runs `openclaw-finance gateway start`. The entrypoint stays, the arguments change.

**Follow-up probes:**
- How would you make it so the user cannot override the command?
- What is the difference between shell form and exec form in Dockerfile?

---

## 2. WebSocket vs HTTP

### Q: Your WhatsApp bridge uses WebSocket instead of HTTP. Why?

**Why interviewers ask this:** Tests whether you understand when WebSocket is the right choice over HTTP.

**Answer script:**
The WhatsApp bridge needs constant two-way communication. With HTTP — like sending a letter — Python would have to poll Node.js every few seconds asking "any new messages?" WebSocket keeps a single persistent connection open — like a phone call. Either side can send a message instantly with almost no overhead. It's the difference between calling someone every 5 minutes to ask "got news?" versus staying on the phone and having them tell you when something happens.

**Follow-up probes:**
- What happens if the WebSocket connection drops?
- How does reconnection work in your bridge?
- Could you have used Server-Sent Events instead?

---

### Q: How does the WebSocket handshake work?

**Why interviewers ask this:** Foundational networking knowledge.

**Answer script:**
It starts as a normal HTTP request. The client sends an `Upgrade: websocket` header asking to switch protocols. The server responds with `101 Switching Protocols`. From that point, the TCP connection stays open and both sides can send frames in either direction — text frames, binary frames, pings, pongs. It's still TCP underneath, just with a thin framing protocol on top.

**Follow-up probes:**
- What is the difference between `ws://` and `wss://`?
- How do you keep a WebSocket alive if no messages are being sent?
- What are ping/pong frames used for?

---

### Q: Why does Slack use Socket Mode instead of HTTP webhooks?

**Why interviewers ask this:** Tests understanding of deployment constraints.

**Answer script:**
Socket Mode means Slack connects to your app via WebSocket, so you don't need a public IP or webhook URL. That's great for development, internal tools, or setups behind firewalls. HTTP webhooks require Slack to reach your server, which means you need a public domain, SSL certificates, and open ports. Socket Mode avoids all of that — your app initiates the outbound connection.

**Follow-up probes:**
- What are the limitations of Socket Mode?
- How does authentication work differently in Socket Mode vs. HTTP?
- Could you switch between modes without changing application code?

---

## 3. CORS & Security

### Q: Your project has no CORS handling. Why is that, and when would you need it?

**Why interviewers ask this:** Tests if you understand what CORS is for and whether your architecture needs it.

**Answer script:**
**CORS** (Cross-Origin Resource Sharing — a browser security rule that blocks websites from talking to other websites unless allowed) only applies when a web browser makes a cross-origin request. My project doesn't expose an HTTP API — all communication happens through platform SDKs like `python-telegram-bot` and Discord Gateway. There's no browser making API calls to my server, so CORS doesn't apply. But if I added a web dashboard or REST API that a browser frontend calls, I'd need to configure CORS middleware.

**Follow-up probes:**
- What would happen if you added a web frontend without CORS?
- How would you configure CORS in FastAPI?
- What is the difference between simple requests and preflight requests?

---

### Q: Explain your channel-level access control. How does `allowFrom` work?

**Why interviewers ask this:** Tests understanding of your security model.

**Answer script:**
Every channel has an `allow_from` list in config. When a message arrives, the channel calls `is_allowed(sender_id)` before doing anything else. If the list is empty, everyone is allowed — it's an open bot. If it has entries, only those sender IDs pass. For Telegram, I use a compound format `user_id|username` separated by pipe so users can match by either. Blocked messages get a warning log but no response — silent denial, no information leakage.

**Follow-up probes:**
- What are the risks of empty `allowFrom` (open mode)?
- How would you add role-based access control?
- What happens if a platform allows spoofing sender IDs?

---

### Q: The email channel requires `consent_granted=true`. Why?

**Why interviewers ask this:** Tests ethical design and privacy thinking.

**Answer script:**
Email access is invasive — the bot reads and sends emails on your behalf. Unlike chat platforms where the user initiates contact, email could process messages the user didn't intend to share. The consent flag forces an explicit opt-in. The channel won't start without it, and it won't send without it. It's an ethical safeguard — it assumes the human operator makes a conscious decision.

**Follow-up probes:**
- What other channels might benefit from a similar consent mechanism?
- How would you implement consent for WhatsApp?
- Is a boolean flag enough, or do you need audit trails?

---

### Q: What security risks do you see in storing private keys in `config.json`?

**Why interviewers ask this:** Tests your ability to identify security weaknesses in your own code.

**Answer script:**
API keys and service credentials in `config.json` are stored as plain strings in a JSON file. If that file is compromised — someone reads the filesystem, a backup leaks — all secrets are exposed. There's no encryption at rest, no secrets manager integration, and file permissions aren't set to restrictive mode. For a personal self-hosted tool, it's acceptable. For production, I'd use a secrets manager like HashiCorp Vault or at minimum encrypt the config file and set file permissions to 600.

**Follow-up probes:**
- How would you migrate to a secrets manager?
- What is the risk of `SecretStr` vs plain `str` in Pydantic?
- How do you prevent secrets from appearing in logs?

---

## 4. Channel Integrations (9 Channels)

### Q: How do 9 different channels all use the same agent without the agent knowing which platform the user is on?

**Why interviewers ask this:** Tests understanding of abstraction.

**Answer script:**
Every channel inherits from `BaseChannel` and implements the same three methods: `start()`, `stop()`, and `send()`. When a message arrives, the channel translates it into a generic `InboundMessage` and publishes it to the MessageBus. The agent only sees `InboundMessage` objects — it doesn't know if they came from Telegram, Discord, or WhatsApp. Each channel adapts its platform to a common interface — like a universal adapter that lets any plug fit any socket.

**Follow-up probes:**
- What if you needed to add a 10th channel — what code would you change?
- How does the outbound dispatcher know which channel to send to?

---

### Q: What happens when one channel crashes?

**Why interviewers ask this:** Tests understanding of fault isolation.

**Answer script:**
Each channel runs as an independent async task. If the Discord channel crashes, it doesn't take down Telegram or Slack. The ChannelManager launches all channels with `asyncio.gather()`, and each channel has its own error handling and auto-reconnect logic. A crash in one channel logs the error and tries to reconnect, while the others keep running normally.

**Follow-up probes:**
- How does `asyncio.gather()` handle task failures?
- Would you use `return_exceptions=True` in `gather()`?
- How would you add health monitoring for each channel?

---

### Q: Explain the difference between long polling and WebSocket for receiving messages.

**Why interviewers ask this:** Tests understanding of actual protocols.

**Answer script:**
Long polling means the client sends an HTTP request and the server holds it open until a message arrives or a timeout. Then the client immediately sends another request. It simulates real-time but each message requires a full HTTP round trip. Telegram uses this. WebSocket keeps a single connection open permanently — like a phone call. Either side can send a frame instantly. Discord and Slack use WebSocket. Long polling is simpler but less efficient.

**Follow-up probes:**
- How does Telegram handle rate limits with long polling?
- What is the `offset` parameter in `getUpdates`?
- Why would you choose long polling over WebSocket?

---

### Q: How does message deduplication work across channels?

**Why interviewers ask this:** Tests understanding of reliability in distributed message systems.

**Answer script:**
Each channel that needs deduplication maintains a local set of processed message IDs. Feishu uses an `OrderedDict` capped at 1000 entries, QQ uses a `deque` capped at 1000, email tracks UIDs in a set capped at 100,000. When a new message arrives, the channel checks if its ID is already in the set. If so, it skips it. The cap prevents unbounded memory growth. This is important because platforms sometimes redeliver messages during reconnections.

**Follow-up probes:**
- What are the trade-offs between set, deque, and OrderedDict for dedup?
- What happens after the cap is reached and old entries are evicted?
- How would you implement dedup across multiple container instances?

---

## 5. WhatsApp Bridge (Why Node.js?)

### Q: Why is the WhatsApp bridge a separate Node.js process instead of Python?

**Why interviewers ask this:** Tests pragmatic architectural decisions.

**Answer script:**
The best open-source WhatsApp Web library is Baileys, written in JavaScript. It handles multi-device auth, encryption keys, QR code session persistence, and reconnection. There's no equivalent in Python — reimplementing all of that would take months. So I used a bridge pattern: Node.js handles the WhatsApp protocol complexity, Python handles business logic. They communicate via a simple JSON-over-WebSocket (phone call) protocol on localhost. It's the right trade-off — use the best tool for each job.

**Follow-up probes:**
- What are the downsides of this dual-process architecture?
- How does authentication flow between the two processes?
- What if Baileys stops being maintained?

---

### Q: How do you secure the WebSocket between Python and Node.js?

**Why interviewers ask this:** Tests defense-in-depth for internal services.

**Answer script:**
Three layers. First, the Node.js WebSocket server binds to `127.0.0.1` only — no external network can reach it. Second, there's an optional `BRIDGE_TOKEN` — Python has 5 seconds after connecting to send an auth token or it gets disconnected. Third, WhatsApp credentials are stored locally, not in a shared or remote location.

**Follow-up probes:**
- What is the risk if BRIDGE_TOKEN is not set?
- How would you add HMAC (a way to verify that a message hasn't been tampered with) verification?
- Why bind to localhost instead of 0.0.0.0?

---

### Q: How does the WhatsApp bridge handle QR code authentication?

**Why interviewers ask this:** Tests understanding of the WhatsApp connection flow.

**Answer script:**
First time connecting, the Node.js bridge creates a Baileys socket and generates a QR code. The user scans it with their phone. Baileys saves the session credentials locally. Next time the bridge starts, it loads those saved credentials — no QR scan needed. If the session expires, it reconnects after 5 seconds and shows a new QR code.

**Follow-up probes:**
- What is multi-device auth in WhatsApp?
- How does the bridge handle a network partition?
- What happens if two instances try to connect with the same credentials?

---

## 6. Cron & Scheduling

### Q: How does your cron service avoid busy-waiting?

**Why interviewers ask this:** Tests understanding of efficient timer mechanisms.

**Answer script:**
Instead of checking every second "is it time to run a job?", the cron service computes the earliest next run time across all enabled jobs, then sleeps exactly until that timestamp using `asyncio.sleep()`. When the timer fires, it executes all due jobs, recomputes the next run times, and re-arms the timer. It's event-driven — no CPU wasted polling.

**Follow-up probes:**
- What happens if `asyncio.sleep()` is interrupted by system hibernation?
- What is the precision of `asyncio.sleep()`?
- How would you handle a job that takes longer than the interval?

---

### Q: What happens if a cron job fails?

**Why interviewers ask this:** Tests error handling in scheduled systems.

**Answer script:**
The service records the failure status in the job's state. But it doesn't retry — it just moves to the next scheduled run. For one-shot jobs, the job is either deleted or disabled. For recurring jobs, the next run time is computed normally. There's no retry mechanism yet. In a production system, I'd add configurable retry with exponential backoff — waiting longer after each failed attempt.

**Follow-up probes:**
- How would you implement retries?
- What is a dead letter queue and when would you use one?
- How would you alert on repeated failures?

---

### Q: Explain the three scheduling modes: `at`, `every`, and `cron`.

**Why interviewers ask this:** Tests understanding of your own data model.

**Answer script:**
`at` runs once at a specific timestamp — good for reminders. `every` runs repeatedly at a fixed interval in milliseconds — good for periodic checks. `cron` uses standard cron expressions like `0 9 * * *` for every day at 9am, with optional timezone support. The cron expressions are parsed by the `croniter` library, which gives us flexible scheduling without reinventing the wheel.

**Follow-up probes:**
- What is the difference between `at_ms` and `at`?
- How does timezone handling work with cron expressions?
- What happens if a cron expression is invalid?

---

## 7. Testing Strategies

### Q: How would you test a channel integration without connecting to the real platform?

**Why interviewers ask this:** Tests understanding of testing external integrations.

**Answer script:**
I'd mock the platform SDK. For example, for Telegram, I'd mock `python-telegram-bot`'s `Application` and `Update` objects, create fake `Message` objects with known sender IDs and content, and pass them to the channel's handler. Then I'd assert that the channel published the correct `InboundMessage` to the bus. I'd also test `is_allowed()` separately with various sender IDs and allowlist configurations.

**Follow-up probes:**
- How do you test the outbound path (agent → channel → platform)?
- What is the difference between mocking and stubbing?
- How do you test reconnection logic?

---

### Q: How would you test the MessageBus in isolation?

**Why interviewers ask this:** Tests understanding of component testing.

**Answer script:**
I'd create a test bus, publish an `InboundMessage`, and have a mock agent consume it. Then I'd publish an `OutboundMessage` and have a mock channel consume it. I'd verify that messages arrive in order, that the bus handles backpressure when the consumer is slow, and that it cleans up properly on shutdown. I'd also test concurrent publish/consume to check for race conditions.

**Follow-up probes:**
- How do you test that the bus is truly decoupled from channels and agents?
- What happens if a consumer raises an exception?
- How would you add metrics to the bus?

---

### Q: What is the test pyramid, and how would you apply it to this project?

**Why interviewers ask this:** Tests your understanding of testing philosophy.

**Answer script:**
The test pyramid says you should have many unit tests at the base, fewer integration tests in the middle, and very few end-to-end tests at the top. For this project: unit tests for `is_allowed()`, `_validate_url()`, cron expression parsing. Integration tests for channel → bus → agent flow with mocked platforms. End-to-end tests for the full startup sequence with Docker compose. Most of my test effort goes into unit tests because they're fast and isolated.

**Follow-up probes:**
- What percentage of tests should be unit vs integration vs e2e?
- How do you test async code with pytest?
- What testing framework would you use for this project?

---

## 8. Performance Optimization

### Q: How does your system handle a user spamming the bot with messages?

**Why interviewers ask this:** Tests understanding of rate limiting and backpressure.

**Answer script:**
Honestly, the current implementation doesn't have inbound **rate limiting** (a bouncer at a club — only letting in a certain number of requests per minute). Each message goes through `is_allowed()` and then to the bus. If a user sends 100 messages, all 100 trigger LLM calls. In production, I'd add a token bucket rate limiter per user at the channel layer, with configurable limits. The external API tools already have rate limiting.

**Follow-up probes:**
- How would you implement a token bucket in asyncio?
- What is the difference between rate limiting and throttling?
- How do you handle rate limit responses from external APIs?

---

### Q: What are the performance bottlenecks in processing a message end-to-end?

**Why interviewers ask this:** Tests your ability to analyze system performance.

**Answer script:**
The biggest bottleneck is the LLM API call — that's typically 1-5 seconds per message. Then there's the tool execution if the agent decides to call external APIs. Network latency to chat platforms for sending responses is usually under 100ms. The message bus itself is fast — `asyncio.Queue` operations are microsecond-level. The real optimization targets are: caching frequent LLM responses, batching tool calls, and using streaming responses.

**Follow-up probes:**
- How would you add response caching?
- What is the difference between latency and throughput?
- How would you measure the performance of the message bus?

---

### Q: How does Docker layer caching improve your build performance?

**Why interviewers ask this:** Tests understanding of Docker optimization.

**Answer script:**
Each Dockerfile instruction creates a layer. If the input hasn't changed, Docker reuses the cached layer. By copying `pyproject.toml` first and installing dependencies, that layer gets cached. Next time I only change Python source code, Docker skips the dependency install — it just copies the new source and rebuilds. Without this, every code change would reinstall all dependencies, which takes minutes instead of seconds.

**Follow-up probes:**
- How does `--no-cache` in `pip install` help?
- What is the difference between `COPY` and `ADD`?
- How would you further reduce the image size?

---

## 9. Python Async Patterns

### Q: What is the difference between `asyncio.create_task()` and `await`?

**Why interviewers ask this:** Tests fundamental async Python knowledge.

**Answer script:**
`await` runs a coroutine and waits for it to finish before moving on. `asyncio.create_task()` schedules a coroutine to run concurrently and immediately returns a Task object — the event loop runs it in the background. In my ChannelManager.start_all(), I use `create_task()` for each channel so they all run concurrently. Then I use `asyncio.gather()` to wait for all of them. If I just `await` each channel sequentially, only one would run at a time.

**Follow-up probes:**
- What happens if a created task raises an exception?
- What is the difference between `asyncio.gather()` and `asyncio.wait()`?
- How do you cancel a running task?

---

### Q: How does `asyncio.run_coroutine_threadsafe()` work in the Feishu channel?

**Why interviewers ask this:** Tests thread-to-async bridging.

**Answer script:**
The Feishu SDK runs its own event loop in a separate thread, but our app uses asyncio's event loop in the main thread. When the Feishu SDK delivers a message in its thread, I can't directly call async functions. `run_coroutine_threadsafe()` takes a coroutine and schedules it on the main thread's event loop from the Feishu thread. This bridges the gap between threaded and async code.

**Follow-up probes:**
- Why can't you use `await` in the Feishu callback?
- What is the difference between `run_coroutine_threadsafe()` and `call_soon_threadsafe()`?
- What are the risks of sharing state between threads and the event loop?

---

### Q: How do you run blocking code in an async context?

**Why interviewers ask this:** Tests understanding of the event loop.

**Answer script:**
If you call a blocking function like `time.sleep()` inside an async function, it blocks the entire event loop — no other tasks can run. The fix is `asyncio.to_thread()` which runs the blocking function in a thread pool executor, freeing the event loop. Alternatively, `loop.run_in_executor()` does the same thing.

**Follow-up probes:**
- What is the default thread pool size in asyncio?
- When should you use threading vs multiprocessing vs asyncio?
- What is the GIL (Global Interpreter Lock — Python's way of handling threads) and how does it affect this?

---

## 10. Error Handling

### Q: What happens if the WhatsApp bridge process crashes?

**Why interviewers ask this:** Tests fault tolerance and process management.

**Answer script:**
The Python side detects the WebSocket (phone call) disconnection and starts its own reconnect loop with a 5-second delay. The Node.js bridge, if run under a process manager like PM2 or systemd, restarts automatically. Both sides are independently resilient. When the bridge comes back up, Python reconnects and resumes normal operation. Messages that arrive during the downtime are lost — there's no message queue between the processes.

**Follow-up probes:**
- How would you add message persistence during downtime?
- What is the difference between a process manager and a container orchestrator?
- How would you implement health checks for the bridge?

---

### Q: How does each channel handle rate limiting from the platform API?

**Why interviewers ask this:** Tests API integration resilience.

**Answer script:**
Each channel handles it differently based on the platform. Discord returns a 429 status with a `Retry-After` header — the channel reads that and delays before retrying. Telegram has rate limits but the library handles retries internally. Slack returns rate limit headers that the SDK manages. DingTalk returns errors that trigger a reconnect. Each platform has its own semantics, so each channel implements its own retry logic.

**Follow-up probes:**
- What is the difference between rate limiting and **circuit breaking** (a fuse in your house — when too much current flows, the fuse blows to prevent fire)?
- How would you implement a unified retry mechanism across channels?
- What is exponential backoff and why add jitter?

---

### Q: What happens if the config file is missing or corrupted?

**Why interviewers ask this:** Tests graceful degradation.

**Answer script:**
The config loader catches any exception during JSON parsing or Pydantic validation and falls back to `Config()` — which gives all default values. The app starts with sensible defaults: no channels enabled, no API keys, local workspace path. It logs a warning but doesn't crash. The user can then fix the config file and restart. A single corrupted field shouldn't bring down the entire system.

**Follow-up probes:**
- How would you add config hot-reloading?
- What is the downside of silent fallback to defaults?
- How would you validate the config before the app starts?

---

### Q: How do you handle exceptions in `asyncio.gather()` when running multiple channels?

**Why interviewers ask this:** Tests async error propagation.

**Answer script:**
If I use `asyncio.gather(*tasks)` without `return_exceptions=True`, the first exception kills all tasks. That's bad — one channel crashing shouldn't take down the others. With `return_exceptions=True`, exceptions are returned as values instead of raised. I iterate through results, log any exceptions, and the other channels keep running. I can also wrap each channel task in a try/except inside the task itself for per-channel error handling.

**Follow-up probes:**
- What is an `ExceptionGroup` in Python 3.11+?
- How would you implement a dead letter queue for failed messages?
- How do you propagate errors from a background task to the main thread?

---

### Q: How does your system handle a platform API being temporarily unavailable?

**Why interviewers ask this:** Tests resilience patterns.

**Answer script:**
Each channel has auto-reconnect logic with delays — usually 5 seconds between attempts. If Telegram's API is down, the Telegram channel logs the error, waits, and retries. It doesn't crash the process or affect other channels. The outbound dispatcher also handles send failures — if `channel.send(msg)` raises an exception, it logs the error and moves to the next message. There's no dead letter queue yet, so failed outbound messages are just logged, but in production I'd add retry with exponential backoff.

**Follow-up probes:**
- What is the Circuit Breaker pattern (like a fuse in your house) and how would you apply it?
- How do you distinguish between transient and permanent failures?
- What metrics would you track for API availability?

---

## 11. Testing Async Code

### Q: How do you test async code in Python?

**Why interviewers ask this:** Testing async code is trickier than sync code.

**Answer script:**
I use `pytest-asyncio` which lets me write test functions as `async def` and run them with `@pytest.mark.asyncio`. For testing the agent loop, I mock the LLM provider to return predictable responses, then assert the loop calls the right tools. For the message bus, I create an async test that sends a message and verifies it arrives at the right handler. The key challenge is timing — async operations don't finish instantly, so I use `asyncio.wait_for()` with timeouts to prevent tests from hanging.

**Follow-up probes:**
- How do you mock an LLM provider in tests?
- What's the difference between `asyncio.create_task()` and `await`?
- How do you test that concurrent messages don't corrupt session state?

---

## 12. CI/CD Pipeline

### Q: How would you set up a CI/CD pipeline for this project?

**Why interviewers ask this:** Production readiness — automated testing and deployment.

**Answer script:**
I'd set up GitHub Actions with three stages: lint, test, deploy. Lint runs `ruff check` to catch style issues. Test runs `pytest` with async mode, including the performance guard that AI search must finish under 250ms. Deploy would build the Docker (shipping container) image and push to a registry. For the frontend, I'd run `tsc` for type checking and `vite build` for production. If any stage fails, the pipeline stops — no broken code reaches production.

**Follow-up probes:**
- How do you handle secrets (API keys) in CI/CD?
- What's the difference between continuous integration and continuous deployment?
- How would you add database migrations to the pipeline?
