# Interview Questions: Tools & Data Architecture

> **Project**: OpenClaw-Finance — AI financial agent with 10+ data sources
> **Focus**: Data integrations, routing, caching, analytics engines, API design
> **Target role**: Full Stack + AI/ML Intern, BNY Mellon

---

## Glossary (Learn These First!)

| Term | Simple Definition |
|------|-------------------|
| **API** | Application Programming Interface — a way for software to talk to other software |
| **TTL** | Time To Live — how long cached data stays fresh before being re-fetched |
| **OHLCV** | Open, High, Low, Close, Volume — standard stock price data format |
| **Rate Limiting** | Rules that say "you can only call this API X times per minute" — like a bouncer at a club |
| **Async** | Non-blocking — the program can do other things while waiting for a response |
| **Intent Detection** | Figuring out what the user wants to do based on their question |
| **Fuzzy Matching** | Finding similar but not identical text (like "Apple earnings" matching "AAPL earnings report") |
| **Sentiment Analysis** | Using AI to determine the emotional tone in text — is it positive, negative, or neutral? |
| **WACC** | Weighted Average Cost of Capital — the "hurdle rate" for valuing a company (see Finance 101 below) |
| **DCF** | Discounted Cash Flow — a way to value a company by estimating future cash and "discounting" it back to today's dollars (see Finance 101 below) |
| **Beta** | A measure of how much a stock moves compared to the overall market (see Finance 101 below) |
| **P/E Ratio** | Price-to-Earnings — how much you pay for each dollar of profit |
| **Sliding Window** | A rate-limiting approach that counts requests within a moving time period |

---

## Finance 101 — Key Terms You'll See Everywhere

| Term | Plain English | Example |
|------|---------------|---------|
| **P/E Ratio** | Price-to-Earnings — how much you pay for $1 of a company's profit. A P/E of 20 means you pay $20 for every $1 of annual earnings. | "Apple has a P/E of 28" means investors pay $28 for every $1 Apple earns |
| **DCF** | Discounted Cash Flow — a way to estimate what a company is worth by guessing how much cash it'll make in the future, then mathematically "discounting" those future dollars back to today (because $100 next year is worth less than $100 today) | You predict a company will make $10M/year for 10 years, then figure out what that stream of money is worth RIGHT NOW |
| **WACC** | Weighted Average Cost of Capital — the minimum return a company needs to earn to satisfy its investors (both stock holders and lenders). It blends the cost of borrowing money (debt) and the cost of issuing stock (equity). | If WACC is 8%, a project must earn at least 8% to be worth doing |
| **Beta** | How jumpy a stock is compared to the market. Beta of 1 = moves with the market. Beta of 1.5 = 50% more volatile. Beta of 0.5 = half as volatile. | Tech stocks often have high beta (they swing more); utilities have low beta |
| **Free Cash Flow** | Cash a company generates after paying for operations and equipment — the money available to pay investors or reinvest | "Apple generated $100B in free cash flow" means they had $100B left after running the business |
| **Terminal Value** | An estimate of what a company will be worth FAR in the future (usually 5+ years out) — used in DCF models to capture value beyond the forecast period | Most DCF models get 60-80% of their value estimate from the terminal value |

---

## Q1: Walk me through the 10+ data sources in OpenClaw-Finance. Why did you choose each one?

**Why interviewers ask this**: Tests whether you understand the data landscape and made deliberate choices.

**Answer script**:
I connected ten sources covering different financial domains. Yahoo Finance for US stock quotes and fundamentals — free and covers most equities. AKShare for Chinese A-shares because it's the best free source for Shanghai and Shenzhen exchanges. FRED for official US macro data like GDP and CPI. Polymarket and Kalshi for prediction market odds. Tavily and Brave for web search. Twitter/X for social signal scanning. RSS feeds via RSSHub for monitoring Reddit, TikTok, and custom feeds. The key insight: no single API covers all financial domains, so I picked the best source per category.

**Follow-up probes**:
- What happens if one of these sources goes down?
- Why not use a paid provider like Bloomberg?
- How did you handle yfinance being synchronous while your system is async?

