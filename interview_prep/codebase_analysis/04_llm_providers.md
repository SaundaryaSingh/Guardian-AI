# 04 - LLM Provider Integrations

## Overview

OpenClaw-Finance needs to talk to many different AI models (GPT, Claude, Gemini, DeepSeek, etc.) from many different companies. Instead of writing separate code for each one, the project uses a clever abstraction system that lets it talk to **14+ providers** through a single unified interface.

Think of it like a universal power adapter — you plug in any device from any country, and it just works.

---

## 1. How LLM Providers Are Abstracted

### The Base Class: `LLMProvider` (`providers/base.py`)

Every LLM provider must follow the same contract defined by `LLMProvider`, an abstract base class. This means any provider implementation must provide exactly two methods:

```python
class LLMProvider(ABC):
    async def chat(self, messages, tools=None, model=None, max_tokens=4096, temperature=0.7) -> LLMResponse:
        pass

    def get_default_model(self) -> str:
        pass
```

**Why this matters:** The rest of the codebase (the agent loop, tools, routers) doesn't care which provider is being used. It just calls `provider.chat(...)` and gets back a standardized `LLMResponse`. This is the **Strategy Pattern** — swap the implementation, keep the interface.

### Standardized Response: `LLMResponse`

Every response, regardless of provider, comes back as:

```python
@dataclass
class LLMResponse:
    content: str | None              # The text reply
    tool_calls: list[ToolCallRequest]  # Tool/function calls the model wants
    finish_reason: str               # "stop", "length", "error", etc.
    usage: dict[str, int]            # Token counts (prompt, completion, total)
    reasoning_content: str | None    # For models like DeepSeek-R1, Kimi that show reasoning
```

The `ToolCallRequest` dataclass holds tool call details:
```python
@dataclass
class ToolCallRequest:
    id: str
    name: str
    arguments: dict[str, Any]
```

**Key insight:** By normalizing all responses into this single format, the agent loop never needs to know whether it's talking to OpenAI or a local vLLM server.

---

## 2. The Provider Registry (`providers/registry.py`)

The registry is the **single source of truth** for all provider metadata. It's a tuple of `ProviderSpec` dataclasses, each describing one provider. The order in the tuple matters — it controls priority.

### What a `ProviderSpec` Contains

Each provider spec has these fields:

| Field | Purpose |
|-------|---------|
| `name` | Config field name (e.g., `"dashscope"`, `"openrouter"`) |
| `keywords` | Model-name keywords for matching (e.g., `("anthropic", "claude")`) |
| `env_key` | LiteLLM env var name (e.g., `"ANTHROPIC_API_KEY"`) |
| `litellm_prefix` | Prefix for LiteLLM routing (e.g., `"deepseek"` → `deepseek/deepseek-chat`) |
| `skip_prefixes` | Don't add prefix if model already starts with these |
| `env_extras` | Extra env vars to set (e.g., `ZHIPUAI_API_KEY` for Zhipu) |
| `is_gateway` | Can route any model (OpenRouter, AiHubMix) |
| `is_local` | Local deployment (vLLM, Ollama) |
| `is_oauth` | Uses OAuth instead of API key (OpenAI Codex) |
| `detect_by_key_prefix` | Match API key prefix (e.g., `"sk-or-"` → OpenRouter) |
| `detect_by_base_keyword` | Match substring in API base URL |
| `default_api_base` | Fallback base URL |
| `strip_model_prefix` | Strip `provider/` before re-prefixing |
| `model_overrides` | Per-model parameter overrides (e.g., Kimi K2.5 requires temperature >= 1.0) |

### Lookup Functions

The registry provides three lookup helpers:

