# System Design Interview Questions — OpenClaw-Finance

*Tailored for Full Stack + AI/ML Intern positions (BNY Mellon style)*

---

## Glossary (Learn These First!)

| Term | Simple Definition |
|------|-------------------|
| **Load Balancer** | A traffic cop that distributes incoming requests across multiple servers |
| **Cache** | A fast storage layer that saves frequently accessed data — like sticky notes on your desk |
| **Database** | Organized storage for structured data — like a spreadsheet that persists |
| **Redis** | An ultra-fast in-memory cache/database — like RAM but persistent |
| **JWT** | JSON Web Token — a digital ID card that proves you're logged in |
| **CI/CD** | Continuous Integration/Continuous Deployment — automated testing and release pipelines |
| **Kubernetes** | A system for managing multiple Docker containers (shipping containers for software) across many servers |
| **Microservices** | Breaking a big app into small, independent services that talk to each other |
| **API Gateway** | A front door that routes all incoming requests to the right backend service |
| **Circuit Breaker** | Like a fuse in your house — when too many failures happen, it "blows" to prevent cascade damage |
| **Redis Sentinel** | A backup system that automatically promotes a backup database if the main one fails |
| **Canary deployment** | Rolling out changes to a small group of users first before everyone |
| **Horizontal scaling** | Adding more servers instead of making one server bigger |

---

## How to Use This Document

Each question follows a structured format:
1. **The Question** — what the interviewer asks
2. **Why They Ask** — what skill they're evaluating
3. **Answer Script (45–60s)** — a beginner-friendly, spoken response
4. **Follow-Up Probes** — deeper questions to prepare for

**Delivery tips:**
- Start with a one-sentence summary, then expand
- Name trade-offs explicitly — "Option A gives us X but costs Y"
- Use OpenClaw-Finance as your concrete example
- If unsure, say "I'd start simple and add complexity as needed"

---

## Question 1: Scaling to 10,000 Users

### The Question
> "OpenClaw-Finance currently runs as a single process. How would you scale it to serve 10,000 concurrent users?"

### Why Interviewers Ask This
Horizontal scaling, stateless vs stateful components, bottleneck identification.

### Answer Script (50s)
Right now, everything runs in one Python process — the message bus, agent loop, and sessions. To scale to 10,000 users, I'd break this into three priorities.

First, make the agent loop stateless by moving sessions from local JSONL files to a shared database like PostgreSQL. That way, any instance can handle any user's request.

Second, put a **load balancer** (like a traffic cop distributing requests across servers) in front of multiple gateway instances. The message bus would need to become Redis-backed instead of in-memory queues.

Third, separate the heavy work — LLM calls and tool execution — into a worker pool using something like Celery. If one worker is slow, it doesn't block other users.

The key trade-off: this adds infrastructure complexity, but each component now scales independently.

### Follow-Up Probes
- "Which component would you scale first and why?"
- "How would you handle a Telegram bot that suddenly gets 5,000 messages in a minute?"
- "What happens if the shared session database goes down?"
- "How do you decide between vertical and horizontal scaling?"

---

## Question 2: Real-Time Collaborative Features

### The Question
> "How would you add a feature where multiple users can collaboratively analyze a stock in real-time?"

### Why Interviewers Ask This
WebSockets, pub/sub patterns, state synchronization.

### Answer Script (55s)
I'd build this on WebSocket (a two-way communication channel — like a phone call) with a pub/sub layer. When a user joins a shared workspace, they connect via WebSocket to a gateway instance. The gateway subscribes them to a channel in Redis Pub/Sub. When anyone sends a message, the gateway publishes it to Redis, and all connected clients receive it.

For the agent's responses, I'd route them through the same pub/sub channel. If User A asks about Tesla, the response goes to everyone in the workspace.

The tricky part is state. If User B joins late, they need to see the conversation history. I'd store workspace messages in a time-ordered database and replay recent messages on join.

The trade-off: Redis Pub/Sub is fast but doesn't persist. I'd use it for real-time delivery and a database for durability.

### Follow-Up Probes
- "What if two users ask the agent conflicting questions at the same time?"
- "How would you handle a workspace with 50 people?"
- "Would you use WebSocket or SSE for this? Why?"
- "How do you prevent one slow client from blocking others?"

---

## Question 3: Rate Limiting

### The Question
> "How would you implement rate limiting in OpenClaw-Finance?"

### Why Interviewers Ask This
Core system design concept — different algorithms, placement, edge cases.

### Answer Script (50s)
I'd implement rate limiting at two levels — per-user and per-channel — using a token bucket algorithm.

The token bucket algorithm gives each user a bucket with, say, 10 tokens that refill at 1 token per minute. Every API request costs one token. If the bucket is empty, the request is rejected with a 429 status. This allows bursts but prevents sustained abuse. Think of it like a bouncer at a club — you can bring in 10 friends at once, but once they're gone, you have to wait for more spots.

