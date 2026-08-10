# 03 — AI/ML Interview Questions

> 20 questions covering LLM integration, agentic reasoning, function calling, prompt engineering, memory, model selection, AI safety, and multi-model strategies.
> Designed for a Full Stack + AI/ML intern who built OpenClaw-Finance.

---

## How LLMs Work — A 60-Second Primer

Before diving into these questions, here's what you need to know about how LLMs (Large Language Models — the AI like ChatGPT) actually work:

1. **Training**: An LLM is trained on massive amounts of text (books, websites, code). It learns patterns — what words typically follow other words, how sentences are structured, how facts connect.

2. **Prediction**: At its core, an LLM is a next-word-prediction machine. Given "The stock market is...", it predicts the most likely next words based on its training. This is why it can generate coherent text.

3. **Context Window**: An LLM can only "see" a limited amount of text at once — called the **context window** (like a whiteboard that can only fit so much). GPT-4 can handle 128K tokens (about 100,000 words), but it's expensive and slow. Smaller models might only handle 4K tokens.

4. **Temperature**: A setting that controls randomness. Temperature 0 = the model always picks the most likely word (deterministic, good for analysis). Temperature 1 = it sometimes picks less likely words (creative, good for brainstorming).

5. **Function Calling**: Modern LLMs can do more than generate text — they can say "call this tool" in a structured format. This is how agents work: the LLM decides what data it needs, requests a tool call, gets real data back, and reasons over it.

6. **Hallucination**: When the LLM confidently states something that isn't true. It happens because the model is predicting likely text, not checking facts. This is why grounding the model in real data (via tool calls) is critical for finance.

---

## Glossary (Learn These First!)

| Term | Simple Definition |
|------|-------------------|
| **LLM** | Large Language Model — the AI like ChatGPT that powers the agent |
| **Function Calling** | The LLM's ability to say "call this tool" instead of just generating text |
| **Agentic Loop** | A cycle where the AI thinks, acts, observes, and repeats until it has an answer — like a detective investigating a case |
| **Temperature** | A setting that controls randomness (0 = same answer every time, 1 = creative/random) |
| **Context Window** | How much text the AI can "see" at once — like a whiteboard that can only fit so much |
| **Hallucination** | When the AI makes things up confidently — a major problem in finance |
| **RAG** | Retrieval-Augmented Generation — giving the AI access to external data sources so it doesn't have to guess |
| **Evals** | Tests that measure how well the AI performs on specific tasks |
| **Gateway** | A middleman service that can route requests to many different AI providers — like a universal power adapter |
| **Few-shot** | Showing the AI a few examples before asking it to do a task |
| **Chain-of-Thought** | Asking the model to show its reasoning step by step instead of jumping to an answer |

---

## 1. Explain how you integrated 14+ LLM providers behind a single interface.

**Why interviewers ask this:** Tests your understanding of abstraction and building flexible systems.

**Answer:**
I built an abstract base class called `LLMProvider` that defines two methods: `chat()` and `get_default_model()`. Every provider — OpenAI, Anthropic, DeepSeek, Gemini, and others — implements those two methods. The rest of the codebase only calls `provider.chat()` and gets back a standardized response. So when I swap from Claude to GPT-4, nothing in the agent loop changes. It's like a universal power adapter — you plug in any device and it just works.

**Follow-up probes:**
- Why a registry pattern instead of just config files?
- What was the hardest provider to integrate and why?
- How does LiteLLM fit into this architecture?

---

## 2. How does your system decide which provider to use when multiple are available?

**Why interviewers ask this:** Evaluates your understanding of routing logic and fallback strategies.

**Answer:**
The registry checks in priority order. First, it matches by model name keywords — if the user specifies `claude-3`, it matches Anthropic. If no exact match, it checks if any gateway provider like OpenRouter is configured, because gateways can route any model. If nothing matches, it falls back to the first provider that has an API key set. Gateways are checked first in fallback because they're the most flexible.

**Follow-up probes:**
- What happens if two providers have overlapping keywords?
- How do you handle the case where a user has both OpenAI and OpenRouter keys?
- What's a gateway provider versus a standard provider?

---

## 3. What is function calling in LLMs and how does your agent use it?

**Why interviewers ask this:** Core AI concept — how LLMs interact with external tools.

**Answer:**
Function calling lets an LLM say "I need to call this tool" instead of just generating text. When a user asks about Apple's stock price, the model doesn't guess — it generates a structured function call saying "call get_stock_price with symbol AAPL." My agent receives that, executes the function, gets the real data, and feeds it back to the model. The model then reasons over actual market data instead of making things up. This is how I built an agent that can look up live financial data, search the web, or check prediction markets.

