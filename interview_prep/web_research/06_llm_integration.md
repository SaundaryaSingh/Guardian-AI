# LLM Integration Interview Topics (2024-2025)

## 1. LiteLLM Architecture & Provider Abstraction

### Core Concepts

**Unified API Abstraction Layer**
- LiteLLM translates OpenAI-compatible params across all providers (OpenAI, Anthropic, Bedrock, Vertex, Cohere, etc.)
- Single `completion()` function handles 100+ providers via provider prefixes: `anthropic/claude-3`, `bedrock/claude-instant`, `vertex_ai/gemini-pro`
- Parameter translation: `get_supported_openai_params(model, custom_llm_provider)` returns provider-compatible params
- `drop_params=True` silently drops unsupported params instead of raising exceptions

**Provider Model Format**
- Model strings follow pattern: `provider/model-name` (e.g., `anthropic/claude-3-opus`, `openai/gpt-4-turbo`)
- Custom model lists via `model_list=[{"model": "gpt-4", "api_base": "...", "api_key": "..."}]`
- Per-request overrides: `api_base`, `api_version`, `api_key` params

### Interview Questions

**Q: How does LiteLLM normalize API differences across 14+ providers?**
A: LiteLLM uses a translation layer that maps OpenAI-format parameters to each provider's native API. For example:
- `max_tokens` → Anthropic uses `max_tokens`, Bedrock uses `max_tokens`, Vertex uses `maxOutputTokens`
- `response_format` → Only supported by OpenAI, Azure; dropped for others with `drop_params=True`
- Tool calling schemas are normalized to OpenAI format and translated per provider

**Q: What challenges arise when abstracting providers that have fundamentally different APIs?**
A: Key challenges include:
- **Message format differences**: Anthropic uses `content` blocks, OpenAI uses flat strings, Bedrock uses Converse API format
- **Streaming protocols**: SSE format differs (OpenAI uses `data: [DONE]`, Anthropic uses `event: message_stop`)
- **Token counting**: Each provider calculates tokens differently; some don't expose token counts
- **Error codes**: HTTP 429 means rate limit everywhere, but 400/403/500 semantics vary
- **Tool calling**: Some providers support parallel tool calls, others don't; schema requirements differ

**Q: How would you implement a new provider integration in LiteLLM?**
A: Steps involve:
1. Create provider class extending base handler
2. Implement `completion()`, `transform_request()`, `transform_response()`, `transform_streaming_chunk()`
3. Add parameter translation mapping
4. Register in `__init__.py` provider registry
5. Add to `model_prices_and_context_window.json` for cost tracking

---

## 2. LLM Provider Routing & Fallback Strategies

### Routing Strategies

**Load Balancing**
- Round-robin across deployments of same model
- Weighted distribution based on deployment capacity
- Cost-based routing: route to cheapest provider meeting latency requirements
- Tag-based routing: group deployments by tags (region, team, use-case)

**Fallback Chains (Provider Failover)**
- Primary → Secondary → Tertiary model configuration
- Automatic failover on: `RateLimitError`, `Timeout`, `ServiceUnavailable`, `ContextWindowExceeded`
- `num_retries` per model before fallback triggers
- `fallbacks=[{"gpt-4": ["gpt-3.5-turbo", "claude-instant"]}]`

**Adaptive Routing (Beta)**
- Complexity-based routing: classify request complexity → route to appropriate model tier
- Thompson sampling for model selection in pools
- Health-check driven routing: proactive removal of unhealthy deployments
- Budget-aware routing: respect per-team/per-key budget limits

### Interview Questions

**Q: Design a routing system that handles 14+ providers with automatic failover.**
A: Architecture considerations:
```
Request → Router → Primary Provider
                ↓ (failure after num_retries)
              Secondary Provider
                ↓ (failure)
              Tertiary Provider
                ↓ (all failed)
              Error Response + Alert
```
- Track provider health with exponential backoff on failures
- Maintain deployment latency metrics for intelligent routing
- Implement circuit breaker pattern per provider
- Use background health checks (configurable interval) to proactively remove unhealthy deployments
- Support budget routing to prevent cost overruns