---

## Q2: Explain the intent detection system. How does the router know which tools to call?

**Why interviewers ask this**: Tests your understanding of natural language understanding and routing.

**Answer script**:
I built a rule-based intent detector using keyword matching — like a receptionist routing calls. When a query comes in, it extracts tickers using regex patterns, then matches against keyword sets for each intent — price queries, earnings, macro analysis, prediction markets. It calculates a confidence score. The highest-scoring intent wins. The reason I went rule-based instead of using an LLM is speed — no extra API call — and predictability. Same input always gives the same route. Edge cases fall through to a general LLM handler.

**Follow-up probes**:
- What's the confidence score formula and why those weights?
- How would you handle a query like "compare Apple and Tesla sentiment" that mixes intents?
- What happens when the confidence is too low to classify?

---

## Q3: The system uses an LLM sub-agent pattern. Why not just have one LLM do everything?

**Why interviewers ask this**: Tests architectural thinking about separation of concerns and cost optimization.

**Answer script**:
The outer LLM handles conversation and user interaction — it's a general-purpose model like Claude. The inner LLM is specialized per domain. For example, the equity valuation router has a focused prompt about DCF models, while the social signal router has a prompt about sentiment analysis. The outer LLM calls a router tool, which runs the inner LLM with domain-specific tools. The trade-off is latency — two LLM calls instead of one — but accuracy improves because each inner prompt is narrow. It also saves tokens.

**Follow-up probes**:
- How many tool iterations can the inner LLM make per query?
- What happens if the inner LLM calls a tool that errors out?
- Could you replace the inner LLM with a smaller model?

---

## Q4: How does the social signal processing pipeline work end-to-end?

**Why interviewers ask this**: Tests your understanding of multi-stage data pipelines and integrating unstructured data.

**Answer script**:
It's a three-stage pipeline: Scan, Score, Correlate. In Scan, the system fetches posts from Twitter, Reddit, and news sources in parallel. Each post gets deduplicated, then sent to an LLM that extracts market-relevant keywords and assigns a sentiment score from 1 to 10. Signals above a threshold move to Score, where I query financial data APIs for real market data. In Correlate, the system identifies whether social signals precede or follow market movements. The pipeline is read-only — it never takes action without user direction.

**Follow-up probes**:
- How do you deduplicate social media posts across platforms?
- What signal categories have the highest predictive value?
- How would you prevent the system from being used for market manipulation?

---

## Q5: Explain your caching strategy. Why are TTLs different for different data types?

**Why interviewers ask this**: Tests understanding of data freshness, storage trade-offs, and cost optimization.

**Answer script**:
Not all financial data ages at the same speed. Price queries have zero TTL — never cached because prices change every second. Prediction market odds get 5-minute cache. Market search results get 1 day. Financial analysis gets 7 days because fundamentals change slowly. Earnings data gets 30 days because companies report quarterly. The cache is stored on disk with an index file. I also have an in-memory **cache** (like keeping frequently used tools on your desk) for AKShare's full-market data with a 10-minute TTL because fetching the entire Chinese market is expensive. The principle: cache aggressively for slow-changing data, never for real-time data.

**Follow-up probes**:
- What happens when a cached entry expires but the API is rate-limited?
- How would you scale this cache to multiple server instances?
- Why disk cache instead of Redis?

---

## Q6: How do you handle rate limiting across 10+ different APIs?

**Why interviewers ask this**: Tests practical understanding of API integration and resilience.

**Answer script**:
Each API has different limits: AKShare is 1 req/sec, Polymarket and Kalshi are 300/min. I track requests using a sliding window counter — like a bouncer at a club counting how many people entered in the last minute. When a limit is hit, the tool returns a structured error instead of crashing — the inner LLM can retry or inform the user. I also use caching to reduce unnecessary API calls. The design principle is graceful degradation: if one source is rate-limited, the system continues with other sources.

**Follow-up probes**:
- What does the sliding window look like in code?
- How would you handle a data provider's free vs pro tier?
- What's your retry strategy — exponential backoff or immediate retry?

---

## Q7: Describe the prediction market cross-platform comparison feature.