**Follow-up probes:**
- How do you define the tools the model can call?
- What happens when a function call fails?
- How do you handle models that don't support function calling?

---

## 4. Walk me through your agentic loop. What happens when a user asks a question?

**Why interviewers ask this:** Tests understanding of multi-step reasoning — the core of agentic AI.

**Answer:**
When a question comes in, the agent enters a loop that can run up to 20 iterations — think of it like a detective investigating a case, keeping digging until they have enough evidence. The system prompt is assembled with the user's message, their financial profile, and memory context. The LLM reads everything and either answers directly or requests a tool call. If it calls a tool, like fetching earnings data, the result goes back into the conversation, and the loop continues. The model sees the tool output and decides: do I have enough to answer, or do I need another tool? This continues until the model gives a final answer or hits the 20-iteration cap — a safety valve to prevent infinite loops.

**Follow-up probes:**
- How do you prevent infinite loops?
- What happens if the model keeps calling tools without answering?
- How do you decide the maximum number of iterations?

---

## 5. How do you design your system prompts for financial analysis?

**Why interviewers ask this:** Prompt engineering is a critical AI skill.

**Answer:**
The system prompt has three layers. First, a personality layer that defines how the agent communicates. Second, a context layer that includes the user's investment profile — their risk tolerance and portfolio. Third, a rules layer that tells the model how to use tools, what format to respond in, and when to ask for clarification instead of guessing. I also include few-shot examples showing the model what a good analysis looks like. The key is being specific — vague prompts lead to vague answers.

**Follow-up probes:**
- How do you handle token limits in long system prompts?
- What's the difference between a system prompt and a user prompt?
- How do you test whether your prompts are effective?

---

## 6. How does your system handle long conversations without losing context?

**Why interviewers ask this:** Memory management is a key challenge in production AI.

**Answer:**
Each conversation has a session that stores the full message history. But **context windows** (the whiteboard that can only fit so much) are limited — GPT-4 can handle 128K tokens, but that's expensive and slow. So I use a sliding window approach: the most recent messages are always included, and older ones get summarized or dropped. I also have a long-term memory store that keeps key facts about the user, like their portfolio holdings, so those don't get lost. For financial analysis, I also cache market data with a TTL so I don't re-fetch repeatedly.

**Follow-up probes:**
- What is the "lost in the middle" problem?
- How do you decide what to keep vs. summarize?
- What's the difference between short-term and long-term memory?

---

## 7. How do you reduce hallucinations in your financial agent?

**Why interviewers ask this:** Hallucination (when the AI makes things up confidently) is one of the biggest challenges in production LLM applications.

**Answer:**
First, I ground the model in real data by using function calls to fetch live market data instead of relying on training data. Second, I lower the temperature (the randomness knob) for analytical tasks so the model is more deterministic. Third, the system prompt explicitly tells the model to say "I don't know" rather than guess when data isn't available. Fourth, I use tool calls to verify claims — if the model says a stock went up 5%, it should fetch the actual price to confirm. No single technique eliminates hallucinations, but layering these gets you much closer to reliable output.

**Follow-up probes:**
- What temperature do you use and why?
- How would you evaluate whether hallucinations are being reduced?
- What role does RAG play in reducing hallucinations?

---

## 8. What is chain-of-thought reasoning and how does it help your agent?

**Why interviewers ask this:** Tests understanding of a fundamental technique for improving LLM reasoning.

**Answer:**
Chain-of-thought is when you ask the model to show its reasoning step by step instead of jumping to an answer. For financial analysis, this is critical. When the model analyzes Apple's earnings, it should first pull the revenue data, then compare it to expectations, then consider the macro environment, and finally form a conclusion. This makes the reasoning transparent — I can see where the model went wrong if it did. I build this into my prompts by asking the model to show its work before giving a recommendation.

**Follow-up probes:**
- How does chain-of-thought differ from standard prompting?
- When would you NOT want chain-of-thought reasoning?
- What's the cost tradeoff of using chain-of-thought?

---

## 9. How do you evaluate the performance of your AI agent?

**Why interviewers ask this:** Evals (tests that measure AI performance) are essential for production AI systems.

