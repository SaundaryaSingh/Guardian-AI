# Core Architecture & Design — Interview Questions (Q1–Q30)

> **Target Role:** Full Stack + AI/ML Intern, BNY Mellon
> **Project:** OpenClaw-Finance — AI Financial Agent with Multi-Channel Support

---

## Glossary (Learn These First!)

| Term | Simple Definition |
|------|-------------------|
| **Agent Loop** | A cycle where the AI thinks, acts, observes, and repeats until it has an answer — like a detective investigating a case |
| **Message Bus** | A system that passes messages between parts of your app — like a post office between departments |
| **Channel** | A chat platform integration (Telegram, Discord, Slack, etc.) |
| **Session** | A saved conversation history for a specific user on a specific channel |
| **JSONL** | JSON Lines — a file format where each line is a separate JSON object (used for storing messages) |
| **Async** | Non-blocking — the program can do other things while waiting for a response |
| **Tool Registry** | A list of all the tools the AI can call — like a menu of options |
| **LLM** | Large Language Model — the AI like ChatGPT that powers the agent |
| **Cron** | A system for scheduling tasks to run at specific times — like a calendar alarm |
| **Context Window** | How much text the AI can "see" at once — like a whiteboard that can only fit so much |
| **Cache** | Storing frequently used data nearby for quick access — like keeping frequently used tools on your desk instead of walking to the supply room |
| **Middleware** | Code that runs between two other pieces of code — like a filter that processes data before the main system sees it |

---

## Q1 — Walk me through what OpenClaw-Finance is and what it does.

**Why interviewers ask this:** They want a 60-second pitch that shows you understand the project end-to-end.

**Answer script:**
OpenClaw-Finance is an AI financial assistant I built that connects to live market data, reasons through investment questions, and delivers answers across nine chat channels — Telegram, Discord, Slack, WhatsApp, and others. Under the hood, it uses an **LLM** (Large Language Model — the AI like ChatGPT) agent loop that can call financial tools like stock data APIs. Think of it as a personal financial analyst that lives in your chat app and is always on.

**Follow-up probes:**
- How many users can it serve simultaneously right now?
- What makes it different from just asking ChatGPT about stocks?
- What data sources does it support?

---

## Q2 — What problem were you solving with this project?

**Why interviewers ask this:** They want to see you chose a real problem, not just built code for the sake of it.

**Answer script:**
Most chatbots just talk — they don't pull live financial data or remember what you care about. OpenClaw-Finance bridges that gap: it fetches actual market data, reasons through it step by step, and delivers the answer wherever you already chat. It also solves the "multi-channel" problem — instead of building separate bots for Telegram and Discord, one agent serves all of them through a shared **message bus** (a system that passes messages between parts of your app — like a post office between departments).

**Follow-up probes:**
- Who is the target user — retail investors, analysts, or both?
- What was the hardest part of making it work with real data?

---

## Q3 — Describe the overall architecture at a high level.

**Why interviewers ask this:** System-level thinking is critical. They want to see you can explain how pieces fit together.

**Answer script:**
There are four main layers. First, the **channel layer** — Telegram, Discord, and other chat platforms each have a handler that pushes incoming messages onto a message bus. Second, the **message bus** (think of it as a post office between departments) — an async (non-blocking) queue system that decouples channels from the agent. Third, the **agent loop** (like a detective investigating a case) — the brain. It picks up messages, builds a prompt, and runs an LLM reasoning cycle with tool calls. Fourth, the **tool registry** (a menu of all available tools) — a plugin system where financial APIs and web search are registered. Sessions are stored as JSONL files per user per channel.

**Follow-up probes:**
- Why use a message bus instead of direct function calls?
- How does the agent loop decide when to stop?
- Where does the LLM sit in this architecture?

---

## Q4 — What is the agent loop and how does it work?

**Why interviewers ask this:** This is the core of the project. They want to see you understand iterative LLM reasoning.