**Why interviewers ask this**: Tests your ability to integrate different APIs and present unified insights.

**Answer script**:
Polymarket and Kalshi are two prediction market platforms with different APIs. The comparison feature searches both, then uses fuzzy title matching with a similarity threshold of 0.55 to pair markets about the same event. It shows odds side-by-side so users can see where one platform offers better prices. Markets that only exist on one platform are flagged. This is valuable because prediction market prices can diverge significantly, creating arbitrage opportunities or indicating different crowd sentiment.

**Follow-up probes**:
- What happens when fuzzy matching returns false positives?
- How would you handle events with different outcome structures?
- Could you build an alert system when odds diverge by more than X%?

---

## Q8: Why did you use rule-based intent detection instead of an LLM classifier?

**Why interviewers ask this**: Tests your judgment on when simple solutions beat complex ones.

**Answer script**:
Three reasons. First, speed: keyword matching takes microseconds, while an LLM call takes seconds. Second, predictability: the same query always routes to the same intent. Third, cost: every LLM call costs tokens. Rule-based detection covers about 90% of cases. The remaining 10% fall through to a general LLM handler. For a project of this scope, keywords with confidence scoring is the right trade-off.

**Follow-up probes**:
- What queries fail the keyword detector?
- How would you improve intent detection over time?
- What's the confidence threshold below which you fall through?

---

## Q9: How does the equity valuation engine work? Walk me through a DCF model.

**Why interviewers ask this**: Tests financial domain knowledge.