**Answer:**
I treat evaluations like unit tests for AI. I create a set of test questions with known correct answers — for example, "What was Apple's revenue in Q3 2024?" with the expected answer. I run the agent and compare outputs. For subjective tasks, I use LLM-as-a-judge — another model rates whether the response is accurate and useful. I also track metrics like whether the model called the right tools, how many iterations it took, and whether it hallucinated any numbers. Regular eval runs catch regressions when I change prompts or switch models.

**Follow-up probes:**
- How do you create ground-truth datasets?
- What's the difference between component-level and end-to-end evals?
- How do you handle evals for tasks with no single correct answer?

---

## 10. How do you handle rate limiting and provider failures?

**Why interviewers ask this:** Production reliability — dealing with real-world API constraints.

**Answer:**
The provider has built-in retry logic with exponential backoff — if it hits a rate limit, it waits 5 seconds, then 10, then 20, and gives up after 3 attempts. I also have fallback routing: if the primary provider fails, the system tries the next available provider. For example, if OpenAI is rate-limited, it can fall back to Anthropic or a gateway like OpenRouter. This means the user rarely sees errors — the system just routes around problems.

**Follow-up probes:**
- How does exponential backoff work?
- What other types of errors besides rate limits do you handle?
- How do you decide the maximum retry count?

---

## 11. What's the difference between a gateway provider and a standard provider?

**Why interviewers ask this:** Tests understanding of provider architecture.

**Answer:**
A standard provider like OpenAI or Anthropic only serves its own models — an OpenAI key can only call GPT models. A gateway provider like OpenRouter can route requests to any model from any provider using a single API key. Think of a standard provider as a single-brand store, while a gateway is like Amazon — it sells everything. Gateways are detected by checking the API key prefix, like 'sk-or-' for OpenRouter.

**Follow-up probes:**
- Why not just use a gateway for everything?
- What are the tradeoffs of using a gateway?
- How does model prefixing work differently for gateways?

---

## 12. How do you manage API keys and security for 14+ providers?

**Why interviewers ask this:** Security is critical in production systems.

**Answer:**
API keys are stored in the user's local config file, which is never committed to version control. The system reads keys at runtime and sets them as environment variables for LiteLLM. For OAuth-based providers, I use a token-based flow instead. I also use `setdefault` for environment variables so that if multiple providers are configured, the first one doesn't get overwritten. Keys are never logged.

**Follow-up probes:**
- What happens if a user accidentally commits their config file?
- How do you handle different auth mechanisms across providers?
- What's the risk of environment variable side effects?

---

## 13. What is prompt engineering and which techniques have you used?

**Why interviewers ask this:** Tests practical knowledge of shaping LLM outputs.

**Answer:**
Prompt engineering is writing instructions that get the LLM to produce the output you want. I use several techniques. Few-shot prompting gives the model examples of the expected format. Chain-of-thought prompting asks the model to reason step by step. I also use modular prompt chaining, where complex tasks are broken into smaller prompts — one gathers data, another analyzes it, a third formats the output. The key insight is that small changes in wording can dramatically change the model's behavior.

**Follow-up probes:**
- How do you test whether your prompts are effective?
- What's the difference between zero-shot and few-shot prompting?
- How do you handle token limits when prompts get long?

---

## 14. How would you design a multi-model strategy for a financial application?

**Why interviewers ask this:** Tests strategic thinking about cost, performance, and reliability tradeoffs.

**Answer:**
I'd use different models for different tasks based on their strengths. For complex reasoning like investment thesis development, I'd use a strong reasoning model like Claude Opus or GPT-4. For simple lookups like fetching a stock price, I'd use a cheaper, faster model like GPT-4o-mini. For step-by-step reasoning, I'd use specialized reasoning models like DeepSeek-R1. The routing logic would analyze the task complexity and pick the right model automatically. You don't need a Ferrari to drive to the grocery store.

**Follow-up probes:**
- How do you measure whether the cheaper model is good enough?
- What's model distillation and when would you use it?
- How do you handle model degradation over time?

---

## 15. What is RAG and how does it relate to your financial agent?

**Why interviewers ask this:** RAG (Retrieval-Augmented Generation) is a foundational technique for grounding LLMs in real data.

**Answer:**
RAG stands for Retrieval-Augmented Generation. It's a technique where the model first retrieves relevant information from a knowledge base, then generates an answer based on that retrieved data. In my financial agent, I use a similar idea but through tool calls — when someone asks about a company, the agent calls tools to fetch live financial data, news, and market information. This grounds the model in real data, so it can cite real numbers instead of guessing from its training data.

**Follow-up probes:**
- What's the difference between RAG and fine-tuning?
- How do you chunk documents for retrieval?
- What are the limitations of RAG?

---