**Answer script:**
The agent loop is like a detective investigating a case — it keeps digging until it has enough evidence. It's a loop that runs up to 20 iterations. Each iteration, it sends the conversation to the LLM. The LLM either responds with a final answer — done — or requests a tool call, like fetching a stock price. If it requests a tool, we execute it, feed the result back, and loop again. After 20 iterations, we force a summary so the user isn't left hanging.

**Follow-up probes:**
- What happens if the LLM calls a tool that fails?
- Why 20 iterations specifically — is that configurable?
- How do you prevent infinite loops?

---

## Q5 — Why did you choose an iterative tool-loop pattern instead of a single LLM call?

**Why interviewers ask this:** They want to understand your architectural reasoning.

**Answer script:**
A single LLM call can only use information it already knows. Financial analysis requires live data — stock prices change every second. The tool loop lets the LLM decide what data it needs, fetch it, analyze it, and fetch more if needed. For example, comparing Apple and Microsoft's valuations requires calling the stock data tool twice, then reasoning over both results. A single call couldn't do that. The tradeoff is latency and cost — each iteration is another API call — but the answer quality is significantly better.

**Follow-up probes:**
- How would you reduce the number of iterations for simple queries?
- What's the cost implications of running 20 LLM calls per user query?

---

## Q6 — Explain the message bus. Why does it exist?

**Why interviewers ask this:** Decoupling is a fundamental design principle.

**Answer script:**
The message bus is like a post office between departments — each chat channel pushes messages onto an inbound queue, and the agent loop pops from it. When the agent has a response, it pushes onto an outbound queue, and a dispatcher routes it to the right channel. The key benefit is **decoupling** — the agent doesn't know or care whether a message came from Telegram or CLI. Adding a new channel means writing a handler that pushes to the queue. No agent code changes needed.

**Follow-up probes:**
- What happens if the outbound queue gets backed up?
- How would you scale this to thousands of concurrent users?
- Why use async queues instead of regular function calls?

---

## Q7 — How does session management work?

**Why interviewers ask this:** State management is critical for any chat application.

**Answer script:**
Each user on each channel gets a unique session key — for example, `telegram:12345`. The session stores the conversation history. Sessions are kept in an in-memory **cache** (like keeping frequently used tools on your desk) for speed, and persisted to disk as JSONL files. When a new message comes in, we load the session, append the message, and save it back. When the session gets too long — over 50 messages — we use the LLM to summarize old messages into a memory file and keep only the recent ones active.

**Follow-up probes:**
- Why JSONL instead of a database like SQLite or Postgres?
- What happens when two messages arrive simultaneously for the same user?
- How do you handle session cleanup for inactive users?

---

## Q8 — Why did you choose JSONL files for session storage?

**Why interviewers ask this:** They want to see you can justify technical trade-offs.

**Answer script:**
JSONL was a deliberate choice for simplicity. Each line is a valid JSON object, so the file is human-readable — you can literally `cat` a session file to see the conversation. It's append-friendly, which matches how messages arrive. There's no database dependency, which makes the project easy to set up. The tradeoff is that it doesn't scale well to many concurrent users — file locking and lack of indexing become problems. For a single-user tool, JSONL is the right balance of simplicity and functionality.

**Follow-up probes:**
- If you were scaling to 10,000 users, what would you switch to?
- How would you handle concurrent writes to the same session file?

---

## Q9 — What is memory consolidation and why does it exist?

**Why interviewers ask this:** LLM context window limits are a real engineering challenge.

**Answer script:**
LLMs have a fixed **context window** — think of it as a whiteboard that can only fit so much writing. If a conversation goes on for hundreds of messages, older ones fall off. Memory consolidation solves this: when the session exceeds 50 messages, the LLM summarizes older messages into a memory file that captures key facts. Only the most recent 25 messages stay active. The memory file gets injected into future prompts, so the agent remembers important context without needing every old message.

**Follow-up probes:**
- What's lost when you summarize messages?
- How do you decide what's "important" enough to keep in memory?
- Could you use embedding-based retrieval instead?

---

## Q10 — How does the system know what financial tools to use for a given query?

**Why interviewers ask this:** Tool routing is a key design challenge in agentic systems.