I'd place the rate limiter in the gateway, before messages reach the agent loop. For distributed deployment, I'd store token counts in Redis with atomic decrement operations.

I'd also add per-channel limits and a global budget cap — if daily LLM spend exceeds a threshold, the system switches to a cheaper model.

The trade-off: strict limits improve cost control but frustrate power users. I'd make limits configurable per user tier.

### Follow-Up Probes
- "What's the difference between token bucket and sliding window?"
- "How would you handle rate limiting across multiple gateway instances?"
- "What if a user hits the rate limit mid-conversation?"
- "How would you expose rate limit info to users?"

---

## Question 4: Database Design

### The Question
> "Walk me through how you'd design the database schema for OpenClaw-Finance."

### Why Interviewers Ask This
Data modeling, database type selection, access patterns.

### Answer Script (55s)
I'd use a hybrid approach — PostgreSQL for structured data and Redis for caching and real-time state.

The core tables would be: `users` for authentication, `sessions` for conversation state, `messages` for the conversation log, and `financial_cache` for cached analysis results.

The `sessions` table would have a composite key on `user_id` and `channel` — so one user can have separate sessions for Telegram and Discord. Messages reference their session with a foreign key, ordered by timestamp. I'd index on `(session_id, timestamp)` for fast retrieval.

For financial data, I'd use a `financial_cache` table with a `ticker`, `intent_type`, `data` (JSONB), and `expires_at`. PostgreSQL's JSONB type lets me query inside the cached data without parsing.

For real-time data like rate limit counters, I'd use Redis. It's fast, supports atomic operations, and has built-in TTL.

The key decision: normalize user data but denormalize financial cache. Financial queries are read-heavy and don't need joins.

### Follow-Up Probes
- "How would you handle two users asking about the same ticker simultaneously?"
- "When would you choose MongoDB over PostgreSQL?"
- "How would you archive old sessions?"
- "What indexes would you create for the messages table?"

---

## Question 5: Authentication & Authorization

### The Question
> "How would you add auth so only authorized users can interact with the agent?"

### Why Interviewers Ask This
Security is non-negotiable in fintech.

### Answer Script (50s)
I'd implement JWT-based authentication — **JWT** (JSON Web Token) is like a digital ID card that proves you're logged in.

For user-facing channels like Telegram and Discord, I'd use the platform's native identity and maintain an allowlist in config.

For the HTTP gateway, I'd require a JWT token in the `Authorization` header. On first login, the user authenticates via OAuth or email/password, and the server issues a JWT with their `user_id` and `role` claims. Every request validates the token signature and checks expiration.

For authorization, I'd implement role-based access control — a `user` role gets basic queries, a `premium` role gets unlimited tool iterations, and an `admin` role can manage other users.

The key security points: never store secrets in session files, validate all inputs at the gateway layer, and log every authenticated request for audit trails.

### Follow-Up Probes
- "What happens when a JWT token expires mid-conversation?"
- "How would you handle API keys for third-party integrations?"
- "How do you prevent session hijacking across channels?"
- "Would you use session cookies or tokens for a web dashboard?"

---

## Question 6: Failover & High Availability

### The Question
> "What happens if the server running OpenClaw-Finance crashes?"

### Why Interviewers Ask This
Redundancy, health checks, graceful degradation.

### Answer Script (50s)
I'd design for failover at three layers — the gateway, the agent, and the data store.

For the gateway, I'd run multiple instances behind a load balancer with health checks. If one crashes, the load balancer routes traffic to healthy ones.

For the agent loop, since it's stateless after moving sessions to a shared database, any instance can pick up where another left off. I'd add a deduplication key on each message so processing a message twice doesn't duplicate actions.

For the data store, I'd use PostgreSQL with read replicas and automated backups. For Redis, I'd use Redis Sentinel for automatic **failover** (automatically switching to a backup when the primary fails).

The graceful degradation piece: if the LLM API is down, the system should queue messages and respond with 'I'm experiencing delays' rather than failing silently. I'd implement a **circuit breaker** (like a fuse in your house — when too many failures happen, it "blows" to prevent cascade damage) that detects consecutive LLM failures and falls back to a cached response.

### Follow-Up Probes
- "How would you handle the LLM provider rate-limiting you?"
- "What's the difference between active-passive and active-active failover?"
- "How would you test your failover setup?"
- "What data would you lose if the server crashes right now?"

---

## Question 7: Monitoring & Observability

### The Question
> "How would you add monitoring and logging to OpenClaw-Finance?"

### Why Interviewers Ask This
Production systems need observability — the three pillars: logs, metrics, traces.

### Answer Script (55s)
I'd implement the three pillars of observability.