**Answer script**:
The equity valuation engine supports 10 models including DCF, Gordon Growth, multiples valuation, and residual income. For a **DCF** (Discounted Cash Flow — a way to value a company by estimating future cash and "discounting" it back to today's dollars), the system pulls free cash flow data from Yahoo Finance, applies a discount rate using **WACC** (Weighted Average Cost of Capital — the minimum return a company needs to earn to satisfy its investors). It projects cash flows for 5 years, calculates a terminal value using a 2.5% growth rate, then discounts everything back to present value. If the intrinsic value is more than 15% above the current price, it recommends BUY.

**Follow-up probes**:
- How sensitive is the model to changes in the terminal growth rate?
- What assumptions would you change for a tech company vs a utility?
- How do you handle negative free cash flow in a DCF?

---

## Q10: Explain the async architecture. Why wrap synchronous libraries in `asyncio.to_thread()`?

**Why interviewers ask this**: Tests understanding of concurrency and Python async patterns.

**Answer script**:
Libraries like yfinance are synchronous — they block while waiting for HTTP responses. But my web server uses an async event loop to handle multiple requests concurrently. If I call yfinance directly, it blocks the entire loop. By wrapping each call in `asyncio.to_thread()`, the synchronous library runs in a separate thread while the event loop stays free. This gives me the simplicity of synchronous libraries with the throughput of async architecture.

**Follow-up probes**:
- What are the thread pool implications for memory usage?
- How would you replace this with fully async HTTP clients?
- What happens if all threads in the pool are busy?

---

## Q11: How does the system handle errors from financial APIs?

**Why interviewers ask this**: Tests understanding of fault tolerance.

**Answer script**:
Every tool returns structured error responses instead of raising exceptions. If an API returns a rate limit error, a network timeout, or invalid data, the tool wraps it in a consistent error format. The inner LLM receives this error and can decide to retry, try an alternative data source, or explain the limitation to the user. This keeps the system operational even when individual sources fail. If FRED is down, the system still works for stock queries.

**Follow-up probes**:
- What does the error response schema look like?
- How do you test error handling without breaking APIs?
- What's the retry limit before giving up?

---

## Q12: How do you normalize data from Yahoo Finance and AKShare into a consistent format?

**Why interviewers ask this**: Tests data engineering skills — handling different schemas and conventions.

**Answer script**:
Yahoo Finance returns data in English with standard column names, while AKShare returns Chinese column names. I built a mapping layer that translates AKShare's Chinese headers to English equivalents. Both sources return OHLCV data but with different timestamp formats. I normalize timestamps to UTC and standardize column names so downstream tools don't need to know which source the data came from. For Chinese stocks, I also handle exchange suffixes — Shanghai ends in `.SH`, Shenzhen in `.SZ`.

**Follow-up probes**:
- How do you handle the same stock trading on multiple exchanges?
- What about currency conversion between USD and CNY?
- How would you add a third data source like Bloomberg?

---

## Q13: Explain the social signal scoring system. What makes a signal score high?

**Why interviewers ask this**: Tests how you quantify subjective concepts.

**Answer script**:
The LLM assigns each signal a score from 1 to 10 across categories ranked by market relevance. Macroeconomic events score 8-10 because they have immediate market-wide impact. Sector-specific trends score 6-9. Individual company news scores 5-8. Generic market commentary scores 1-3. The score also factors in platform source — trending on Twitter with cross-platform mentions on Reddit scores higher. Candidates below a minimum score threshold, default 3, are filtered out entirely.

**Follow-up probes**:
- How do you handle false positives?
- Could you use engagement metrics to improve scoring?
- How would you detect coordinated manipulation?

---

## Q14: Why use two separate APIs for prediction markets (Gamma + CLOB) on Polymarket?

**Why interviewers ask this**: Tests understanding of API decomposition.

**Answer script**:
Polymarket splits its data across two APIs for a reason. The Gamma API handles metadata — what events exist, their categories, descriptions. The CLOB API handles actual trading data — current prices, order book depth, historical timeseries. By using both, I get the best of each: Gamma for discovery and CLOB for real-time pricing. It also means if one API has downtime, the other can still provide partial functionality.

**Follow-up probes**:
- How do you correlate a Gamma market ID with a CLOB token ID?
- What's the latency difference between the two APIs?
- How would you handle API version changes?

---

## Q15: How would you improve this system if you had to handle 10x more concurrent users?

**Why interviewers ask this**: Tests scaling thinking and bottleneck identification.

**Answer script**:
Three areas. First, the cache: disk-based caching works for a single instance but wouldn't share state across servers — I'd move to Redis. Second, the LLM calls: the inner LLM is the bottleneck since each query requires two LLM calls. I'd pre-compute common analyses or use a smaller fine-tuned model. Third, rate limits: with 10x users, API rate limits become the binding constraint. I'd add a request queue with priority levels and consider **WebSocket** (a two-way communication channel that stays open — like a phone call vs sending a letter) subscriptions for live data instead of polling.

**Follow-up probes**:
- How would you shard the cache across instances?
- What monitoring would you add to detect bottlenecks?
- How do you prioritize which queries get served first?

---

## Q16: What would you change about the data architecture if you were rebuilding from scratch?

**Why interviewers ask this**: Tests self-awareness and design maturity.

**Answer script**:
Three things. First, I'd define a formal data schema — a Pydantic model for each data type so all tools return typed objects instead of dictionaries. This catches errors at development time. Second, I'd add an abstraction layer for data sources, like a DataSource interface that each provider implements. That way adding a new source doesn't require modifying the router. Third, I'd separate the caching layer into its own service from the start. A standalone cache service would be reusable across all routers and easier to swap for Redis later.

**Follow-up probes**:
- How would you version your data schemas as APIs change?
- What testing strategy would you use for the abstraction layer?
- How do you balance abstraction with getting things done?

---

## Quick Reference: Key Concepts to Know

| Concept | Where It Appears | Why It Matters |
|---------|-----------------|----------------|
| Async wrapping (`asyncio.to_thread`) | All data tools | Non-blocking I/O for sync libraries |
| Rule-based intent detection | `intent.py` | Fast, predictable query routing |
| LLM sub-agent pattern | Router architecture | Domain-specialized tool orchestration |
| TTL-based caching | `cache.py` | Fresh data without redundant API calls |
| Sliding window rate limiting | Per-API modules | Respecting provider limits (like a bouncer at a club) |
| Structured error responses | All tools | Graceful degradation, LLM retry logic |
| Fuzzy title matching | Prediction markets | Cross-platform market correlation |
| Three-stage signal pipeline | Scan → Score → Correlate | Safety through read-only analysis |