**Answer script:**
Before the LLM loop starts, there's a financial intent detection step — like a receptionist routing calls. It analyzes the user's message to figure out what kind of financial query it is — stock price, macro-economic indicators, prediction markets? Based on that, the system loads relevant cached data and adds routing hints to the prompt. The LLM then makes the final decision about which tools to call. So it's a two-stage process: a fast pre-filter narrows the options, and the LLM picks the exact tools.

**Follow-up probes:**
- What happens if the intent detector misclassifies a query?
- How would you improve the routing accuracy?
- Could the LLM handle routing alone without the pre-filter?

---

## Q11 — What is the Tool Registry and how does it work?

**Why interviewers ask this:** Plugin architectures are common in production systems.

**Answer script:**
The Tool Registry is a central menu where all available tools are registered by name. When the agent loop starts, tools like stock data fetchers and web search get registered. The LLM sees these tools as callable functions with descriptions and parameters. When the LLM wants to use one, it returns a tool call. The agent loop looks up the tool in the registry, executes it, and returns the result. New tools can be added without changing the agent loop — you just register them.

**Follow-up probes:**
- How do you handle tool errors or timeouts?
- What's the advantage of string-based registration versus a typed interface?
- Could you support MCP servers in this registry?

---

## Q12 — Why did you use the LLM as the router instead of hard-coding routing logic?

**Why interviewers ask this:** They want to understand why you chose flexibility over determinism.

**Answer script:**
Hard-coding routing means writing rules like "if the message contains a stock ticker, call the stock tool." That works for obvious cases, but financial queries are messy. A user might ask "how does Apple's revenue compare to global GDP trends?" — that requires both stock data and macro-economic data, and the routing logic would need to handle every combination. The LLM can reason about novel queries without code changes. The tradeoff is cost and latency, but the flexibility is worth it for diverse, unpredictable queries.

**Follow-up probes:**
- How would you add a fast path for common queries?
- What if the LLM routes to the wrong tool?
- How do you test LLM-based routing?

---

## Q13 — Walk me through what happens when a user sends "What's Tesla's P/E ratio?" on Telegram.

**Why interviewers ask this:** End-to-end traceability shows deep understanding.

**Answer script:**
First, the Telegram handler receives the message and pushes it onto the bus. The agent loop picks it up. Financial intent detection runs — it sees "Tesla" and "P/E ratio," classifies this as a stock metrics query, and loads any cached Tesla data. The **ContextBuilder** (the code that assembles the full prompt — system identity, memory, conversation history, and routing hints) sends everything to the LLM. The LLM decides to call the stock data tool with ticker TSLA and metric PE ratio. The tool fetches from Yahoo Finance, returns the number. The LLM formats it into a friendly response. The agent saves the conversation to the session, pushes the response onto the outbound queue, and Telegram sends it back to the user.

**Follow-up probes:**
- How long does this entire flow take end-to-end?
- What if Yahoo Finance is down — what happens?
- How would you add caching to speed this up for repeated queries?

---

## Q14 — How does the system handle multiple chat channels simultaneously?

**Why interviewers ask this:** Concurrency is a real engineering challenge.

**Answer script:**
Each channel runs its own async handler — Telegram polling, Discord WebSocket (a two-way communication channel that stays open — like a phone call vs sending a letter), Slack Socket Mode, and so on. They all push messages onto the same inbound queue. The agent loop processes messages sequentially by default, but the async nature of the queue means incoming messages aren't blocked by each other. The outbound dispatcher runs as a background task, picking up responses and routing them to the correct channel. So if a Telegram message and a Discord message come in at the same time, they queue up and get processed one at a time.

**Follow-up probes:**
- What's the bottleneck if one user's query takes 30 seconds?
- How would you make the agent process multiple messages in parallel?
- What happens if the Discord bot token expires mid-conversation?

---

## Q15 — What design patterns did you use and why?

**Why interviewers ask this:** Pattern recognition shows software engineering maturity.

