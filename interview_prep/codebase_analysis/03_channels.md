# Channel Integrations - Complete Analysis

## Overview

OpenClaw-Finance supports **9 chat platforms** through a unified channel abstraction. Each channel is a separate module that translates platform-specific protocols into a common format, allowing the agent to send/receive messages without knowing which platform the user is on.

```
User on Telegram ──> TelegramChannel ──> MessageBus ──> Agent
User on Discord  ──> DiscordChannel  ──> MessageBus ──> Agent
User on WhatsApp ──> WhatsAppChannel ──> Node.js Bridge ──> MessageBus ──> Agent
...
```

---

## 1. The Base Channel Interface (`base.py`)

Every channel inherits from `BaseChannel`. This is the contract all channels must follow.

### Three Required Methods

| Method | Purpose |
|--------|---------|
| `start()` | Connect to the platform, start listening for messages. Runs forever. |
| `stop()` | Disconnect cleanly, release resources. |
| `send(msg)` | Send an outbound message through the platform's API. |

### The `_handle_message()` Pipeline

This is the core method that every channel calls when a user sends a message. It does two things:

1. **Permission check** - Calls `is_allowed(sender_id)` to verify the sender is authorized
2. **Publish to bus** - Wraps the message in an `InboundMessage` and publishes it to the `MessageBus`

```python
# Simplified flow inside any channel:
async def _on_message(user, text):
    await self._handle_message(
        sender_id=user.id,
        chat_id=chat.id,
        content=text,
    )
    # Inside _handle_message:
    #   1. Check is_allowed(sender_id)
    #   2. Create InboundMessage
    #   3. bus.publish_inbound(msg)
```

### The `is_allowed()` Method

This is the security gate. It checks the sender's ID against a configured allowlist:

- If `allow_from` is empty in config, **everyone is allowed** (open mode)
- If `allow_from` has entries, only those IDs are permitted
- Supports compound IDs with `|` separator (e.g., `12345|username` for Telegram which packs user ID and username together)

### Key Design Insight

The base class doesn't know anything about Telegram, Discord, or any platform. It only knows:
- "I received a message from sender X in chat Y with content Z"
- "Is sender X allowed?"
- "Publish this to the message bus"

This is the **Strategy Pattern** - each channel is a different strategy for the same problem.

---

## 2. The Channel Manager (`manager.py`)

The `ChannelManager` is the orchestrator. It coordinates all channels.

### Initialization (`_init_channels`)

Reads the config and creates channel instances for each enabled platform:

```
For each channel type in config:
  1. Check if enabled
  2. Try to import the channel class
  3. Create an instance with (config, bus)
  4. Store it in self.channels["name"]
```

Uses lazy imports (`from ... import ...` inside `if` blocks) so disabled channels don't pull in unused dependencies. If an import fails (e.g., `discord.py` not installed), it logs a warning and continues.

### Starting Channels (`start_all`)

Launches all channels concurrently using `asyncio.create_task()`:

```python
# Start outbound dispatcher (listens for messages TO send)
self._dispatch_task = asyncio.create_task(self._dispatch_outbound())

# Start all channel listeners (each runs forever)
tasks = [asyncio.create_task(ch.start()) for ch in channels]
await asyncio.gather(*tasks)
```

Each channel runs as an independent async task. If one crashes, the others keep running.

### The Outbound Dispatcher (`_dispatch_outbound`)

This is the other half of the message flow. When the agent produces a response, it goes to the outbound queue. The dispatcher:

1. Waits for a message from `bus.consume_outbound()`
2. Looks up the target channel by name
3. Calls `channel.send(msg)`

It runs in an infinite loop with a 1-second timeout on queue consumption, so it can be cleanly cancelled.

### Message Flow Summary

```
Inbound:  Platform -> Channel.start() -> Channel._handle_message() -> Bus.publish_inbound()
Outbound: Agent -> Bus.publish_outbound() -> Manager._dispatch_outbound() -> Channel.send()
```

---

## 3. All 9 Channels Deep Dive

### 3.1 Telegram (`telegram.py`)

**Protocol:** Long polling via `python-telegram-bot` library

**Setup:**
- Requires a bot token from @BotFather
- Optional proxy support for regions where Telegram is blocked
- Uses long polling (no public IP/webhook needed)