**Q: How do you handle context window errors across different providers?**
A: Multi-layered approach:
- `context_window_fallback_dict` maps models to fallbacks on context errors
- Pre-flight token counting to estimate context usage
- Automatic truncation strategies: sliding window, summarization, importance-based
- Provider-specific context limits (GPT-4: 128k, Claude: 200k, Gemini: 1M)

**Q: What metrics matter most for LLM routing decisions?**
A: Key metrics:
- **Latency**: p50, p95, p99 response times per provider
- **Error rates**: 4xx (client), 5xx (server), timeout rates
- **Cost per token**: Input/output costs vary 10x+ across providers
- **Throughput**: Requests/minute capacity per deployment
- **Availability**: Uptime percentage, maintenance windows
- **Quality**: Model-specific performance on your use-case

---

## 3. Function Calling / Tool Use in LLMs

### Core Concepts

**Tool Calling Flow**
1. Define tools with JSON Schema (type, name, description, parameters)
2. Send request with `tools` parameter
3. Model returns `function_call` with `name` and `arguments` (JSON-encoded)
4. Execute function in application code
5. Return `function_call_output` with `call_id` reference
6. Model generates final response incorporating tool results

**Tool Choice Modes**
- `auto` (default): Model decides whether to call functions
- `required`: Model must call at least one function
- `none`: Model cannot call functions
- `{"type": "function", "name": "specific_func"}`: Force specific function
- `allowed_tools`: Restrict to subset (optimizes prompt caching)

**Parallel Tool Calling**
- Model can return multiple `function_call` items in single response
- Disable with `parallel_tool_calls: false` for sequential execution
- Built-in tools (web search, code interpreter) cannot be parallelized with function tools

### Advanced Patterns

**Tool Search (gpt-5.4+)**
- Defer tool loading with `defer_loading: true`
- Model searches tool catalog and loads only relevant tools
- Critical for large tool ecosystems (10,000+ tools)
- Reduces context window usage and cost

**Namespaced Tools**
```json
{
  "type": "namespace",
  "name": "crm",
  "tools": [
    {"name": "get_customer_profile", ...},
    {"name": "list_open_orders", "defer_loading": true, ...}
  ]
}
```

**Custom Tools with Grammar Constraints**
- Free-form text input/output tools
- Context-free grammars (Lark, Regex) constrain model output
- Useful for structured outputs without JSON schema overhead

### Interview Questions

**Q: Design an agent loop with tool use across multiple LLM providers.**
A: Architecture:
```python
def agent_loop(query, tools, max_iterations=10):
    messages = [{"role": "user", "content": query}]
    
    for i in range(max_iterations):
        response = litellm.completion(
            model="anthropic/claude-3-opus",
            messages=messages,
            tools=tools
        )
        
        if no_tool_calls(response):
            return response.choices[0].message.content
        
        for tool_call in response.tool_calls:
            result = execute_tool(tool_call.name, tool_call.arguments)
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result
            })
    
    raise MaxIterationsExceeded()
```

**Q: How do you handle tool call failures and retries?**
A: Best practices:
- Wrap tool execution in try/except, return error message as tool output
- Model can then decide to retry with different params or use alternative tool
- Set `max_iterations` to prevent infinite loops
- Implement tool call validation before execution (schema, permissions, rate limits)
- Log all tool calls for debugging and evaluation

**Q: What are the token cost implications of tool use?**
A: Key considerations:
- Tool definitions count against context limit and billed as input tokens
- `strict: true` mode uses structured outputs (may have additional overhead)
- Parallel tool calls increase response tokens
- Tool search reduces upfront token cost but adds search latency
- Consider fine-tuning to reduce token usage for large tool sets

---

## 4. Prompt Engineering Best Practices

### System Prompt Design

**Structure**
- Clear role definition and behavioral guidelines
- Tool usage instructions (when to use each tool, edge cases)
- Output format specifications
- Constraints and safety guidelines

**Optimization Techniques**
- Few-shot examples for complex tasks
- Chain-of-thought prompting for reasoning
- Structured output schemas (JSON mode, function calling)
- Prompt compression for cost/latency reduction

### Interview Questions

**Q: How do you design prompts that work consistently across multiple LLM providers?**
A: Key strategies:
- Use OpenAI-compatible format as baseline (messages array with roles)
- Avoid provider-specific syntax in prompts
- Test across providers for behavioral consistency
- Use `response_format` for structured outputs where available
- Implement provider-specific prompt templates when needed