1. **`find_by_model(model)`** — Matches a model name to a provider by keyword. Skips gateways and local providers (they're matched differently).

2. **`find_gateway(provider_name, api_key, api_base)`** — Detects gateway/local providers. Priority:
   1. Config key name → direct match
   2. API key prefix (e.g., `"sk-or-"` → OpenRouter)
   3. API base keyword (e.g., `"aihubmix"` in URL)

3. **`find_by_name(name)`** — Find a provider by its config field name.

---

## 3. All 14+ Providers Supported

Here's every provider in the registry, grouped by type:

### Custom Endpoints
| Provider | Keywords | Prefix | Notes |
|----------|----------|--------|-------|
| **Custom** | (none) | `openai/` | User-provided OpenAI-compatible endpoint. Only activates when user explicitly sets `"custom"` in config. |

### Gateway Providers (Can Route Any Model)
| Provider | Keywords | Prefix | Notes |
|----------|----------|--------|-------|
| **OpenRouter** | `openrouter` | `openrouter/` | Global gateway. Keys start with `"sk-or-"`. Default base: `https://openrouter.ai/api/v1` |
| **AiHubMix** | `aihubmix` | `openai/` | OpenAI-compatible interface. Strips model prefix and re-prefixes. Default base: `https://aihubmix.com/v1` |

### Standard Providers (Matched by Model Name)
| Provider | Keywords | Prefix | Notes |
|----------|----------|--------|-------|
| **Anthropic** | `anthropic`, `claude` | (none) | LiteLLM recognizes Claude natively |
| **OpenAI** | `openai`, `gpt` | (none) | LiteLLM recognizes GPT natively |
| **OpenAI Codex** | `openai-codex`, `codex` | (none) | OAuth-based, not routed via LiteLLM |
| **DeepSeek** | `deepseek` | `deepseek/` | Needs prefix for LiteLLM routing |
| **Gemini** | `gemini` | `gemini/` | Needs prefix for LiteLLM routing |
| **Zhipu** | `zhipu`, `glm`, `zai` | `zai/` | Also mirrors key to `ZHIPUAI_API_KEY` |
| **DashScope** | `qwen`, `dashscope` | `dashscope/` | Qwen models from Alibaba Cloud |
| **Moonshot** | `moonshot`, `kimi` | `moonshot/` | Kimi models. Requires `MOONSHOT_API_BASE` env var. K2.5 forces temperature >= 1.0 |
| **MiniMax** | `minimax` | `minimax/` | Uses OpenAI-compatible API at `api.minimax.io/v1` |

### Local Deployment
| Provider | Keywords | Prefix | Notes |
|----------|----------|--------|-------|
| **vLLM** | `vllm` | `hosted_vllm/` | Any OpenAI-compatible local server |

### Auxiliary
| Provider | Keywords | Prefix | Notes |
|----------|----------|--------|-------|
| **Groq** | `groq` | `groq/` | Primarily for Whisper voice transcription, also usable for LLM |

---

## 4. How Provider Routing Works

The routing system has multiple layers of intelligence:

### Step 1: Gateway Detection

When `LiteLLMProvider.__init__` is called, it immediately checks if the provider is a gateway or local deployment:

```python
self._gateway = find_gateway(provider_name, api_key, api_base)
```

Gateway detection priority:
1. **Config key name** — If `provider_name` maps to a gateway spec (e.g., `"openrouter"`), use it directly
2. **API key prefix** — `"sk-or-"` → OpenRouter
3. **API base keyword** — `"aihubmix"` in URL → AiHubMix

### Step 2: Model Name Resolution

When making a chat request, the model name is resolved:

```python
def _resolve_model(self, model: str) -> str:
    if self._gateway:
        # Gateway: apply gateway prefix, skip provider-specific prefixes
        prefix = self._gateway.litellm_prefix
        if self._gateway.strip_model_prefix:
            model = model.split("/")[-1]  # "anthropic/claude-3" → "claude-3"
        if prefix and not model.startswith(f"{prefix}/"):
            model = f"{prefix}/{model}"
        return model

    # Standard: auto-prefix for known providers
    spec = find_by_model(model)
    if spec and spec.litellm_prefix:
        if not any(model.startswith(s) for s in spec.skip_prefixes):
            model = f"{spec.litellm_prefix}/{model}"
    return model
```

**Example:** User has `model="deepseek-chat"` and a DeepSeek API key:
- `find_by_model("deepseek-chat")` matches the DeepSeek spec
- `litellm_prefix` is `"deepseek"`
- Model becomes `"deepseek/deepseek-chat"`

**Example:** User has `model="anthropic/claude-3"` and OpenRouter key (`"sk-or-..."`):
- Gateway detected as OpenRouter
- `strip_model_prefix=True` for AiHubMix (not OpenRouter)
- For OpenRouter: model stays `"openrouter/anthropic/claude-3"`

### Step 3: Fallback Logic

In `Config._match_provider()`, if no provider matches the model name exactly:

1. **Keyword match** — Walk the PROVIDERS tuple in order, checking if any keyword appears in the model name
2. **Fallback** — If no keyword match, use the **first provider with an API key** (gates first, then standard providers). OAuth providers are excluded from fallback.

This means OpenRouter (a gateway) typically wins fallback because it can route any model.

### Step 4: Environment Variable Setup

The `_setup_env` method configures environment variables for LiteLLM:

```python
def _setup_env(self, api_key, api_base, model):
    spec = self._gateway or find_by_model(model)
    if self._gateway:
        os.environ[spec.env_key] = api_key  # Gateway overrides
    else:
        os.environ.setdefault(spec.env_key, api_key)  # Standard doesn't override

    # Resolve env_extras placeholders
    for env_name, env_val in spec.env_extras:
        resolved = env_val.replace("{api_key}", api_key)
        resolved = resolved.replace("{api_base}", effective_base)
        os.environ.setdefault(env_name, resolved)
```

### Step 5: Model-Specific Overrides

Some models need special parameters. The registry supports per-model overrides:

```python
model_overrides=(
    ("kimi-k2.5", {"temperature": 1.0}),  # Kimi K2.5 API requires temperature >= 1.0
)
```

These are applied automatically before each API call.

### Retry Logic

The `LiteLLMProvider.chat()` method has built-in retry logic for rate limits:

```python
_max_retries = 3
for _attempt in range(_max_retries + 1):
    try:
        response = await acompletion(**kwargs)
        return parsed
    except litellm.RateLimitError as e:
        if _attempt == _max_retries:
            return LLMResponse(content=f"Error: {str(e)}", finish_reason="error")
        wait = 5 * (2 ** _attempt)  # 5s → 10s → 20s (exponential backoff)
        await asyncio.sleep(wait)
```

---

## 5. The OpenAI Codex Provider (`providers/openai_codex_provider.py`)

This is the most unique provider in the system. It **bypasses LiteLLM entirely** and talks directly to OpenAI's Codex Responses API.

### What Makes It Special

1. **OAuth Authentication** — Uses `oauth_cli_kit` to get tokens instead of API keys. This means you authenticate via ChatGPT's OAuth flow, not a traditional API key.

2. **Different API Protocol** — Uses the **Responses API** (SSE streaming), not the standard Chat Completions API. This is OpenAI's newer, more structured format.

3. **SSE Streaming** — The response comes as Server-Sent Events, parsed incrementally. Events include:
   - `response.output_text.delta` — text chunks
   - `response.output_item.added` — tool call started
   - `response.function_call_arguments.delta` — tool call arguments streaming
   - `response.function_call_arguments.done` — tool call arguments complete
   - `response.output_item.done` — tool call finished
   - `response.completed` — final status

4. **Custom Message Format** — Converts standard chat messages to Codex's `input_items` format:
   - `role: "user"` → `{"type": "input_text", "text": "..."}`
   - `role: "assistant"` → `{"type": "message", "role": "assistant", ...}`
   - `role: "tool"` → `{"type": "function_call_output", ...}`
   - System prompt extracted separately as `instructions`

5. **Tool Format Conversion** — Converts OpenAI function-calling schema to Codex's flat format:
   ```python
   {"type": "function", "name": "...", "description": "...", "parameters": {...}}
   ```

6. **SSL Certificate Fallback** — If SSL verification fails (common in some environments), it retries with `verify=False`.

7. **Prompt Cache Key** — Generates a SHA256 hash of the messages for prompt caching.

### Why Bypass LiteLLM?

The Codex Responses API is not compatible with LiteLLM's Chat Completions interface. The Responses API has:
- Different request/response format
- SSE streaming with different event types
- Different tool call structure
- OAuth instead of API key

Building a LiteLLM adapter for this would be complex and fragile, so a dedicated implementation was chosen.

---

## 6. Transcription Capabilities (`providers/transcription.py`)

The `GroqTranscriptionProvider` handles voice-to-text transcription:

```python
class GroqTranscriptionProvider:
    def __init__(self, api_key=None):
        self.api_key = api_key or os.environ.get("GROQ_API_KEY")
        self.api_url = "https://api.groq.com/openai/v1/audio/transcriptions"

    async def transcribe(self, file_path) -> str:
        # Sends audio file to Groq's Whisper API
        # Returns transcribed text
```

**Key details:**
- Uses **Groq's Whisper API** (extremely fast transcription)
- Model: `whisper-large-v3`
- Sends audio as multipart form data via `httpx`
- 60-second timeout
- Returns empty string on failure (graceful degradation)
- Independent from the main LLM provider system (not an `LLMProvider` subclass)

**Why Groq?** Groq offers extremely fast Whisper inference with a generous free tier. Since transcription is a separate concern from LLM chat, it doesn't need the full provider abstraction.

---

## 7. Key Design Decisions

### 1. Registry Over Configuration
Instead of scattering provider logic across config files, all provider metadata lives in `registry.py`. Adding a new provider requires:
1. Add a `ProviderSpec` to `PROVIDERS`
2. Add a field to `ProvidersConfig` in `config/schema.py`

That's it. Env vars, prefixing, config matching, status display all derive from the registry.

### 2. Gateway vs. Standard Provider Distinction
Gateways (OpenRouter, AiHubMix) can route **any** model, so they get special treatment:
- Detected by API key prefix or URL, not model name
- Used as fallback when no specific provider matches
- Strip/re-prefix model names as needed

### 3. Skip Prefixes to Avoid Double-Prefixing
When a model already has a prefix (e.g., `"openrouter/claude-3"`), the system checks `skip_prefixes` to avoid making it `"openrouter/openrouter/claude-3"`.

### 4. Model-Specific Overrides in Registry
The Moonshot/Kimi K2.5 requires temperature >= 1.0. Instead of hardcoding this in the provider logic, it's declared in the registry:
```python
model_overrides=(("kimi-k2.5", {"temperature": 1.0}),)
```

### 5. OAuth Providers Excluded from Fallback
OpenAI Codex uses OAuth, not API keys. It can't be a fallback because it requires explicit user authentication. The fallback logic explicitly skips `is_oauth` providers.

### 6. `litellm.drop_params = True`
LiteLLM is configured to drop unsupported parameters (e.g., `gpt-5` rejects some params). This prevents errors when using models that don't support all parameters.

### 7. Verbose Logging with Structured Format
When `log_verbose` is enabled, requests and responses are logged in a structured format with timestamps, token counts, and content previews. This is invaluable for debugging.

### 8. Inner Provider Pattern
The system supports a separate `inner_provider` for sub-agents. If the main model and inner model use different providers, a second `LiteLLMProvider` is created. If they use the same provider, the main provider handles both.

---

## 8. Limitations

### 1. No Unified Error Handling
While rate limits are retried with exponential backoff, other errors (network timeouts, authentication failures, quota exhaustion) are returned as error responses without retry. The error message is embedded in `LLMResponse.content`, which the agent might interpret as valid text.

### 2. Gateway Auto-Detection is Fragile
Gateway detection relies on:
- API key prefix matching (e.g., `"sk-or-"` for OpenRouter)
- URL substring matching (e.g., `"aihubmix"` in base URL)

If a provider changes their key format or URL structure, auto-detection breaks silently.

### 3. Environment Variable Side Effects
`_setup_env` modifies `os.environ`, which is global state. If multiple providers are instantiated (e.g., main + inner), later providers can overwrite earlier providers' env vars (though `setdefault` mitigates this for standard providers).

### 4. No Streaming for LiteLLM Provider
The `LiteLLMProvider.chat()` waits for the full response. For large responses, this can be slow. The Codex provider streams via SSE, but the LiteLLM path doesn't expose streaming to the agent loop.

### 5. Codex Provider SSL Workaround
The SSL fallback (`verify=False`) is a security concern. It's triggered on `CERTIFICATE_VERIFY_FAILED`, which could mask real certificate issues.

### 6. Limited Model Validation
There's no validation that the model name is valid for the detected provider. If you pass `"gpt-4"` with a DeepSeek API key, it will attempt the call and fail at runtime.

### 7. Token Estimation Fallback
When the API doesn't return token counts, the system falls back to `len(text) // 4` estimation. This is a rough heuristic that can be inaccurate for non-English text or code.

### 8. Transcription is Not Integrated with LLM Providers
`GroqTranscriptionProvider` is completely separate from the `LLMProvider` abstraction. It can't be swapped for another transcription provider without code changes.

### 9. No Cost Tracking
While token usage is logged, there's no cost calculation or budget tracking. Users have no visibility into spending across providers.

### 10. Provider Order is Global
The `PROVIDERS` tuple order is global. If two providers have overlapping keywords (e.g., `"openai"` could match both OpenAI and OpenRouter), the first match wins. This can lead to unexpected routing if keywords aren't carefully chosen.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Loop                            │
│              (agent/loop.py)                             │
│                                                         │
│  provider.chat(messages, tools, model)                  │
│         │                                               │
│         ▼                                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │              LLMProvider (ABC)                    │   │
│  │              (providers/base.py)                  │   │
│  └──────────────────────────────────────────────────┘   │
│         │                                               │
│    ┌────┴─────────────────────────────────────┐         │
│    │                                          │         │
│    ▼                                          ▼         │
│  ┌─────────────────┐    ┌──────────────────────────┐   │
│  │  LiteLLMProvider │    │  OpenAICodexProvider      │   │
│  │  (litellm.py)    │    │  (openai_codex_provider) │   │
│  └─────────────────┘    └──────────────────────────┘   │
│    │                         │                          │
│    │ uses                    │ bypasses                 │
│    ▼                         ▼                          │
│  ┌─────────────────┐    ┌──────────────────────────┐   │
│  │    LiteLLM       │    │  OpenAI Codex API         │   │
│  │  (14+ providers) │    │  (SSE streaming)          │   │
│  └─────────────────┘    └──────────────────────────┘   │
│    │                                                  │
│    ▼                                                  │
│  ┌──────────────────────────────────────────────────┐ │
│  │            Provider Registry                      │ │
│  │         (providers/registry.py)                   │ │
│  │                                                   │ │
│  │  ProviderSpec[] — model matching, prefixing,      │ │
│  │  env vars, gateway detection, overrides           │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

Provider Types:
  • Gateways: OpenRouter, AiHubMix (route any model)
  • Standard: Anthropic, OpenAI, DeepSeek, Gemini, Zhipu, DashScope, Moonshot, MiniMax, Groq
  • Local: vLLM
  • Special: Custom (user endpoint), OpenAI Codex (OAuth)
```

---

## Summary

The LLM provider system is well-designed for flexibility:
- **Abstraction** via `LLMProvider` base class keeps the agent loop provider-agnostic
- **Registry pattern** centralizes all provider metadata in one place
- **Gateway detection** automatically routes through OpenRouter/AiHubMix when keys are detected
- **Model prefixing** ensures LiteLLM can route to the correct provider
- **Codex provider** is a special case that bypasses LiteLLM for OpenAI's newer API format
- **Transcription** is handled separately via Groq's fast Whisper API

The main trade-offs are complexity in the routing logic and some fragility in auto-detection. Adding a new provider is straightforward (add a `ProviderSpec`), but debugging routing issues requires understanding the full detection flow.