**Answer script:**
Several key patterns, explained simply. **Producer-Consumer** for the message bus — channels produce messages, the agent consumes them, keeping them independent (like a post office where senders and receivers don't need to know each other). **Plugin architecture** for the tool registry — tools are registered dynamically, not hard-coded (like apps on your phone — you install what you need). **Observer pattern** for outbound dispatch — channels subscribe to message types and get notified (like subscribing to a newsletter). And the agent loop itself — a cycle of reason, act, observe, repeat.

**Follow-up probes:**
- Which pattern was hardest to implement?
- How would you refactor the financial pre-processing into a proper middleware chain?
- What patterns would you add for production?

---

## Q16 — How do you handle errors and edge cases in the agent loop?

**Why interviewers ask this:** Production readiness matters.

**Answer script:**
If a tool call fails, the error message gets fed back to the LLM, and the LLM can try a different approach or report the failure. There's a max iteration limit of 20 to prevent infinite loops. One area I'd improve is retry logic for transient failures — API rate limits, network timeouts — with **exponential backoff** (waiting longer after each failed attempt: 5 seconds, then 10, then 20). I'd also add a "max errors" threshold so the loop gives up gracefully.

**Follow-up probes:**
- What happens if the LLM API itself is down?
- How do you prevent a single bad user from crashing the whole system?
- How would you implement circuit breaker patterns?

---

## Q17 — What are the biggest limitations of your current architecture?

**Why interviewers ask this:** Self-awareness about weaknesses shows maturity.

**Answer script:**
Three main limitations. First, **scaling** — sessions are JSONL files, so concurrent users writing to the same file would cause issues. I'd switch to a real database. Second, **latency** — there's no streaming response, so users wait for the full answer before seeing anything. Third, **coupling** — financial-specific logic is embedded in the agent loop. If I wanted a generic agent, I'd need to refactor that into a pluggable **middleware** system (code that runs between other pieces — like a filter that processes data before the main system sees it).

**Follow-up probes:**
- Which limitation would you fix first if you had a week?
- How would you architect the system for 100x more users?
- What would you do differently if you started over?

---

## Q18 — How would you improve this system for production use at BNY Mellon?

**Why interviewers ask this:** They want to see you can bridge a personal project to enterprise requirements.

**Answer script:**
Several things. First, **security** — add API key authentication, user allowlists, and never expose stack traces to users. Second, **scalability** — replace JSONL with PostgreSQL, add connection pooling, and make the agent loop process messages concurrently. Third, **observability** — add structured logging, metrics, and tracing so you can monitor what's happening. Fourth, **compliance** — financial systems need audit trails, so every tool call and LLM response should be logged with timestamps. Fifth, **streaming responses** — users shouldn't wait 10 seconds for a long answer.

**Follow-up probes:**
- How would you implement audit logging for regulatory compliance?
- What's the first thing you'd deploy — and how would you test it?
- How do you handle secrets management in production?

---

## Q19 — Why did you build this as a Python project instead of Java or Node.js?

**Why interviewers ask this:** Technology choice reasoning matters, especially since BNY Mellon uses Java heavily.

**Answer script:**
Python was the right choice for three reasons. First, the AI/ML ecosystem is centered on Python — LLM libraries, financial data libraries like Yahoo Finance, and tooling like LiteLLM all have Python-first APIs. Second, async support with `asyncio` gives us the concurrency we need for the message bus. Third, rapid prototyping — this project needed fast iteration on the AI agent logic, and Python made that faster. That said, for a BNY Mellon production system, Java with Spring Boot would make more sense for enterprise requirements like type safety, performance, and existing team expertise.

**Follow-up probes:**
- What would a Java version of this look like?
- How would you handle the LLM integration in Java?
- What are the performance implications of Python here?

---

## Q20 — How does the financial caching system work and why is it important?

**Why interviewers ask this:** Caching is a critical optimization — like keeping frequently used tools on your desk instead of walking to the supply room every time.

**Answer script:**
When the agent fetches financial data, the result gets saved with metadata — ticker, query type, timestamp, and a summary. On subsequent queries about the same topic, the system checks the **cache** first. If fresh data exists, it's injected into the prompt so the LLM doesn't need to re-fetch it. The cache has a **TTL** (time-to-live — how long data stays fresh) so stale data expires. A stock price isn't cached because it changes every second, but a company's P/E ratio can be cached for hours. This saves API calls, reduces latency, and lowers costs.

**Follow-up probes:**
- How do you decide what to cache and what not to?
- What happens if the cache becomes stale and the user makes a decision based on it?
- How would you implement cache invalidation?

---

## Q21 — What are subagents and when would you use them?

**Why interviewers ask this:** Subagents show you understand task decomposition and parallelism.

**Answer script:**
Subagents are background workers spawned by the main agent to handle long-running tasks. If a user asks for a deep analysis of 10 stocks, the main agent can spawn a subagent to do the research in the background while it continues handling other users. The subagent runs its own tool calls and returns results when done. The tradeoff is added complexity around result delivery — you need to track when the subagent finishes and deliver results back to the right user.

**Follow-up probes:**
- How do you handle subagent failures?
- How do results get back to the original user?
- Could you use this pattern for the cron jobs?

---

## Q22 — How do you handle conversation context when the user switches topics?

**Why interviewers ask this:** Context management is nuanced.

**Answer script:**
The system handles this through memory consolidation. When a user switches topics — say from Tesla earnings to macro-economic trends — the agent still has access to recent conversation history and long-term memory. The LLM can see the user was previously discussing stocks and now is asking about broader market indicators. The financial intent detector classifies the new query independently, so the right tools get loaded regardless of what came before. If the user wants a clean slate, they can use the `/new` command.

**Follow-up probes:**
- What if the user asks "compare that to the S&P 500" — does the agent know what "that" refers to?
- How would you improve context switching for multi-user scenarios?

---

## Q23 — What would you do differently if you rebuilt this from scratch?

**Why interviewers ask this:** Reflection shows growth mindset.

**Answer script:**
Three things. First, I'd make the agent loop generic from day one — right now financial logic is baked in, but it should be a pluggable **middleware** system (code that runs between other pieces, like a filter) so the same agent could be used for legal research or medical queries. Second, I'd use SQLite or Postgres instead of JSONL — real applications need concurrent access. Third, I'd implement streaming from the start — waiting for the full LLM response before sending anything creates a poor user experience.

**Follow-up probes:**
- How would you design the middleware system?
- What's the biggest lesson you learned building this?
- If you had 3 months, what features would you add?

---

## Q24 — How does the cron/scheduling system work?

**Why interviewers ask this:** Background task management is important in production systems.

**Answer script:**
The cron system lets users schedule recurring tasks — like a daily market brief at 9 AM. Users can add, remove, enable, or disable scheduled jobs through the CLI. When a job fires, it creates a synthetic message as if the user sent it, routes it through the agent loop, and delivers the response to the user's channel. This means scheduled tasks go through the same reasoning and tool-calling pipeline as regular messages — no special logic needed.

**Follow-up probes:**
- What happens if a cron job fires while the system is restarting?
- How do you handle timezone differences?
- How would you add job retry on failure?

---

## Q25 — Why is the financial pre-processing step important?

**Why interviewers ask this:** They want to see you understand optimization in AI systems.

**Answer script:**
Without pre-processing, the LLM would have to figure out everything from scratch — what the user is asking about, which tools are relevant, what cached data exists. The pre-processing step does the heavy lifting quickly: it detects the financial intent, loads relevant cached data, and adds routing hints to the prompt. This means the LLM starts with context already loaded and can make better tool decisions faster. It's the difference between giving someone a map before a journey versus letting them wander aimlessly.

**Follow-up probes:**
- How accurate is the intent detection?
- Could you measure the token savings from pre-processing?
- What if the pre-processing step itself is slow?

---

## Q26 — How would you test this system?

**Why interviewers ask this:** Testing strategy reveals engineering discipline.

**Answer script:**
I'd use three layers. **Unit tests** for individual components — test the intent detector, test session persistence. **Integration tests** for the message bus flow — send a message through the bus, verify it arrives at the agent loop, verify the response goes to the right channel. And **end-to-end tests** with a mock LLM — simulate tool calls and verify the full pipeline. For the LLM itself, I'd use recorded responses so tests are deterministic.

**Follow-up probes:**
- How would you test the financial intent detector?
- What's the hardest component to test?
- How would you test the multi-channel routing?

---

## Q27 — What role does the ContextBuilder play?

**Why interviewers ask this:** Prompt engineering is a critical skill in AI systems.

**Answer script:**
The ContextBuilder assembles the full prompt sent to the LLM. It combines: the system prompt (who the agent is), bootstrap files that define personality, the user's long-term memory, recent conversation history, financial profile data, and the current message with routing hints. Without it, the LLM would have no memory, no personality, and no context — just a bare API call with no state.

**Follow-up probes:**
- How do you decide what goes in the system prompt vs. memory?
- What happens when the assembled prompt exceeds the token limit?
- How would you optimize prompt construction for cost?

---

## Q28 — How does the system handle a user who sends rapid consecutive messages?

**Why interviewers ask this:** Real-world usage patterns matter.

**Answer script:**
Right now, messages are processed sequentially. If a user sends three messages quickly, they queue up and get processed one at a time. The user might get responses out of order if the first query takes longer. A better approach would be to detect when messages arrive in rapid succession and combine them into a single context — or wait a short **debounce** window (a brief pause to collect rapid inputs before processing) before processing. I'd also add per-user **rate limiting** (a bouncer at a club — only letting in a certain number of requests per minute).

**Follow-up probes:**
- How would you implement message debouncing?
- What's the UX impact of sequential processing?
- How would you add rate limiting?

---

## Q29 — What is the MCP server connection and why did you include it?

**Why interviewers ask this:** They want to see you understand interoperability standards.

**Answer script:**
MCP — Model Context Protocol — is a standard for connecting AI agents to external tool servers. By supporting MCP, OpenClaw-Finance can connect to any MCP-compatible server at runtime, which means users can extend the agent with new tools without modifying the codebase. It's similar to the tool registry but follows an open standard, making the system more interoperable. The tradeoff is added complexity in connection management.

**Follow-up probes:**
- How does MCP differ from just registering a new tool?
- What's the security risk of connecting to unknown MCP servers?
- How would you authenticate MCP connections?

---

## Q30 — If you had to present this project to a BNY Mellon technical panel, what would you emphasize?

**Why interviewers ask this:** They want to see you can frame your work in the context of their business.

**Answer script:**
I'd emphasize three things. First, the agent loop pattern — iterative tool calling is exactly how enterprise AI systems are built for document processing, fraud detection, and risk analytics. Second, multi-channel architecture — the message bus means the same AI agent could serve internal Slack, client-facing chatbots, and automated email workflows simultaneously. Third, financial domain expertise — the intent detection, caching, and memory consolidation show I understand financial data's unique characteristics: it's time-sensitive, expensive to fetch, and requires audit trails.

**Follow-up probes:**
- How would you adapt this for BNY's compliance requirements?
- What would you change for an enterprise deployment?
- How does this align with BNY's cloud-first strategy?

---

## Summary

| Topic | Questions |
|-------|-----------|
| **Project Overview** | Q1, Q2, Q13 |
| **Agent Loop & Reasoning** | Q4, Q5, Q10, Q12 |
| **Message Bus & Async** | Q6, Q14, Q28 |
| **Session Management** | Q7, Q8, Q9, Q22 |
| **Design Decisions** | Q3, Q11, Q15, Q19, Q25, Q27, Q29 |
| **Limitations & Improvements** | Q16, Q17, Q18, Q23 |
| **Testing & Production** | Q20, Q21, Q24, Q26 |
| **BNY Context** | Q30 |

**Interviewer tip:** Use these questions in a 45-60 minute technical deep-dive. Start with Q1-Q3 for overview, then pick 5-7 questions from the middle sections based on the candidate's strengths. End with Q17 or Q23 for self-reflection, and Q30 for business context.