**Q: How do you handle prompt injection and safety concerns?**
A: Multi-layered defense:
- Input sanitization and validation
- Separate system/user messages clearly
- Use guardrails API for content filtering
- Implement tool permission boundaries
- Log and monitor for suspicious patterns
- Rate limiting per user/key

---

## 5. LLM Evaluation and Testing

### Evaluation Framework

**Metrics**
- **Accuracy**: Task-specific correctness (exact match, F1, BLEU, etc.)
- **Latency**: Time to first token (TTFT), tokens per second, total latency
- **Cost**: Cost per request, cost per 1K tokens
- **Reliability**: Success rate, error rate, fallback frequency
- **Quality**: Human evaluation, LLM-as-judge, reference-free metrics

**Testing Strategies**
- Unit tests for provider-specific transformations
- Integration tests with mock providers
- Load testing for throughput and latency
- A/B testing for model comparisons
- Regression testing for prompt changes

### Interview Questions

**Q: How do you evaluate tool calling accuracy across different models?**
A: Evaluation approach:
```python
test_cases = [
    {
        "query": "What's the weather in Paris?",
        "expected_tool": "get_weather",
        "expected_args": {"location": "Paris"},
        "expected_tool_count": 1
    }
]
metrics = {
    "tool_selection_accuracy": correct_tool / total,
    "argument_accuracy": correct_args / total,
    "multi_tool_accuracy": correct_multi_tool / total,
    "no_hallucination_rate": no_extra_tools / total
}
```

**Q: How do you test fallback behavior under realistic failure conditions?**
A: Testing strategy:
- Simulate provider failures with configurable error rates
- Test timeout scenarios with slow mock providers
- Verify fallback chain ordering and retry behavior
- Measure recovery time after provider comes back
- Test budget exhaustion scenarios

---

## 6. LLM Cost Optimization

### Cost Management Strategies

**Token Usage Optimization**
- Prompt compression and deduplication
- Context window management (sliding window, summarization)
- Tool definition optimization (combine similar tools, reduce descriptions)
- Response length control (`max_tokens`, `max_completion_tokens`)

**Model Selection**
- Route simple queries to cheaper models (GPT-3.5-turbo, Claude Haiku)
- Reserve expensive models for complex reasoning
- Use tool search to defer rarely-used tool loading
- Implement cost-based routing rules

**Caching**
- Prompt caching (OpenAI, Anthropic support this)
- Response caching for deterministic queries
- Semantic caching for similar queries
- Tool definition caching across requests

### Interview Questions

**Q: How do you reduce LLM costs by 50% without sacrificing quality?**
A: Strategies:
- **Model tiering**: Route by complexity (simple → GPT-3.5, complex → GPT-4)
- **Prompt optimization**: Remove redundant instructions, compress context
- **Caching**: Cache repeated queries and tool definitions
- **Batching**: Group similar requests where latency allows
- **Fine-tuning**: Reduce token usage with fine-tuned models for specific tasks
- **Monitoring**: Track cost per feature, optimize high-cost areas

**Q: How do you track and attribute LLM costs across teams/projects?**
A: Cost tracking implementation:
- Use `metadata` param to tag requests with team/project
- LiteLLM logs token usage and cost per request
- Implement cost alerts at key/team levels
- Budget routing to enforce limits
- Dashboard for cost visualization and trends

---

## 7. LLM Security Considerations

### Security Layers

**API Key Management**
- Centralized key storage (env vars, vault)
- Per-team/per-key rate limiting and budgets
- Key rotation and revocation
- Audit logging for all API calls

**Content Safety**
- Input validation and sanitization
- Output filtering for sensitive data
- Guardrails API for content moderation
- PII detection and masking

**Access Control**
- Tool permission boundaries (who can call what)
- Rate limiting per user/key/team
- IP allowlisting for API access
- Audit trails for compliance

### Interview Questions

**Q: How do you secure an LLM gateway serving multiple teams?**
A: Security architecture:
- OAuth/SAML SSO for authentication
- RBAC for authorization (admin, team-lead, developer roles)
- API key management with team isolation
- Rate limiting and budget controls per team
- Audit logging for all requests
- Content filtering and guardrails
- Encryption at rest and in transit