## 16. How do you handle models with different capabilities and limitations?

**Why interviewers ask this:** Tests awareness of real-world model differences.

**Answer:**
Every model is different. Some support function calling, some don't. Some have 128K context windows, others have 4K. Some require specific parameters — for example, Kimi K2.5 requires temperature to be at least 1.0. I handle this through model-specific overrides in the registry. When a request comes in, the system checks if the model has any overrides and applies them automatically. I also set `litellm.drop_params = True` so unsupported parameters are silently dropped instead of causing errors.

**Follow-up probes:**
- What happens when a model doesn't support function calling?
- How do you handle models with different response formats?
- What's the Codex Responses API and why does it need special handling?

---

## 17. What's the role of observability and tracing in AI systems?

**Why interviewers ask this:** Production AI requires monitoring — understanding what your AI is doing at runtime.

**Answer:**
Observability means you can understand what your system is doing at runtime. I log the full LLM request and response when verbose mode is on — including which tools were called, token counts, and the reasoning chain. Tracing captures the full timeline: what prompt went in, what the model decided, which tool it called, and what the final answer was. This is essential for debugging. Without observability, debugging an agentic system is like trying to fix a car with the hood welded shut.

**Follow-up probes:**
- What tools do you use for observability?
- What's a span versus a trace?
- How do you handle observability in production versus development?

---

## 18. How do you think about AI safety and reliability in a financial context?

**Why interviewers ask this:** Finance is high-stakes — bad AI output can cost real money.

**Answer:**
First, I always fetch real data instead of letting the model guess — function calls ensure we're working with actual market data. Second, I lower the temperature for analytical tasks so outputs are more consistent. Third, the system prompt tells the model to express uncertainty and avoid making investment recommendations — it presents analysis, not advice. Fourth, I track token usage and have iteration limits to prevent runaway loops. Finally, I log everything so there's an audit trail. The goal is an AI system that's useful but honest about what it doesn't know.

**Follow-up probes:**
- How do you prevent the model from giving financial advice?
- What happens if the model generates harmful output?
- How do you handle cases where the model is confidently wrong?

---

## 19. What is model distillation and when would you use it?

**Why interviewers ask this:** Tests understanding of model optimization and cost reduction.

**Answer:**
Model distillation is training a smaller model on the outputs of a larger model. The big model generates high-quality responses, and the small model learns to mimic them. This is useful when you need good performance but can't afford the cost of a large model. For example, smaller distilled versions of DeepSeek-R1 capture some reasoning capabilities at a fraction of the cost. In a financial application, I might use distillation for routine tasks like data formatting — use a large model to generate training data, then train a small model to handle those tasks at 20% of the price.

**Follow-up probes:**
- What are the limitations of distilled models?
- How do you decide which tasks are safe to delegate to smaller models?
- What's the relationship between distillation and fine-tuning?

---

## 20. How do you test and evaluate prompts in your system?

**Why interviewers ask this:** Prompt engineering requires systematic evaluation, not just trial and error.

**Answer:**
I build a test set of questions with expected behaviors — not just expected answers, but expected tool calls and reasoning patterns. For example, a test might check that when asked about Chinese A-shares, the agent calls AKShare instead of Yahoo Finance. I run the full agent and check multiple dimensions: did it call the right tools? Is the reasoning sound? Are the numbers accurate? I also do A/B testing — when I change a prompt, I run both versions and compare. Evals catch regressions before they reach users.

**Follow-up probes:**
- How do you handle non-deterministic outputs in testing?
- What's the difference between evals and unit tests?
- How do you evaluate subjective qualities like "usefulness"?

---

## Quick Reference: Key Terms

| Term | Definition |
|------|------------|
| **Agentic Loop** | Multi-step reasoning cycle: think → act → observe → repeat — like a detective investigating a case |
| **Function Calling** | LLM's ability to invoke external tools via structured output |
| **Chain-of-Thought** | Step-by-step reasoning technique — show your work, not just the answer |
| **RAG** | Retrieval-Augmented Generation — grounding answers in retrieved data |
| **Hallucination** | Model generating confident but factually incorrect information |
| **Context Window** | Maximum tokens a model can process at once — the whiteboard that can only fit so much |
| **Temperature** | Parameter controlling randomness (0 = deterministic, 1 = creative) |
| **Evals** | Systematic tests for AI output quality |
| **Distillation** | Training a smaller model on a larger model's outputs — like a student learning from a master |
| **Gateway Provider** | API proxy that can route to any model from any provider — like a universal power adapter |
