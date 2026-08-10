# OpenClaw-Finance: Financial Tools & Data Sources Analysis

## Table of Contents
1. [Data Sources Overview](#1-data-sources-overview)
2. [What Each Data Source Provides](#2-what-each-data-source-provides)
3. [Financial Routing System](#3-financial-routing-system)
4. [Meme Coin Pipeline](#4-meme-coin-pipeline)
5. [Prediction Market Integration](#5-prediction-market-integration)
6. [Analytics Engines](#6-analytics-engines)
7. [Financial Memory & Caching](#7-financial-memory--caching)
8. [Key Design Decisions](#8-key-design-decisions)

---

## 1. Data Sources Overview

OpenClaw-Finance connects to **7 major financial data sources**:

| Source | Type | API Key Required | Purpose |
|--------|------|-----------------|---------|
| Yahoo Finance (yfinance) | Stock market data | No | US/global stock quotes, fundamentals, earnings |
| AKShare | Chinese A-share data | No | China market quotes, sectors, indices, news |
| FRED | US macroeconomic data | Yes (free) | GDP, CPI, unemployment, Fed funds rate |
| DexScreener | DeFi/meme coin data | No | Token prices, liquidity, trading pairs |
| CoinGecko | Crypto market data | No (Pro optional) | Coin prices, market caps, trending coins |
| Polymarket | Prediction markets | No | Event betting odds, probability history |
| Kalshi | Prediction markets | No | Event contracts, market data |

**Additional data sources** (embedded within tools):
- **SEC EDGAR**: US corporate filings (10-K, 10-Q)
- **Financial news**: Bloomberg, MarketWatch, Google News RSS
- **Social media**: Twitter/X (via twikit), Reddit, Truth Social, TikTok (via RSSHub)

---

## 2. What Each Data Source Provides

### 2.1 Yahoo Finance (`yfinance_tool.py`)

**Purpose**: The primary source for US and global stock market data.

**Commands**:
- `quote` / `batch_quotes` - Real-time stock prices
- `historical` / `historical_price` - Past price data (OHLCV)
- `info` - Company fundamentals (P/E, market cap, margins, etc.)
- `financials` - Income statement, balance sheet, cash flow
- `company_profile` / `financial_ratios` - Peer comparison data
- `search` - Find stock symbols by keyword
- `resolve_symbol` - Auto-detect exchange suffix (.NS for India, .BO for BSE)
- `analyst_estimates` - Consensus EPS, price targets, recommendations

**Key feature**: All synchronous calls are wrapped in `asyncio.to_thread()` so they don't block the event loop.

### 2.2 AKShare (`akshare_tool.py`)

**Purpose**: Chinese A-share market data (Shanghai/Shenzhen exchanges).

**Commands**:
- `quote` - Real-time A-share prices
- `historical` - Daily K-line data
- `info` - Company basic information
- `financials` - Financial report abstracts
- `search` - Search by stock name/code
- `sector_performance` - Industry sector rankings
- `index_quotes` - Major indices (SSE Composite, CSI 300, ChiNext)
- `news` - Recent stock news from East Money

**Special features**:
- Rate limiting (1 request per second)
- In-memory cache for full-market spot data (10-minute TTL)
- Chinese column names are automatically mapped to English

### 2.3 FRED (Federal Reserve Economic Data)

**Purpose**: Official US macroeconomic time series.

**Available indicators** (via `economics_data_tool.py`):
- **Growth**: GDP, GDP growth rate
- **Inflation**: CPI, core CPI (with automatic YoY calculation)
- **Employment**: Unemployment rate
- **Monetary policy**: Fed funds rate, M2 money supply
- **Markets**: Yield curve (2Y, 10Y, 30Y), credit spreads, VIX
- **Activity**: Industrial production, retail sales, housing starts
- **Sentiment**: Consumer sentiment (UMich)

**Commands**:
- `fred_series` - Fetch any FRED series by ID
- `indicators` - Multi-series dashboard in one call
- `calendar` - Economic release calendar (what's being released today/this week)

### 2.4 DexScreener (`meme_data_tool.py`)

**Purpose**: Decentralized exchange (DEX) data for meme coins and DeFi tokens.

**Provides**:
- Token search by name/symbol
- Trading pair data (price, volume, liquidity)
- Trending/boosted tokens
- Token-specific pair data on any chain

**Rate limit**: 300 requests/minute (no key needed)

### 2.5 CoinGecko (`meme_data_tool.py`)

**Purpose**: Comprehensive crypto market data.

**Provides**:
- Coin search and detailed info
- Trending coins (top 7)
- Price data with market cap, 24h volume, 24h change
- Community data (Twitter followers, Reddit subscribers)

**Rate limits**:
- Free tier: 30 requests/minute
- Pro tier: 500 requests/minute (optional API key)

### 2.6 Polymarket (`prediction_market_data_tool.py`)

**Purpose**: Prediction market data for event betting.

**APIs used**:
- **Gamma API** - Market metadata, events, categories
- **CLOB API** - Prices, order book, historical timeseries

**Provides**:
- Trending markets by 24h volume
- Market search by keyword
- Event details with outcomes and odds
- Price history for tokens (probability over time)
- Cross-platform comparison with Kalshi

### 2.7 Kalshi (`prediction_market_data_tool.py`)

**Purpose**: US-regulated prediction market (event contracts).

**Provides**:
- Trending events by aggregated volume
- Market search by keyword
- Detailed market odds (Yes/No prices)
- Event details with nested markets
- Series/categories listing

---

## 3. Financial Routing System

### 3.1 Intent Detection (`intent.py`)

The system uses **rule-based keyword matching** to classify user queries:

```
User Query → FinancialIntentDetector → Intent Type → Router
```

**Intent types**:
- `price_query` - "What's AAPL's price?"
- `earnings_calendar` - "When does NVDA report?"
- `financial_analysis` - "Analyze Apple's 10-K"
- `market_search` - "Find Tesla stock"
- `macro_analysis` - "What's the current business cycle?"
- `meme` - "Find trending meme coins"
- `prediction_market` - "What are the odds on Polymarket?"

**Detection logic**:
1. Extract tickers using regex patterns (e.g., `$AAPL`, `600519.SH`, `BTC-USD`)
2. Match against keyword sets (FINANCIAL_KEYWORDS, MEME_KEYWORDS, etc.)
3. Calculate confidence score: `min(1.0, tickers * 0.4 + keywords * 0.2)`
4. Return the highest-priority intent type

### 3.2 Router Architecture (LLM Sub-Agent Pattern)

All routers follow the **Dexter-inspired pattern**:

```
User Query → Outer LLM → Router Tool → Inner LLM → Data Tools → Results
```

**Why this pattern?**
- The outer LLM (Claude) handles conversation and user interaction
- The inner LLM (smaller/faster) handles tool orchestration
- Specialized prompts for each domain (equity, economics, meme, etc.)
- Inner LLM can call multiple tools in parallel

### 3.3 Available Routers

| Router | Name | Purpose |
|--------|------|---------|
| `FinancialMetricsRouter` | `financial_metrics` | Company financials, earnings, SEC filings |
| `FinancialSearchRouter` | `financial_search` | Market data, news, company info |
| `EconomicsRouter` | `economics_analysis` | CFA-level macroeconomic analysis |
| `EquityValuationRouter` | `equity_valuation` | DCF, DDM, multiples, fundamental ratios |
| `MemeRouter` | `meme` | Meme coin data, social scanning, deployment |
| `PredictionMarketRouter` | `prediction_market` | Polymarket + Kalshi data |

### 3.4 Example Flow: "Analyze Apple's earnings"

1. **Intent detection**: Matches "earnings" keyword → `earnings_calendar` intent
2. **Router selection**: Routes to `FinancialMetricsRouter`
3. **Inner LLM execution**:
   - Calls `yfinance_tool` with `command=financials` (income statement)
   - Calls `earnings_calendar` with `command=surprise` (beat/miss history)
   - Calls `yfinance_tool` with `command=analyst_estimates` (price targets)
4. **Result synthesis**: Inner LLM formats data into structured table
5. **Format hint**: System appends `_EARNINGS_FORMAT_HINT` for consistent output

---

## 4. Meme Coin Pipeline

The meme coin system follows a **3-stage pipeline**: Scan → Confirm → Deploy.

### 4.1 Stage 1: Scan (Social Media Monitoring)

**Tool**: `MemeSearchTool` (`meme_search_tool.py`)

**Data sources**:
- **Twitter/X**: Via RSSHub proxies or twikit (authenticated)
- **Reddit**: r/wallstreetbets, r/CryptoCurrency, r/memecoins, r/investing
- **Truth Social**: Trump's posts (via RSSHub)
- **TikTok**: #memecoin hashtag (via RSSHub)
- **Google News**: Bitcoin and meme coin news

**Process**:
1. Fetch posts from all configured feeds in parallel
2. Deduplicate using seen-tweet/seen-RSS ID caches
3. Send each post to LLM for meme word extraction
4. LLM returns: `meme_word`, `ticker_suggestion`, `category`, `meme_score` (1-10), `confidence`
5. Filter by minimum meme score (default: 3)
6. Rank by score and present candidates to user

**Meme categories** (ranked by viral potential):
1. CURRENT_EVENT (8-10) - Breaking news, political moments
2. ANIMAL (6-9) - Dogs, frogs, cats with modifiers
3. CELEBRITY_REF (6-9) - References to public figures
4. INTERNET_SLANG (5-8) - New neologisms
5. ABSURDIST (5-8) - Deliberately stupid names
6. AI_TECH (5-8) - AI/tech narrative coins
7. POP_CULTURE (4-7) - Movies, games, anime
8. FOOD_OBJECT (4-7) - Random objects as tokens
9. POLITICAL (4-7) - Political movements
10. GENERIC_CRYPTO (1-3) - Recycled terms (HODL, MOON)

### 4.2 Stage 2: Confirm (Market Data)

**Tool**: `MemeDataTool` (`meme_data_tool.py`)

**Data sources**:
- **DexScreener**: Token prices, liquidity, trading pairs
- **CoinGecko**: Market cap, community data, coin info

**Operations**:
- `search_token` - Find token across both platforms
- `get_trending` - See what's hot right now
- `cg_coin_info` - Detailed coin metadata
- `polymarket_trending` - Prediction market signals for meme catalysts

### 4.3 Stage 3: Deploy (Token Creation)

**Tool**: `MemeCreateTool` (`meme_create_tool.py`)

**Supported platforms**:

#### pump.fun (Solana)
1. Upload image + metadata to IPFS
2. Build transaction via PumpPortal API
3. Sign with Solana keypair
4. Broadcast to Solana RPC
5. Returns: mint address, transaction signature, pump.fun URL

#### four.meme (BSC)
1. Authenticate with four.meme API (wallet signature)
2. Upload image to four.meme
3. Prepare create arguments (name, symbol, description)
4. Call TokenManager2.createToken on BSC
5. Returns: token address, transaction hash, four.meme URL

**Safety features**:
- `check_env` command verifies wallet credentials before creation
- User confirmation required at outer LLM level
- Credentials stored in config.json (never hardcoded)

---

## 5. Prediction Market Integration

### 5.1 Architecture

```
PredictionMarketRouter → PredictionMarketTool → PredictionMarketDataTool
                                                   ↓
                                            Polymarket API + Kalshi API
```

### 5.2 Polymarket Integration

**APIs**:
- **Gamma API** (`gamma-api.polymarket.com`): Market metadata, events, tags
- **CLOB API** (`clob.polymarket.com`): Prices, order book, historical timeseries

**Key features**:
- Binary markets (Yes/No outcomes)
- Multi-outcome events (e.g., "Who will win the election?")
- Price history with pre-computed summary statistics
- Cross-platform comparison with Kalshi

### 5.3 Kalshi Integration

**API**: `api.elections.kalshi.com/trade-api/v2`

**Key features**:
- US-regulated event contracts
- Markets nested within events
- Volume aggregation across nested markets

### 5.4 Cross-Platform Comparison

The `compare_markets` function:
1. Searches both platforms for the same query
2. Uses fuzzy title matching (difflib.SequenceMatcher, threshold: 0.55)
3. Pairs matching markets and shows odds side-by-side
4. Identifies platform-only markets

### 5.5 Commands

- `trending` - Top markets by 24h volume
- `search` - Find markets by keyword
- `market_detail` - Current outcomes/odds
- `market_history` - Detail + price history in one call
- `top_mover` - Trending #1 market with full detail
- `compare` - Cross-platform odds comparison
- `categories` - List/filter by category

---

## 6. Analytics Engines

### 6.1 Equity Valuation (`analytics/equity/`)

**Models available**:

| Model | File | Purpose |
|-------|------|---------|
| FCFF | `dcf_models.py` | Free Cash Flow to Firm (WACC discounting) |
| FCFE | `dcf_models.py` | Free Cash Flow to Equity |
| Gordon Growth | `dividend_models.py` | Constant growth DDM |
| Two-Stage DDM | `dividend_models.py` | High-growth → stable transition |
| H-Model DDM | `dividend_models.py` | Linear growth decline |
| Three-Stage DDM | `dividend_models.py` | High → transition → stable |
| Multiples | `multiples_valuation.py` | P/E, P/B, EV/EBITDA |
| Residual Income | `residual_income.py` | Book value + excess returns |
| EVA | `residual_income.py` | Economic Value Added |
| Fundamental Ratios | `fundamental_analysis.py` | Profitability, liquidity, solvency |

**Default assumptions**:
- Risk-free rate: 4.5% (10Y Treasury)
- Equity risk premium: 5.5%
- Terminal growth: 2.5%
- Forecast years: 5
- Recommendation threshold: ±15% upside for BUY/SELL

### 6.2 Economic Analysis (`analytics/economics/`)

**Models available**:

| Model | File | Purpose |
|-------|------|---------|
| Currency Analysis | `fx/currency_analysis.py` | Spot/forward FX, carry trade |
| Exchange Calculations | `fx/exchange_calculations.py` | Cross-rates, forward points, CIP |
| Growth Analysis | `macro/growth_analysis.py` | GDP decomposition, potential GDP |
| Market Cycles | `macro/market_cycles.py` | Business cycle phase detection |
| Policy Analysis | `macro/policy_analysis.py` | Monetary policy, Taylor Rule |
| Capital Flows | `macro/capital_flows.py` | BOP analysis, FX market structure |
| Trade Analysis | `macro/trade_geopolitics.py` | Trade benefits/costs, geopolitical risk |
| Statistical Analysis | `analysis/analytics_engine.py` | ADF, ARIMA, correlation |
| Forecasting | `analysis/analytics_engine.py` | Exponential smoothing, trend forecasting |
| Scenario Analysis | `analysis/analytics_engine.py` | Monte Carlo simulation |

**Taylor Rule implementation**:
```
r = r* + π + 0.5*(π − π*) + 0.5*(y − y*)
```
Where:
- r* = 2.0% (neutral real rate)
- π* = 2.0% (inflation target)
- y - y* ≈ -2*(u - u*) (Okun's law proxy)

---

## 7. Financial Memory & Caching

### 7.1 Cache Architecture (`cache.py`)

**Directory layout**:
```
financial_data/
├── index.json                    # Cache metadata
├── raw/{TICKER}/                 # Raw API responses
│   └── {YYYYMMDD}_{type}.json
└── analysis/{TICKER}/           # Analysis results
    └── {YYYYMMDD}_{TICKER}_{topic}_analysis.json
```

### 7.2 TTL (Time-To-Live) Configuration

| Task Type | TTL | Reason |
|-----------|-----|--------|
| `price_query` | 0 (never cache) | Real-time data |
| `financial_analysis` | 7 days | Fundamentals change slowly |
| `earnings_data` | 30 days | Quarterly reports |
| `market_search` | 1 day | Search results moderate |
| `prediction_market` | 5 minutes | Odds change rapidly |

### 7.3 Cache Operations

- `lookup(tickers, task_type)` - Find non-expired entries
- `save_raw(ticker, data_type, data)` - Store raw API response
- `save_analysis(ticker, topic, analysis)` - Store analysis result
- `add_index_entry(...)` - Add metadata to index.json

### 7.4 In-Memory Caching

**AKShare spot data**: 10-minute TTL for full-market data (expensive to fetch)

**Rate limiting**: Module-level tracking with sliding window:
- AKShare: 1 request/second
- DexScreener: 300 requests/minute
- CoinGecko: 30 or 500 requests/minute (free/pro)
- Polymarket/Kalshi: 300 requests/minute each

---

## 8. Key Design Decisions

### 8.1 LLM Sub-Agent Pattern (Dexter-inspired)

**Decision**: Each router runs an inner LLM with specialized tools.

**Why**:
- Separates concerns: outer LLM handles conversation, inner LLM handles data
- Specialized prompts improve accuracy for each domain
- Inner LLM can call multiple tools in parallel
- Reduces token usage (inner prompts are focused)

**Trade-off**: Adds latency (two LLM calls per query) but improves quality.

### 8.2 Dual Data Source Strategy

**Decision**: FRED for official US macro data, yfinance for market-based data.

**Why**:
- FRED provides authoritative government statistics
- yfinance provides real-time market data (FX, yields, commodities)
- Combining both gives comprehensive macro picture

### 8.3 Rule-Based Intent Detection

**Decision**: Use keyword matching instead of LLM for intent classification.

**Why**:
- Faster (no LLM call needed)
- More predictable (same input → same output)
- Saves tokens (only triggers financial routers when relevant)
- Covers ~90% of cases; falls through to general LLM for edge cases

### 8.4 Meme Coin Safety Model

**Decision**: Three-stage pipeline with human confirmation.

**Why**:
- Prevents accidental token creation
- Social scanning is read-only (no financial risk)
- Market data is informational only
- Deployment requires explicit user confirmation

### 8.5 Async-First Architecture

**Decision**: All tools use `asyncio.to_thread()` for synchronous libraries.

**Why**:
- yfinance, akshare are synchronous (blocking)
- Web server needs to handle multiple requests
- Non-blocking I/O improves throughput
- Consistent interface across all tools

### 8.6 Graceful Degradation

**Decision**: All tools return structured errors instead of raising exceptions.

**Why**:
- Inner LLM can handle errors and retry or explain
- User gets meaningful error messages
- System stays operational even when APIs fail
- Rate limits are handled transparently

### 8.7 No API Keys for Most Tools

**Decision**: Minimize API key requirements.

**Why**:
- Easier onboarding (no signup friction)
- DexScreener, CoinGecko, Polymarket, Kalshi all have free tiers
- FRED key is free and optional (yfinance works without it)
- CoinGecko Pro key is optional (higher rate limits)

---

## Summary

OpenClaw-Finance is a comprehensive financial analysis platform that:

1. **Connects to 7+ data sources** covering stocks, crypto, macro, and prediction markets
2. **Uses LLM sub-agents** for specialized domain expertise
3. **Implements a meme coin pipeline** with social scanning, market data, and deployment
4. **Provides CFA-level analytics** for equity valuation and economic analysis
5. **Caches intelligently** with TTL-based expiration
6. **Prioritizes safety** with human-in-the-loop for financial actions
7. **Handles errors gracefully** with structured responses and rate limiting

The architecture balances **comprehensiveness** (many data sources) with **simplicity** (rule-based routing, async-first design) while maintaining **safety** (confirmation required for deployments).
