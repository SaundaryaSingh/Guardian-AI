# OpenClaw-Finance: Core Architecture Analysis

## Table of Contents
1. [How the Agent Loop Works](#1-how-the-agent-loop-works)
2. [How the Message Bus Works](#2-how-the-message-bus-works)
3. [How Sessions Are Managed](#3-how-sessions-are-managed)
4. [CLI Commands Available](#4-cli-commands-available)
5. [How Components Connect](#5-how-components-connect)
6. [Key Design Decisions and Patterns](#6-key-design-decisions-and-patterns)
7. [Limitations and Areas for Improvement](#7-limitations-and-areas-for-improvement)

---

## 1. How the Agent Loop Works

**File:** `openclaw_finance/agent/loop.py`

Think of the agent loop as a **coffee shop barista**. A customer (user) places an order (sends a message), the barista looks at the order, decides what tools to use (espresso machine, steamer, etc.), makes the drink, and hands it back.

### Step-by-step breakdown:

**Step 1: Receive a message**
```
User sends message → Message arrives on the inbound queue → Agent loop picks it up
```

The `run()` method at line 290 is the main loop. It sits there like a patient shopkeeper, checking the inbound queue every 1 second for new messages. When a message arrives, it calls `_process_message()`.

**Step 2: Handle slash commands (quick exits)**
```
/new → Clear session, start fresh
/help → Show available commands  
/start → Introduce the bot, begin onboarding
```

Lines 352-380 handle these special commands before doing any real work.

**Step 3: Financial pre-processing (the "smart filter")**
```
Message comes in → Detect if it's about finance → Look up history and cached data → Add context
```

Lines 388-454: The agent has a "Financial Intent Detector" that figures out what the user wants (stock price? economic analysis? meme coins?). It then:
- Checks if the user has a finance profile (investor type, preferences)
- Looks up relevant financial history from past conversations
- Checks a data cache for previously fetched/researched data
- Adds routing hints (tells the LLM which tools to use)

**Step 4: Build the prompt**
```
System prompt (who am I?) + Memory (what do I remember?) + History + Current message → Full prompt
```

The `ContextBuilder` (line 86, `agent/context.py`) assembles everything:
- Identity: "You are OpenClaw-Finance, a financial analysis expert"
- Bootstrap files: AGENTS.md, SOUL.md, USER.md, TOOLS.md
- Long-term memory from MEMORY.md
- Conversation history (last 50 messages by default)
- Skills the agent can use

**Step 5: The iteration loop (the real magic)**
```
While iterations < max (20):
    1. Send messages to LLM
    2. LLM responds with either:
       a. "Call this tool with these arguments" → Execute tool → Feed result back → Repeat
       b. "Here's my answer" → Done! Return the response
    3. If max iterations hit → Force a final summary response
```

This is at lines 209-288 (`_run_agent_loop`). The key insight: **the LLM decides what to do**. The agent loop just executes. The LLM can call tools, get results, and decide it needs more tools — up to 20 times before being forced to give a final answer.

**Step 6: Save and respond**
```
Save messages to session → Record to financial history/cache → Send response back through bus
```

Lines 465-538: The conversation is saved, financial data is cached for future reuse, and the response goes back through the message bus.

### The big picture flow:

```
Message arrives → Slash command? → Financial context? → Build prompt →
LLM loop (call tools, get answers) → Save session → Return response
```

---

## 2. How the Message Bus Works

**Files:** `openclaw_finance/bus/events.py` and `queue.py`

Think of the message bus as a **postal system** for the application. It has two mailboxes: one for incoming mail, one for outgoing mail.

### The Events (Data Types)

**InboundMessage** (what comes in):
- `channel`: Where it came from (telegram, discord, slack, whatsapp, cli)
- `sender_id`: Who sent it
- `chat_id`: Which chat room
- `content`: The actual text
- `media`: Optional image URLs
- `metadata`: Extra channel-specific data

**OutboundMessage** (what goes out):
- `channel`: Where to send it
- `chat_id`: Which chat room
- `content`: The response text
- `reply_to`: Optional threading
- `metadata`: Extra data (e.g., Slack thread_ts)

### The Queue (MessageBus)

```python
class MessageBus:
    inbound: asyncio.Queue[InboundMessage]   # Messages coming IN
    outbound: asyncio.Queue[OutboundMessage]  # Messages going OUT
    _outbound_subscribers: dict  # Channel-specific handlers
```

**How it works:**

1. **Publishing inbound:** A Telegram handler, Discord handler, etc. pushes a message onto `inbound`
2. **Consuming inbound:** The agent loop calls `consume_inbound()` which waits (async) until something is in the queue
3. **Publishing outbound:** Agent pushes a response onto `outbound`
4. **Dispatching outbound:** A background task (`dispatch_outbound()`) picks up outbound messages and routes them to the correct channel subscriber

**The subscriber system** (lines 41-49): Channels register callbacks:
```python
bus.subscribe_outbound("telegram", telegram_send_function)
bus.subscribe_outbound("discord", discord_send_function)
```
When a message for "telegram" arrives on the outbound queue, the Telegram callback gets called.

**Key design point:** The bus is **async** and **decoupled**. The agent doesn't know or care whether it's talking to Telegram, Discord, or a CLI. It just pushes/pops from queues. This is a classic **producer-consumer** pattern.

### The dispatcher loop:

```python
async def dispatch_outbound(self):
    while self._running:
        msg = await self.outbound.get()  # Wait for response
        for callback in subscribers[msg.channel]:
            await callback(msg)  # Send to the right channel
```

It checks every 1 second (via `asyncio.wait_for` with timeout). This prevents busy-waiting while staying responsive.

---

## 3. How Sessions Are Managed

**File:** `openclaw_finance/session/manager.py`

Think of sessions as **notebooks** for each conversation. Each chat with each user gets their own notebook.

### Session (the Notebook)

```python
class Session:
    key: str                    # "telegram:12345" or "discord:server-channel"
    messages: list[dict]        # All messages in this conversation
    created_at: datetime
    updated_at: datetime
    last_consolidated: int      # How many messages already summarized to files
```

**Key properties:**
- `key`: Format is `channel:chat_id`. A Telegram user with ID 12345 gets key `telegram:12345`. This is how the system knows which conversation is which.
- `messages`: A list of dicts with `role`, `content`, `timestamp`, and optionally `tools_used`.
- `last_consolidated`: Tracks which messages have already been summarized into long-term memory (to avoid re-summarizing).

### SessionManager (the Librarian)

```python
class SessionManager:
    workspace: Path
    sessions_dir: Path          # ~/.openclaw-finance/sessions/
    _cache: dict[str, Session]  # In-memory cache for fast access
```

**How it works:**

1. **Get or create** (line 72): Check the cache first. If not cached, load from disk. If not on disk, create new.
2. **Load from disk** (line 92): Sessions are stored as JSONL files (one JSON object per line). The first line is metadata, rest are messages. This format is:
   - Human-readable (just JSON)
   - Append-friendly
   - Easy to grep/search
3. **Save to disk** (line 131): Overwrites the file with current metadata + all messages.
4. **Invalidate** (line 149): Removes from cache (e.g., after `/new` command clears a session).

**Why JSONL?** It's simpler than a database, version-control friendly, and easy to debug. You can literally `cat` a session file to see what happened.

### Memory Consolidation (lines 583-690 of loop.py)

This is the clever part. When a session gets too long (over 50 messages):

```
Too many messages → LLM summarizes old messages → Updates MEMORY.md → Keeps recent messages
```

It uses the LLM itself to:
1. Write a history entry to HISTORY.md (grep-searchable log)
2. Update MEMORY.md with new facts learned about the user
3. Compress old messages out of the session (keeps last 25 messages active)

There's also **financial history consolidation** (line 672): when financial analysis history exceeds 10KB, it gets compressed too.

---

## 4. CLI Commands Available

**File:** `openclaw_finance/cli/commands.py`

### Top-level commands:

| Command | What it does |
|---------|-------------|
| `openclaw-finance onboard` | Set up config, workspace, template files |
| `openclaw-finance agent` | Chat with the agent (single message or interactive) |
| `openclaw-finance gateway` | Start the full server (all channels, cron, heartbeat) |
| `openclaw-finance status` | Show config, API keys, channel status |
| `openclaw-finance --version` | Show version |

### Channel commands (`openclaw-finance channels`):

| Command | What it does |
|---------|-------------|
| `channels status` | Show which channels are enabled (Telegram, Discord, etc.) |
| `channels login` | Link WhatsApp via QR code |

### Cron commands (`openclaw-finance cron`):

| Command | What it does |
|---------|-------------|
| `cron list` | Show scheduled jobs |
| `cron add` | Create a new scheduled job |
| `cron remove` | Delete a job |
| `cron enable/disable` | Toggle a job on/off |
| `cron run` | Manually trigger a job |

### Provider commands (`openclaw-finance provider`):

| Command | What it does |
|---------|-------------|
| `provider login openai-codex` | OAuth login for OpenAI Codex |

### Agent chat modes:

**Single message mode:**
```bash
openclaw-finance agent -m "What's Apple's P/E ratio?"
```

**Interactive mode:**
```bash
openclaw-finance agent
# Then type messages in a loop, type "exit" to quit
```

The interactive mode uses `prompt_toolkit` for nice terminal features: history (up/down arrows), paste support, and clean display.

### Gateway mode (the big one):

```bash
openclaw-finance gateway --port 18790
```

This starts everything: agent loop, all configured channels (Telegram, Discord, WhatsApp, Slack, etc.), cron scheduler, and heartbeat service. It's the production deployment mode.

---

## 5. How Components Connect

Here's the big picture:

```
┌─────────────────────────────────────────────────────────┐
│                     CLI (commands.py)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  onboard  │  │  agent   │  │ gateway  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└───────────────┬─────────────────┬───────────────────────┘
                │                 │
                ▼                 ▼
┌───────────────────────────────────────────────────────────┐
│                    MessageBus (queue.py)                    │
│  ┌─────────────┐                    ┌──────────────┐      │
│  │  inbound Q   │ ──────────────── │  outbound Q   │      │
│  └──────┬──────┘                    └──────┬───────┘      │
│         │                                   │              │
│         ▼                                   ▼              │
│  ┌─────────────────┐            ┌────────────────────┐    │
│  │  ChannelManager  │ ◄──────── │  Channel Handlers  │    │
│  │                  │            │  (Telegram, Discord,│    │
│  │  (routes msgs)   │            │   WhatsApp, Slack)  │    │
│  └─────────────────┘            └────────────────────┘    │
└───────────────┬───────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────┐
│                   AgentLoop (loop.py)                       │
│                                                           │
│  1. consume_inbound() ← picks up messages                 │
│  2. _process_message() ← main handler                     │
│     ├── Slash commands (/new, /help, /start)              │
│     ├── Financial intent detection                        │
│     ├── Context building (memory + history + profile)     │
│     ├── _run_agent_loop() ← LLM + tool execution         │
│     │   ├── Call LLM with messages                        │
│     │   ├── If tool_call → execute tool → loop            │
│     │   └── If text response → return                     │
│     ├── Save to session                                   │
│     └── Record to financial history/cache                 │
│  3. publish_outbound() → sends response back              │
└───────────┬───────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────┐
│                    ToolRegistry (registry.py)               │
│                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ File ops │ │  Shell   │ │   Web    │ │ Financial│    │
│  │          │ │  exec    │ │  search  │ │  tools   │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │ Message  │ │  Spawn   │ │   Cron   │                 │
│  └──────────┘ └──────────┘ └──────────┘                 │
└───────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────┐
│                 SessionManager (manager.py)                 │
│                                                           │
│  ~/.openclaw-finance/sessions/                            │
│  ├── telegram_12345.jsonl                                 │
│  ├── discord_server_channel.jsonl                         │
│  └── cli_direct.jsonl                                     │
│                                                           │
│  In-memory cache → Disk (JSONL files)                     │
└───────────────────────────────────────────────────────────┘
```

### Data flow for a typical message:

1. **User types in Telegram:** "What's Tesla's P/E ratio?"
2. **Telegram handler** creates `InboundMessage(channel="telegram", sender_id="...", content="What's Tesla's P/E ratio?")`
3. **MessageBus** puts it on the inbound queue
4. **AgentLoop** picks it up
5. **Financial intent detector** recognizes "Tesla" → identifies tickers, intent type
6. **ContextBuilder** loads system prompt + memory + history + current message
7. **LLM** receives the prompt and decides to call `financial_metrics(ticker="TSLA", metrics=["pe_ratio"])`
8. **ToolRegistry** executes the financial metrics tool, which calls an API
9. **Result** comes back, LLM formats it into a friendly response
10. **AgentLoop** saves the conversation to the session
11. **OutboundMessage** goes on the outbound queue
12. **ChannelManager** dispatches to the Telegram handler
13. **Telegram** sends the response back to the user

---

## 6. Key Design Decisions and Patterns

### Pattern 1: Producer-Consumer with Message Bus

**Why:** Decouples channels from the agent core. You can add new channels (Slack, WhatsApp, etc.) without changing the agent code at all. Just create a handler that pushes messages to the bus.

**Trade-off:** Adds complexity for simple use cases (CLI could talk directly to the agent).

### Pattern 2: LLM as the Router (Dexter Pattern)

**Why:** Instead of hard-coding routing logic ("if stock query → do this"), the LLM decides which tools to call. Financial tools are registered as "LLM sub-agent routers" (line 162-179) — they use a separate LLM call to figure out the best approach.

**Trade-off:** More expensive (extra LLM calls), but much more flexible. The LLM can handle novel queries without code changes.

### Pattern 3: Session + Memory Consolidation

**Why:** LLMs have limited context windows. You can't keep all conversation history. The consolidation pattern:
- Keep recent messages in the session (active context)
- Summarize old messages into MEMORY.md (long-term facts)
- Log key events to HISTORY.md (grep-searchable)

**Trade-off:** You lose exact wording but gain the ability to have very long conversations.

### Pattern 4: Financial Caching

**Why:** Financial data is expensive to fetch and slow to compute. The system caches:
- Raw analysis results to files
- An index with metadata (ticker, intent type, query, summary)
- Financial history for pattern recognition

**Trade-off:** Stale data risk. If a user asks about Tesla's stock price, cached data from yesterday is useless. The system handles this by not caching price queries (line 485-486).

### Pattern 5: Tool Registry (Plugin Architecture)

**Why:** Tools can be registered/unregistered dynamically. MCP (Model Context Protocol) servers can be connected at runtime. This makes the system extensible.

**Trade-off:** No type safety — tools are registered by string name, errors are runtime not compile-time.

### Pattern 6: Financial Intent Detection Pre-hook

**Why:** Instead of letting the LLM figure out everything from scratch, the system pre-processes:
- Detects financial intent (stock, crypto, macro, meme, prediction market)
- Loads relevant cached data
- Adds routing hints to the prompt

**Trade-off:** Adds latency but significantly improves accuracy and reduces token usage.

### Pattern 7: JSONL for Sessions

**Why:** Simple, human-readable, append-friendly. No database dependency. Easy to debug with `cat` or `grep`.

**Trade-off:** Not efficient for large sessions. No indexing. Searching requires reading the whole file.

### Pattern 8: Subagents for Background Work

**Why:** Some tasks take a long time (web scraping, complex analysis). The `spawn` tool creates subagent workers that can run in the background while the main agent continues.

**Trade-off:** Adds complexity around result delivery and error handling.

---

## 7. Limitations and Areas for Improvement

### 1. No Persistent Session Storage at Scale

**Current:** Sessions are JSONL files in `~/.openclaw-finance/sessions/`. For a single user, this works fine. For hundreds of concurrent users (e.g., a Telegram bot serving many people), this becomes problematic:
- File locking issues
- No concurrent access protection
- No efficient querying

**Suggestion:** Use SQLite or PostgreSQL for production deployments. The JSONL format is great for development and single-user mode.

### 2. Memory Window is Fixed

**Current:** `memory_window=50` means the LLM sees the last 50 messages. This is hardcoded at initialization.

**Suggestion:** Make this dynamic based on:
- Token count (not message count — a 50-message conversation with long tool results could exceed context)
- User preferences (some users want more context, others want less)

### 3. No Error Recovery in Agent Loop

**Current:** If the LLM returns an error or unexpected response, the loop tries to continue. But there's no retry logic for transient failures (API rate limits, network issues).

**Suggestion:** Add exponential backoff for API errors. Add a "max errors" threshold before giving up.

### 4. Financial Pre-processing is Tightly Coupled

**Current:** The agent loop directly calls financial intent detection, profile management, history, and cache (lines 388-530). This is ~140 lines of financial-specific code in what should be a general-purpose agent loop.

**Suggestion:** Extract this into a middleware/hook system. The agent loop should be generic; financial logic should be pluggable.

### 5. No Streaming Responses

**Current:** The agent waits for the full LLM response before sending anything back. For long responses, the user sees nothing for seconds.

**Suggestion:** Implement streaming (SSE or WebSocket) so users see text as it's generated. This is especially important for chat interfaces.

### 6. Tool Execution is Sequential

**Current:** When the LLM requests multiple tool calls in one response (lines 252-261), they're executed sequentially. If the LLM asks for 3 independent web searches, they run one after another.

**Suggestion:** Use `asyncio.gather()` for independent tool calls. This could significantly speed up multi-tool queries.

### 7. No Authentication/Authorization on the Gateway

**Current:** The gateway accepts messages from any channel without authentication. If you expose port 18790, anyone can talk to your agent.

**Suggestion:** Add API key authentication for the HTTP gateway. Add user allowlists for Telegram/Discord.

### 8. Session Files Grow Unbounded

**Current:** When memory consolidation runs, old messages are "removed" but the JSONL file is rewritten each time (line 131-146). If consolidation fails or is skipped, the file grows indefinitely.

**Suggestion:** Add file size monitoring. Add a fallback cleanup mechanism. Consider archiving old sessions to a separate directory.

### 9. No Graceful Shutdown for Cron Jobs

**Current:** When the agent stops, cron jobs in progress may be interrupted. The `cron.stop()` is called but there's no wait for running jobs.

**Suggestion:** Track running jobs and wait for them to complete (with a timeout) before shutting down.

### 10. Error Messages Leak Implementation Details

**Current:** Error responses like "Sorry, I encountered an error: [traceback]" go directly to the user (line 308-312).

**Suggestion:** Log detailed errors internally, send user-friendly messages externally. Never expose stack traces to end users.

---

## Summary

OpenClaw-Finance is a well-structured financial AI assistant built on these core ideas:

1. **Message Bus** decouples channels from the agent (producer-consumer pattern)
2. **Agent Loop** runs an LLM-powered reasoning cycle with tool use (up to 20 iterations)
3. **Sessions** track conversations per user per channel (JSONL files with in-memory cache)
4. **Financial Intelligence** adds domain-specific pre/post processing (intent detection, caching, history)
5. **Tool Registry** provides a plugin system for extensible capabilities
6. **Memory Consolidation** uses the LLM itself to summarize conversations into long-term memory

The architecture is clean, modular, and beginner-friendly. The main areas for growth are production scalability (concurrent users, streaming, error recovery) and coupling (financial logic is embedded in the core loop rather than being pluggable).