**Q: What are the main attack vectors against LLM systems?**
A: Common threats:
- **Prompt injection**: Malicious input overriding system instructions
- **Data exfiltration**: Using tools to access unauthorized data
- **Cost attacks**: Generating excessive token usage
- **Model extraction**: Querying to replicate model behavior
- **Tool abuse**: Calling tools with malicious parameters

**Q: How do you implement tool permission boundaries?**
A: Permission system:
- Define tool access per role/team
- Validate tool calls against permission set before execution
- Implement least-privilege principle (tools get minimal access)
- Log all tool invocations for audit
- Rate limit sensitive tools (e.g., send_email: 10/hour)

---

## 8. Multi-Model Strategies

### Model Orchestration Patterns

**Ensemble Methods**
- Run same query on multiple models
- Consensus voting for critical decisions
- Use different models for different reasoning types

**Pipeline Composition**
- Route through specialized models in sequence
- Example: Classification → Generation → Verification
- Each model optimized for its stage

**Model Cascading**
- Start with fast/cheap model
- Escalate to stronger model if confidence is low
- Fallback to strongest model for edge cases

### Interview Questions

**Q: Design a multi-model system that balances cost, latency, and quality.**
A: Architecture:
```
Request → Complexity Classifier
         ↓ (simple) → GPT-3.5-turbo (fast, cheap)
         ↓ (medium) → GPT-4-turbo (balanced)
         ↓ (complex) → Claude-3-opus (highest quality)
         ↓ (critical) → Ensemble (GPT-4 + Claude, consensus)
```
- Implement complexity scoring (heuristic + LLM classifier)
- Track quality metrics per model per task type
- A/B test model assignments
- Budget-aware routing to prevent cost overruns

**Q: How do you handle model versioning and deprecation?**
A: Version management:
- Model registry with version metadata
- Deprecation notices with migration timeline
- Automated testing against new model versions
- Gradual rollout with canary deployments
- Rollback capability on quality regression

**Q: How do you ensure consistent behavior across different models?**
A: Consistency strategies:
- Unified prompt templates across providers
- Structured output schemas (JSON mode, function calling)
- Provider-specific prompt adaptations
- Comprehensive evaluation suites
- Model-specific behavioral documentation

---

## Common Interview Scenarios

### Scenario 1: "Our LLM costs are too high"
**Approach:**
1. Audit current usage by feature/team
2. Identify low-complexity queries using expensive models
3. Implement model tiering with complexity-based routing
4. Add caching for repeated queries
5. Optimize prompt lengths
6. Set budget alerts and routing rules

### Scenario 2: "Provider X keeps failing"
**Approach:**
1. Analyze failure patterns (error types, times, load)
2. Implement circuit breaker with exponential backoff
3. Configure fallback chain to alternative providers
4. Set up health checks and proactive routing
5. Add monitoring and alerting

### Scenario 3: "Tool calling accuracy is poor"
**Approach:**
1. Analyze failure modes (wrong tool, wrong args, hallucinated tools)
2. Optimize tool definitions (descriptions, examples)
3. Reduce tool count per request (use tool search)
4. Implement tool call validation
5. Fine-tune model for your specific tools

### Scenario 4: "We need to support 14+ providers"
**Approach:**
1. Use LiteLLM as abstraction layer
2. Implement provider-specific error handling
3. Configure fallback chains across providers
4. Monitor provider health and latency
5. Manage API keys and rate limits centrally

---

## Key Takeaways for Interview

1. **Provider Abstraction**: Understanding how to normalize APIs across providers
2. **Reliability**: Fallback strategies, circuit breakers, health checks
3. **Tool Use**: Agent loops, error handling, permission boundaries
4. **Cost Optimization**: Model tiering, caching, prompt optimization
5. **Security**: Key management, content safety, audit logging
6. **Evaluation**: Metrics, testing strategies, A/B testing
7. **Multi-Model**: Orchestration patterns, complexity-based routing
8. **Production Readiness**: Monitoring, alerting, rollback capabilities

---

*Research compiled from LiteLLM documentation, OpenAI function calling guides, and industry best practices for LLM integration (2024-2025)*