For logging, I'd replace print statements with structured JSON logs. Each log entry would include `timestamp`, `level`, `service`, `user_id`, `channel`, `message_id`, and `trace_id`. I'd send logs to a centralized system like Loki or ELK stack.

For metrics, I'd instrument key operations with Prometheus — messages received per channel, LLM call latency, tool execution time, error rates. I'd create dashboards in Grafana. Alert rules would fire if error rate exceeds 5% or LLM latency spikes above 10 seconds.

For tracing, I'd use OpenTelemetry to propagate a trace ID through the entire request path — from channel ingestion through the agent loop to LLM calls and back. This lets me pinpoint exactly where a slow request is stuck.

The critical alerts: LLM API failures, message queue backlog growing faster than consumption, and financial data cache hit rate dropping below 80%.

### Follow-Up Probes
- "How would you debug a slow response that takes 30 seconds?"
- "What's the difference between logging and tracing?"
- "How would you monitor LLM costs in real-time?"
- "Where would you store logs — files, database, or external service?"

---

## Question 8: Caching Layer Design

### The Question
> "How would you design a proper caching layer for a multi-user production system?"

### Why Interviewers Ask This
Cache strategies, invalidation, freshness vs speed trade-offs.

### Answer Script (50s)
I'd implement a two-tier **cache** (like keeping frequently used tools on your desk) — Redis for hot data and PostgreSQL for warm data — with TTL-based invalidation.

The hot cache in Redis stores frequently accessed data like stock prices with a TTL of 5 minutes. Redis gives O(1) lookup with sub-millisecond latency. I'd use a cache-aside pattern — the application checks Redis first, on a miss it queries the data source, and writes the result back to Redis.

The warm cache in PostgreSQL stores analysis results with longer TTLs — 24 hours for earnings reports, 7 days for macro indicators.

For invalidation, I'd use event-driven invalidation. When a new data point arrives, I'd publish an invalidation event to Redis Pub/Sub so all instances evict stale entries.

The key trade-off: tighter caching improves latency and reduces API costs, but stale financial data can mislead users. I'd add metadata showing when data was last updated.

### Follow-Up Probes
- "What happens if Redis goes down?"
- "How would you handle cache stampede when a popular ticker is queried by many users?"
- "Would you use write-through or write-behind caching?"
- "How do you decide what TTL to set?"

---

## Question 9: Real-Time Updates & Streaming

### The Question
> "How would you add streaming so users see text as it's generated?"

### Why Interviewers Ask This
Server-Sent Events, WebSocket protocols, partial responses.

### Answer Script (50s)
I'd implement streaming using Server-Sent Events for HTTP clients and WebSocket (phone call — always open) for real-time channels.

The LLM providers already support streaming via their APIs. I'd modify the agent loop to yield tokens as they arrive instead of buffering the full response.

For Telegram and Discord, streaming is trickier — they don't support real-time token delivery. I'd implement a 'typing indicator' while the agent processes, then send the full response. For Discord, I could send a partial message and edit it as tokens arrive.

The trade-off: streaming reduces perceived latency from 5-10 seconds to under 100ms for the first token, but adds complexity around connection management, error handling mid-stream, and reconnection logic.

### Follow-Up Probes
- "How would you handle a WebSocket disconnection mid-stream?"
- "What if the user sends another message while streaming?"
- "How does streaming affect rate limiting?"
- "Would you buffer streaming responses for debugging?"

---

## Question 10: Production Deployment

### The Question
> "How would you deploy OpenClaw-Finance to production on AWS or GCP?"

### Why Interviewers Ask This
Containerization, orchestration, CI/CD, production best practices.

### Answer Script (55s)
I'd deploy using Docker containers (shipping containers for software) orchestrated by Kubernetes, with a CI/CD pipeline for automated releases.

First, I'd containerize with a multi-stage Dockerfile — a build stage and a slim runtime stage. Config and session data would be mounted as volumes.

For orchestration, I'd use Kubernetes with three deployments: the gateway, workers (run agent loops), and Redis. I'd set up horizontal pod autoscaling — scale gateway pods based on CPU, scale workers based on queue depth.

For CI/CD, I'd use GitHub Actions — on push to main, run tests, build the Docker image, push to ECR, and trigger a rolling deployment. I'd implement canary deployments — route 10% of traffic to the new version first.

For infrastructure, I'd use RDS for PostgreSQL, ElastiCache for Redis, and ALB for load balancing. Secrets go in AWS Secrets Manager, not in config files.

The key principle: never deploy on Fridays, always have a rollback plan.

### Follow-Up Probes
- "How would you handle database migrations during deployment?"
- "What's the difference between rolling deployment and blue-green deployment?"
- "How would you manage secrets across environments?"
- "How would you set up a staging environment?"

---

## Question 11: API Gateway Design