**Key Features:**
- **Typing indicators** - Sends "typing..." action every 4 seconds while processing
- **Markdown-to-HTML conversion** - Agent outputs markdown, Telegram channel converts to Telegram-safe HTML
- **Message splitting** - Long messages (>4000 chars) split at line breaks
- **Media handling** - Downloads photos, voice, audio, documents to `~/.openclaw-finance/media/`
- **Voice transcription** - Voice messages transcribed via Groq API before sending to agent
- **Bot commands** - Registers `/start`, `/new`, `/help` in Telegram's command menu
- **Sender ID format** - `"{user_id}|{username}"` to support allowlist matching by either

**Connection pool:** 16 connections, 30s timeouts, configured via `HTTPXRequest`

### 3.2 Discord (`discord.py`)

**Protocol:** WebSocket Gateway (Discord's real-time event stream) + REST API for sending

**Setup:**
- Requires a bot token from Discord Developer Portal
- Connects to `wss://gateway.discord.gg/` 
- Must send IDENTIFY payload with bot token and intents

**Key Features:**
- **Gateway protocol** - Implements Discord's opcode system (HELLO, IDENTIFY, HEARTBEAT, RECONNECT, INVALID_SESSION)
- **Auto-reconnect** - Reconnects on gateway errors with 5-second delay
- **Heartbeat loop** - Keeps connection alive per Discord's required interval
- **Attachment handling** - Downloads files up to 20MB, saves locally
- **Reply support** - Can reply to specific messages via `message_reference`
- **Rate limiting** - Handles 429 responses with retry-after
- **Typing indicator** - Periodic typing via REST API every 8 seconds
- **Bot filtering** - Ignores messages from other bots

**Intents:** Configurable via `config.intents` (what events the bot subscribes to)

### 3.3 Slack (`slack.py`)

**Protocol:** Socket Mode (WebSocket connection, no public endpoint needed)

**Setup:**
- Requires both `bot_token` (for API calls) and `app_token` (for Socket Mode)
- Only supports `mode: "socket"`

**Key Features:**
- **Socket Mode** - Uses Slack's Socket Mode instead of HTTP webhooks, so no public URL needed
- **Duplicate prevention** - Slack sends both `message` and `app_mention` for @mentions; the channel detects this and prefers `app_mention`
- **Thread support** - Replies in threads for channel messages, but not for DMs
- **Mention stripping** - Removes `<@bot_user_id>` from incoming text
- **Reaction emoji** - Adds :eyes: reaction when receiving a message (acknowledgment)
- **Markdown conversion** - Uses `slackify_markdown` library + custom table-to-list conversion
- **Group vs DM policies** - Separate policies for DMs (`dm.policy`) and group channels (`group_policy`)
  - `open` - respond to everything
  - `mention` - only respond when @mentioned
  - `allowlist` - only respond in specific channels

### 3.4 WhatsApp (`whatsapp.py` + Node.js bridge)

**Protocol:** WebSocket connection to a local Node.js bridge process

**Setup:**
- Requires running a separate Node.js bridge process
- Bridge connects to WhatsApp Web via Baileys library
- Python connects to bridge via WebSocket on `127.0.0.1`
- Optional `bridge_token` for authentication

**Key Features:**
- **Dual process architecture** - Python channel + Node.js bridge (explained in detail in Section 5)
- **QR code auth** - First connection requires scanning QR code in terminal
- **Auto-reconnect** - Both Python side and Node.js side reconnect independently
- **Simple message format** - Sends/receives plain JSON over WebSocket
- **Voice message handling** - Currently shows "[Voice Message]" placeholder (transcription not yet supported for WhatsApp)

**Communication protocol between Python and Node.js:**
```
Python -> Node: {"type": "send", "to": "<phone>@s.whatsapp.net", "text": "..."}
Node -> Python: {"type": "message", "sender": "...", "content": "...", "pn": "..."}
Node -> Python: {"type": "status", "status": "connected"|"disconnected"}
Node -> Python: {"type": "qr", "qr": "<qr_data>"}
```

### 3.5 Feishu/Lark (`feishu.py`)

**Protocol:** WebSocket long connection via `lark-oapi` SDK

**Setup:**
- Requires `app_id` and `app_secret` from Feishu Open Platform
- Bot capability must be enabled
- Event subscription: `im.message.receive_v1`

**Key Features:**
- **WebSocket long connection** - No public IP or webhook required
- **Thread bridging** - Feishu SDK runs in a separate thread, communicates with async Python via `asyncio.run_coroutine_threadsafe()`
- **Rich text parsing** - Handles Feishu's post (rich text) format with nested JSON structures
- **Card messages** - Sends responses as interactive cards with markdown + table support
- **Deduplication** - Maintains an `OrderedDict` of processed message IDs (capped at 1000)
- **Reaction acknowledgment** - Adds THUMBSUP emoji to received messages
- **Table rendering** - Parses markdown tables and converts them to Feishu card table elements
- **Heading splitting** - Splits content by headings for better card layout
- **Chat type handling** - Different behavior for `p2p` (direct) vs `group` chats
- **receive_id_type detection** - Auto-detects whether `chat_id` is `open_id` or `chat_id` based on prefix

### 3.6 DingTalk (`dingtalk.py`)

**Protocol:** Stream Mode via `dingtalk-stream` SDK (WebSocket) + HTTP API for sending

**Setup:**
- Requires `client_id` and `client_secret` from DingTalk Open Platform
- Uses `dingtalk-stream` SDK for receiving messages

**Key Features:**
- **Stream Mode** - Uses DingTalk's streaming protocol for real-time message delivery
- **Access token management** - Automatically refreshes OAuth2 tokens before expiry (with 60s safety margin)
- **Private chat only** - Currently only supports 1:1 chat (group messages replied as private)
- **Background task management** - Stores references to background tasks to prevent garbage collection
- **Error resilience** - Returns `AckMessage.STATUS_OK` even on errors to avoid DingTalk's retry loop
- **SDK callback handler** - Custom `OpenClawDingTalkHandler` class wraps DingTalk's `CallbackHandler`
- **Reconnect loop** - Auto-reconnects on stream errors with 5-second delay

### 3.7 Email (`email.py`)

**Protocol:** IMAP (inbound) + SMTP (outbound)

**Setup:**
- Requires IMAP credentials (host, username, password) for reading
- Requires SMTP credentials (host, username, password) for sending
- Requires explicit `consent_granted=true` flag (ethical safeguard)

**Key Features:**
- **Polling mode** - Checks for unread emails every N seconds (configurable, minimum 5s)
- **Consent requirement** - Won't start unless `consent_granted` is explicitly `true`
- **Auto-reply control** - Can be disabled via `auto_reply_enabled`
- **Subject threading** - Tracks last subject per sender for proper "Re:" prefixes
- **In-Reply-To headers** - Sets proper email threading headers
- **HTML-to-text conversion** - Strips HTML tags, converts `<br>` and `<p>` to newlines
- **Multi-part emails** - Prefers plain text, falls back to HTML conversion
- **UID deduplication** - Tracks processed message UIDs (capped at 100,000)
- **Date range queries** - Can fetch messages between dates for historical summarization
- **SSL/TLS options** - Supports plain, STARTTLS, and SSL connections
- **Mark as seen** - Optionally marks processed emails as read

### 3.8 QQ (`qq.py`)

**Protocol:** WebSocket via `botpy` SDK (Tencent's official QQ bot library)

**Setup:**
- Requires `app_id` and `secret` from QQ Open Platform

**Key Features:**
- **botpy SDK** - Uses Tencent's official Python SDK for QQ bots
- **C2C messages** - Handles customer-to-customer (private) messages
- **Direct messages** - Also handles direct message events
- **Dynamic bot class** - Creates a `botpy.Client` subclass at runtime with channel reference
- **Deduplication** - Uses a deque (capped at 1000) for message ID tracking
- **Auto-reconnect** - Reconnects on errors with 5-second delay

### 3.9 Mochat (`mochat.py`)

**Protocol:** Socket.IO (WebSocket) with HTTP polling fallback

**Setup:**
- Requires `claw_token` for authentication
- Connects to Mochat platform (custom chat platform)

**Key Features:**
- **Dual transport** - Tries Socket.IO WebSocket first, falls back to HTTP polling
- **Session + Panel** - Two conversation types: sessions (1:1) and panels (group/channel)
- **Auto-discovery** - Can auto-discover sessions and panels via API
- **Cursor persistence** - Saves session cursors to disk so it remembers where it left off
- **Message buffering/delay** - Can buffer messages and send them as a batch (configurable delay)
- **Mention detection** - Complex logic to detect if the bot was @mentioned
- **Per-group mention policy** - Different groups can have different mention requirements
- **Message deduplication** - Uses a seen-set per target with max 2000 entries
- **Fallback workers** - When WebSocket fails, starts HTTP polling workers per session/panel
- **Target resolution** - Parses target strings with prefixes like `mochat:`, `group:`, `panel:`, `session_`
- **Refresh loop** - Periodically refreshes session/panel lists from API

---

## 4. The WhatsApp Node.js Bridge

### Why a Separate Process?

The WhatsApp bridge is the most architecturally interesting channel. It runs as a **separate Node.js process** that communicates with the Python backend via WebSocket.

**Reason: Baileys is a Node.js library.**

The `@whiskeysockets/baileys` library is the most reliable open-source implementation of the WhatsApp Web protocol. It's written in TypeScript/JavaScript. There's no mature Python equivalent that handles:
- Multi-device auth state management
- Signal protocol encryption keys
- QR code generation and session persistence
- Reconnection logic

Rather than reimplementing all this in Python, the project uses a **bridge pattern**:
- Node.js handles all WhatsApp protocol complexity
- Python handles business logic and agent integration
- They communicate via a simple JSON-over-WebSocket protocol

### Bridge Architecture

```
┌─────────────────────────────────────────────────────┐
│  Node.js Bridge Process                             │
│                                                     │
│  index.ts ──> server.ts ──> whatsapp.ts             │
│                (WS server)    (Baileys client)       │
│                     │                                │
│              ws://127.0.0.1:3001                     │
└─────────────────────┬───────────────────────────────┘
                      │ WebSocket (localhost only)
┌─────────────────────┴───────────────────────────────┐
│  Python Process                                     │
│                                                     │
│  WhatsAppChannel (whatsapp.py)                      │
│    └─> connects to bridge via WebSocket             │
│    └─> sends/receives JSON messages                 │
│    └─> feeds into MessageBus                        │
└─────────────────────────────────────────────────────┘
```

### Security: Localhost Only

The bridge server **binds to 127.0.0.1** only (`bridge/src/server.ts:29`):

```typescript
this.wss = new WebSocketServer({ host: '127.0.0.1', port: this.port });
```

This means:
- No external network access to the bridge
- Only the local Python process can connect
- Optional token authentication adds another layer

### Bridge Authentication Flow

If `BRIDGE_TOKEN` is set:

1. Python connects to WebSocket
2. Has 5 seconds to send `{"type": "auth", "token": "..."}` as first message
3. If token matches, connection is accepted
4. If not, connection is closed immediately

### WhatsApp Connection Flow

1. Node.js bridge starts, creates Baileys socket
2. First time: displays QR code in terminal for user to scan
3. Credentials saved to `~/.openclaw-finance/whatsapp-auth/`
4. Subsequent starts: loads saved credentials, no QR needed
5. If logged out, reconnects after 5 seconds

---

## 5. Message Routing - End to End

### Inbound Path (User -> Agent)

```
1. User sends message on platform (e.g., Telegram)
2. Platform delivers to channel's event handler
   - Telegram: python-telegram-bot's MessageHandler
   - Discord: Gateway WebSocket MESSAGE_CREATE event
   - Slack: Socket Mode events_api
   - etc.
3. Channel's _on_message() handler is called
4. Handler extracts: sender_id, chat_id, content, media, metadata
5. Handler calls self._handle_message()
6. _handle_message() calls is_allowed(sender_id) for security check
7. If allowed: creates InboundMessage, publishes to bus
8. Agent's event loop picks up from bus, processes, generates response
```

### Outbound Path (Agent -> User)

```
1. Agent generates response, creates OutboundMessage
2. Agent publishes to bus via bus.publish_outbound()
3. ChannelManager._dispatch_outbound() picks up message
4. Dispatcher looks up channel by msg.channel name
5. Calls channel.send(msg)
6. Channel translates to platform-specific format:
   - Telegram: HTML-formatted message, split if >4000 chars
   - Discord: REST API POST to /channels/{id}/messages
   - Slack: chat_postMessage with mrkdwn format
   - Feishu: Interactive card with markdown elements
   - Email: SMTP send with proper threading headers
   - etc.
7. Platform delivers message to user
```

---

## 6. Security Considerations

### Access Control (`allowFrom`)

Every channel inherits the `is_allowed()` method from `BaseChannel`:

- **Per-channel allowlists** - Each channel has its own `allow_from` config
- **Empty list = open** - If no allowlist, everyone can use the bot
- **Compound IDs** - Telegram uses `"user_id|username"` format for flexible matching
- **Slack has extra layers** - Separate DM policy and group policy with mention/allowlist modes
- **Mochat has per-group policies** - Different groups can have different mention requirements

### Email Consent

The email channel has an explicit `consent_granted` flag:
- Won't start without it
- Won't send without it
- This is an ethical safeguard against reading emails without permission

### WhatsApp Bridge Security

- Binds to `127.0.0.1` only (no external access)
- Optional token authentication
- Auth timeout (5 seconds)
- Credentials stored locally in `~/.openclaw-finance/whatsapp-auth/`

### Bot Self-Messaging Prevention

Each channel prevents responding to itself:
- Discord: `if author.get("bot"): return`
- Slack: `if sender_id == self._bot_user_id: return`
- Mochat: `if author == self.config.agent_user_id: return`

### Deduplication

Multiple channels implement deduplication to prevent processing the same message twice:
- Feishu: `OrderedDict` of message IDs (capped at 1000)
- QQ: `deque` of message IDs (capped at 1000)
- Email: `set` of UIDs (capped at 100,000)
- Mochat: per-target seen sets (capped at 2000)

---

## 7. Key Design Decisions

### 1. Plugin Architecture

Channels are loaded lazily via conditional imports. This means:
- You can install only the dependencies you need
- Missing dependencies don't crash the app
- Easy to add new channels without modifying core code

### 2. Async-First Design

All channels use `async/await` throughout. This is critical because:
- Multiple channels run concurrently
- Network I/O (HTTP, WebSocket) shouldn't block other channels
- The message bus is async

### 3. Unified Message Format

All channels normalize to `InboundMessage` and `OutboundMessage`. The agent never knows which platform it's talking to. This is the **Adapter Pattern** - each channel adapts its platform to a common interface.

### 4. Separate Concerns

- **Channel** = Platform connection + message translation
- **Manager** = Channel lifecycle + message routing
- **Bus** = Decoupled message passing
- **Agent** = Business logic (doesn't care about platforms)

### 5. Resilience Patterns

Every channel implements:
- **Auto-reconnect** with backoff
- **Error logging** without crashing
- **Graceful shutdown** via `stop()` method
- **Resource cleanup** (closing connections, cancelling tasks)

### 6. The WhatsApp Bridge Decision

Choosing a separate Node.js process for WhatsApp was pragmatic:
- Baileys is the best WhatsApp Web library, but it's JavaScript
- Rewriting in Python would be months of work
- WebSocket bridge keeps the architecture clean
- Localhost-only binding maintains security

### 7. Platform-Specific Formatting

Each channel handles its own formatting:
- Telegram: Markdown -> HTML conversion
- Slack: Markdown -> mrkdwn conversion
- Feishu: Markdown -> Card elements with tables
- Email: Plain text with proper headers

This keeps the agent's output simple (markdown) while each channel handles the translation.

---

## 8. Channel Comparison Table

| Channel | Protocol | Public IP Needed | Auth Method | Dedup | Typing Indicator | Media Support |
|---------|----------|-----------------|-------------|-------|-----------------|---------------|
| Telegram | Long polling | No | Bot token | No | Yes | Photos, voice, audio, docs |
| Discord | Gateway WS | No | Bot token | No | Yes | Attachments (20MB) |
| Slack | Socket Mode | No | Bot + App tokens | No (manual) | No (reaction) | No |
| WhatsApp | WS bridge | No | QR code + token | No | No | Voice (placeholder) |
| Feishu | WS long conn | No | App ID/Secret | Yes (1000) | No (reaction) | Image, audio, file |
| DingTalk | Stream Mode | No | Client ID/Secret | No | No | No |
| Email | IMAP/SMTP | No (polling) | Username/password | Yes (100K) | No | Attachments (parsed) |
| QQ | WebSocket | No | App ID/Secret | Yes (1000) | No | No |
| Mochat | Socket.IO + HTTP | No | Token | Yes (2000) | No | Text only |

---

## 9. Summary

The channel system is a well-designed plugin architecture that demonstrates several key software engineering principles:

1. **Abstraction** - `BaseChannel` hides platform complexity
2. **Polymorphism** - Each channel implements the same interface differently
3. **Single Responsibility** - Each channel handles one platform
4. **Loose Coupling** - Channels don't know about each other or the agent
5. **Resilience** - Every channel handles errors and reconnects gracefully
6. **Security** - Layered access control with per-channel allowlists

The most impressive engineering is in the **Mochat channel** (895 lines) with its dual transport, message buffering, and auto-discovery, and the **WhatsApp bridge** which elegantly solves the cross-language integration problem.