### The Question
> "If you were designing the API gateway from scratch, what would it look like?"

### Why Interviewers Ask This
Request routing, middleware, centralizing cross-cutting concerns.

### Answer Script (50s)
I'd design the API gateway as a single entry point that handles authentication, rate limiting, routing, and protocol translation.

The gateway sits in front of all channel handlers and the agent. For each incoming request, it runs a middleware chain (like a filter that processes data before the main system sees it): first validate the JWT token, then check rate limits, then log the request, then route to the appropriate service.

For routing, I'd use a path-based system — `/api/telegram/webhook` goes to Telegram, `/api/discord/interactions` to Discord. Each route has its own timeout and retry policy.

The gateway would also handle protocol translation — converting Telegram's webhook format into a normalized `InboundMessage`. This keeps the agent loop clean.

I'd implement it using FastAPI or Express — lightweight, async, and well-suited. The key design principle: the gateway is stateless and dumb — it routes, validates, and rate-limits, but never processes business logic.

### Follow-Up Probes
- "How would you handle WebSocket connections through the gateway?"
- "What happens if a backend service is slow?"
- "How would you implement request transformation?"
- "What's the advantage of an API gateway over direct service calls?"

---

## Question 12: Data Consistency Across Channels

### The Question
> "If a user asks a question on Telegram and switches to Discord, how do you ensure consistent responses?"

### Why Interviewers Ask This
Distributed state, session management, user identity.

### Answer Script (50s)
The key is a unified user identity layer with cross-channel session linking.

I'd assign each user a canonical `user_id` regardless of channel. When a Telegram message arrives, I'd look up the user in a `user_identities` table that maps `telegram_id`, `discord_id`, `slack_id` to a single `user_id`.

The session would be keyed by `user_id` instead of `channel:chat_id`. So when the user switches from Telegram to Discord, the agent loads the same session — same conversation history, same memory.

The response still goes back through the originating channel, but the context is shared.

The trade-off: cross-channel sessions require conflict resolution. If the user sends messages on two channels simultaneously, I'd process them sequentially by timestamp. The session would need optimistic locking to prevent corruption.

### Follow-Up Probes
- "What if the user wants separate sessions on different channels?"
- "How would you handle a user with different names on Telegram vs Discord?"
- "Would you merge conversation history or keep it separate?"
- "How do you handle the case where one channel is offline?"

---

## Bonus Quick-Fire Questions

### Q13: "How would you handle a sudden spike in traffic from a viral Telegram bot?"
**Answer:** "I'd use auto-scaling groups on the gateway layer and a queue-based buffer. Messages go into a Redis queue during the spike, workers process them as capacity becomes available. Users see a 'processing' indicator instead of timeouts."

### Q14: "How would you implement A/B testing for different LLM models?"
**Answer:** "I'd add a `model_override` field in the user's profile and route requests accordingly. The gateway checks the user's A/B group on each request and forwards to the assigned model. I'd track response quality metrics per group."

### Q15: "How would you handle GDPR data deletion requests?"
**Answer:** "I'd implement a `delete_user_data` function that removes the user's session files, financial cache, and profile from all stores. I'd add a deletion audit log to prove compliance. For sessions, I'd use soft deletes with a 30-day purge window."

### Q16: "How would you design a fallback when the primary LLM provider is down?"
**Answer:** "I'd implement a provider chain — try Anthropic first, fall back to OpenAI, then to a local model. The circuit breaker (like a fuse in your house) pattern detects failures and switches providers. I'd cache the last successful response as a temporary fallback."

### Q17: "How would you handle message ordering across distributed workers?"
**Answer:** "I'd use a per-user message queue with FIFO semantics. Each user's messages go to the same Redis queue partition, ensuring order. Workers consume from specific partitions, so parallelism doesn't break ordering."

---

## Key Principles to Remember

1. **Start simple, scale later** — Don't over-engineer on day one
2. **Name your trade-offs** — Every choice has a cost
3. **Think about failure** — "What happens if X goes down?"
4. **Use concrete numbers** — "10,000 users at 10 QPS means 100 requests per second"
5. **Connect to your project** — Use OpenClaw-Finance as your example system

## The STAR-S Framework for System Design Answers

| Step | Description | Example |
|------|-------------|---------|
| **S**ituation | Context and constraints | "OpenClaw-Finance serves multiple channels from one process" |
| **T**ask | What you're solving | "We need to handle 10,000 concurrent users" |
| **A**ction | Your design choices | "I'd move sessions to PostgreSQL and add a load balancer" |
| **R**esult | Expected outcome | "This gives us horizontal scaling with shared state" |
| **S**cale | How it grows | "At 100K users, I'd add database sharding by region" |

---

*Prepared for interview prep — Guardian-AI project context*
*Last updated: August 2026*
