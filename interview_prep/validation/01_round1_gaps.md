# Round 1 Gap Analysis — Interview Prep Files

> **Reviewed by:** Critical Reviewer (no prior context)
> **Files reviewed:** 01_core_architecture, 02_tools_data, 03_ai_ml, 04_bonus_technical, 05_hr_behavioral, 06_system_design, 07_gotcha_edge
> **Date:** 2026-08-10
> **Role:** Full Stack + AI/ML Intern, BNY Mellon

---

## Overall Coverage Quality: 6.5 / 10

**Strengths:** Solid coverage of the agent loop, message bus, channels, and basic system design. The gotcha section is excellent. The HR/behavioral section is well-structured with STAR answers.

**Critical Weakness:** The prep material is heavily biased toward high-level architecture and almost completely ignores the actual code implementation details. A BNY Mellon interviewer who reads the code will ask questions the candidate cannot answer.

---

## 1. MISSING TOPICS — What a BNY Interviewer Would Ask

### A. SEC EDGAR Integration (CRITICAL GAP)

The project has a full `sec_edgar_tool.py` (680 lines) that fetches and parses 10-Q/10-K filings. This is the most "enterprise finance" feature in the entire codebase and there are ZERO questions about it. A BNY Mellon interviewer working in custody/fund services would absolutely ask:

- "Walk me through how you parse SEC filings. What's in a 10-K?"
- "How do you handle XBRL data from EDGAR?"
- "What financial facts do you extract from filings?"
- "How do you handle the SEC's rate limits and User-Agent requirements?"
- "What's the difference between 10-Q and 10-K filings?"

### B. Earnings Calendar & Analyst Estimates

The `earnings_tool.py` (414 lines) covers earnings dates, surprises, consensus estimates, and revision tracking. Zero questions cover this. A BNY interviewer would ask:

- "How do you track earnings surprises — actual vs estimate?"
- "How do you use analyst estimate revisions as signals?"
- "Walk me through your earnings calendar feature."

### C. Equity Valuation Analytics Engine

The `analytics/equity/` directory contains a full valuation engine with DCF, multiples, DDM, and fundamental analysis models. While Q9 in 02_tools_data.md mentions DCF briefly, there are no questions about:

- The full suite of 10 valuation models (FCFF, FCFE, Gordon Growth, 2-stage/3-stage DDM, residual income, multiples)
- The `validators.py` for input validation
- The `base_models.py` data structures
- How the valuation engine integrates with the agent loop
- Sensitivity analysis on valuation assumptions

### D. Economics & Macro Analytics Engine

The `analytics/economics/` directory has extensive modules: FX analysis, capital flows, market cycles, policy analysis, trade geopolitics, growth analysis, and a full reporting engine. Zero questions cover this. This is exactly the kind of work BNY does.

### E. Skills System

The `skills.py` (230 lines) implements a full skill loading system with workspace and builtin skills, requirements checking, and dynamic loading. Zero questions about this.

### F. Heartbeat Service

The `heartbeat/service.py` implements a periodic wake-up service. Zero questions about this. This is relevant to background task scheduling patterns.

### G. LLM Router / Inner Sub-Agent Pattern (Partial Coverage)

Q3 in 02_tools_data.md mentions the LLM sub-agent pattern, but the actual implementation in `llm_router.py` (275 lines) is much deeper. No questions about:

- The `_run_inner_agent()` implementation
- How inner tools are built and scoped
- How inner agent results are returned to the outer agent
- Error propagation from inner to outer agent

### H. SubagentManager

The `subagent.py` file manages background workers. Q21 in 01_core_architecture.md touches on this but doesn't go deep enough into:

- How subagents are tracked
- Result delivery back to the originating channel
- Subagent lifecycle management
- Memory isolation between subagents

---

## 2. MISSING QUESTIONS FROM EACH CATEGORY

### 01_core_architecture.md

**Missing:**
1. "How does the SkillsLoader work and why is it separate from the ToolRegistry?"
2. "Walk me through the analytics engine architecture — equity and economics modules."
3. "How does the heartbeat service coordinate with the agent loop?"
4. "What's the difference between the LLM Router tool and direct tool calls?"
5. "How do you handle the SEC EDGAR User-Agent requirement and rate limiting?"
6. "Explain the data flow from SEC filing → parsed financial facts → agent reasoning."
7. "How does the system handle multiple concurrent subagents?"

### 02_tools_data.md

**Missing:**
1. "Walk me through the SEC EDGAR integration. How do you parse 10-K filings?"
2. "How does the earnings calendar track surprises and estimate revisions?"
3. "Explain the full equity valuation engine — what models are available?"
4. "How does the FX/currency analysis work?"
5. "How do the economics modules (capital flows, market cycles, policy analysis) work together?"
6. "How do you handle data normalization across Yahoo Finance, AKShare, and SEC EDGAR?"
7. "What's the reporting engine in analytics/economics/reporting?"

### 03_ai_ml.md

**Missing:**
1. "How do you evaluate the quality of financial analysis output — not just correctness but analytical depth?"
2. "How do you handle the trade-off between model cost and analysis quality for different query types?"
3. "How does the system handle models that don't support structured output or function calling?"
4. "What's your approach to prompt versioning and A/B testing prompts?"
5. "How do you detect and handle model degradation over time?"
6. "How do you handle PII in financial conversations — names, portfolio values?"
7. "What safety guardrails exist for the shell execution tool?"

### 04_bonus_technical.md

**Missing:**
1. "Walk me through the SEC EDGAR HTTP client — how do you handle retries and rate limits?"
2. "How does the Feishu channel handle rich text parsing and card elements?"
3. "How does the email channel handle consent and what are the security implications?"
4. "Walk me through the Mochat channel — what is it and why did you add it?"
5. "How does the QQ channel differ from other Chinese platforms?"
6. "How does the DingTalk channel handle its specific auth model?"
7. "Explain the full Docker Compose setup — what services run and how do they connect?"
8. "How do you handle secrets in Docker — environment variables vs mounted files?"

### 05_hr_behavioral.md

**Missing:**
1. "Tell me about a time you had to debug a production issue under time pressure."
2. "Describe a situation where you had to make a technical trade-off between speed and quality."
3. "How do you handle working on a project with no clear requirements?"
4. "Tell me about a time you disagreed with a technical decision and how you handled it."
5. "How do you prioritize when everything seems important?"
6. "What's the biggest mistake you made in this project and what did you learn?"
7. "How do you handle feedback that you disagree with?"
8. "Tell me about a time you had to learn a new domain (finance) quickly."
9. "How do you ensure code quality when working solo?"
10. "Describe your approach to documentation."

### 06_system_design.md

**Missing:**
1. "How would you design the equity valuation engine as a microservice?"
2. "How would you design a multi-tenant system where different users have different data access permissions?"
3. "How would you design the SEC EDGAR integration for enterprise use — handling compliance, audit trails, and data retention?"
4. "How would you design a notification system for earnings alerts and price thresholds?"
5. "How would you handle data governance — who can access what financial data?"
6. "How would you design the system for regulatory compliance (SEC, FINRA)?"

### 07_gotcha_edge.md

**Missing:**
1. "What happens if SEC EDGAR returns malformed XBRL data?"
2. "What if the earnings calendar has stale estimate data?"
3. "What if two subagents try to access the same financial cache simultaneously?"
4. "What if the heartbeat service fires while a user query is being processed?"
5. "What happens if the LLM Router's inner agent enters an infinite loop?"
6. "What if a skill file references a tool that isn't registered?"
7. "What happens when the email channel receives a phishing email — does the agent process it?"
8. "What if a user sends a command that triggers shell execution — what's the blast radius?"

---

## 3. AREAS NEEDING MORE DEPTH

### A. SEC EDGAR (Priority: CRITICAL)
The entire SEC filing pipeline is untested in interview prep. This is the single most relevant feature for a BNY Mellon role. The candidate should be able to:
- Explain XBRL parsing
- Describe the filing download → parse → extract pipeline
- Discuss rate limiting compliance with SEC requirements
- Explain what financial facts are extracted and why

### B. Valuation Engine (Priority: HIGH)
The 10-model equity valuation engine is only briefly mentioned. The candidate should be able to:
- Walk through DCF step-by-step with real numbers
- Explain when to use DDM vs FCFF vs multiples
- Discuss sensitivity analysis
- Explain how the engine handles edge cases (negative FCF, missing data)

### C. Data Quality & Validation (Priority: HIGH)
The `validators.py` in equity analysis is never mentioned. The candidate should discuss:
- How they validate input data before running valuation models
- How they handle missing or inconsistent financial data
- Data type validation across different API formats

### D. Multi-Model Orchestration (Priority: MEDIUM)
The dual LLM pattern (outer + inner) is mentioned but not deeply explored. Questions needed about:
- How the outer LLM decides when to delegate to a router
- How inner agents are scoped and isolated
- Cost implications of dual-model architecture

### E. Production Hardening (Priority: HIGH)
Q13 in 07_gotcha_edge.md mentions enterprise improvements but lacks depth on:
- Specific compliance requirements for financial data
- Audit logging implementation details
- Data retention policies
- PII handling in conversations

---

## 4. IRRELEVANT OR MISPLACED QUESTIONS

### Potentially Irrelevant:
- **Q4 in 02_tools_data.md (Meme Coin Pipeline):** While technically interesting, a BNY Mellon interviewer will likely view meme coin deployment as frivolous. The candidate should downplay this or reframe it as "blockchain integration experience" rather than leading with it.
- **Q14 in 02_tools_data.md (Token Deployment on pump.fun):** Same concern. This is more relevant to a crypto startup than a custody bank.
- **Q5 in 07_gotcha_edge.md (Malicious Prompt for Meme Coins):** While security is important, focusing on meme coin security at BNY Mellon is a mismatch. Reframe as general prompt injection defense.

### Misplaced (Should Be in Different Category):
- **Q9 in 02_tools_data.md (Equity Valuation Engine):** This belongs in 01_core_architecture.md or a dedicated section on financial analytics. It's a core feature, not just a "tool."
- **Q15-16 in 03_ai_ml.md (Model Distillation):** These are good questions but feel like filler. More depth on the actual LLM Router implementation would be more valuable.

### Redundant:
- **Q25 in 01_core_architecture.md and Q2 in 02_tools_data.md** both cover intent detection. Consolidate.
- **Q4 in 01_core_architecture.md and Q4 in 03_ai_ml.md** both cover the agentic loop. Consolidate.

---

## 5. NEW QUESTIONS TO ADD (15 Total)

### SEC EDGAR & Financial Data (5 questions)

1. **"Walk me through how you fetch and parse SEC 10-K filings. What financial facts do you extract and why?"**
   - Tests: Financial domain knowledge, data parsing, API compliance
   - Code reference: `sec_edgar_tool.py`

2. **"How does the earnings calendar track analyst estimate revisions? Why are revisions more useful than absolute estimates?"**
   - Tests: Financial analytics depth, signal understanding
   - Code reference: `earnings_tool.py`

3. **"Explain the full equity valuation engine — what models does it support, and how does it decide which model to use for a given stock?"**
   - Tests: Financial modeling knowledge, architectural thinking
   - Code reference: `analytics/equity/valuation/`

4. **"How do you handle data normalization when the same financial metric has different formats across Yahoo Finance, AKShare, and SEC EDGAR?"**
   - Tests: Data engineering, schema design
   - Code reference: Multiple tool files

5. **"The SEC requires a specific User-Agent header for API access. How do you handle compliance with SEC rate limits and terms of service?"**
   - Tests: Regulatory awareness, API compliance
   - Code reference: `sec_edgar_tool.py:24`

### Architecture Deep Dive (5 questions)

6. **"How does the LLM Router pattern work — explain the inner agent's lifecycle, tool scope, and error propagation back to the outer agent."**
   - Tests: Deep architectural understanding
   - Code reference: `llm_router.py`

7. **"Walk me through the SkillsLoader — how are skills discovered, validated, and loaded into the agent at runtime?"**
   - Tests: Plugin architecture understanding
   - Code reference: `skills.py`

8. **"How does the heartbeat service coordinate with the agent loop? What happens if a heartbeat fires while a user query is being processed?"**
   - Tests: Concurrency, background task management
   - Code reference: `heartbeat/service.py`

9. **"Explain the SubagentManager — how are background workers tracked, how do results get delivered, and what happens if a subagent crashes?"**
   - Tests: Distributed task management
   - Code reference: `subagent.py`

10. **"How does the analytics/economics module structure its analysis — growth, capital flows, policy, geopolitics — and how do these combine into a coherent macro view?"**
    - Tests: Financial domain modeling, module design
    - Code reference: `analytics/economics/`

### Production & Compliance (5 questions)

11. **"If you were deploying this at BNY Mellon, what specific SEC/FINRA compliance requirements would you need to address?"**
    - Tests: Regulatory knowledge, enterprise mindset
    - Follow-up: Data retention, audit trails, communication surveillance

12. **"How would you design audit logging for every tool call and LLM response in a regulated financial environment?"**
    - Tests: Compliance engineering, logging design
    - Follow-up: What fields to log, retention periods, tamper-proofing

13. **"How do you handle PII in financial conversations — user names, portfolio values, account numbers?"**
    - Tests: Privacy engineering, data governance
    - Follow-up: GDPR, data masking, access controls

14. **"The shell execution tool has a denylist-based security model. Why is this inherently risky and how would you replace it?"**
    - Tests: Security engineering, threat modeling
    - Code reference: `agent/tools/shell.py`

15. **"How would you implement role-based access control so different users can access different financial data and tools?"**
    - Tests: Authorization design, multi-tenancy
    - Follow-up: Premium vs free tiers, data access boundaries

---

## 6. STRUCTURAL RECOMMENDATIONS

### Reorganize Categories:
- **New file: `08_financial_analytics.md`** — Dedicated to SEC EDGAR, earnings, valuation engine, economics modules
- **New file: `09_compliance_production.md`** — Regulatory, audit, PII, enterprise deployment

### Consolidate Duplicates:
- Merge Q25/Q01_core (intent detection) with Q02/Q02_tools (intent detection)
- Merge Q04/Q01_core (agent loop) with Q04/Q03_ai_ml (agentic loop)

### Priority Matrix:

| Priority | Topic | Action |
|----------|-------|--------|
| CRITICAL | SEC EDGAR integration | Add 5 questions immediately |
| CRITICAL | Valuation engine depth | Add 3 questions, expand Q9 in 02_tools |
| HIGH | Compliance/regulatory | Add dedicated section |
| HIGH | Data validation & quality | Add 3 questions |
| HIGH | LLM Router implementation | Add deep-dive questions |
| MEDIUM | Skills system | Add 2 questions |
| MEDIUM | Heartbeat service | Add 1 question |
| LOW | Meme coin pipeline | Reframe or deprioritize |

---

## 7. INTERVIEWER PERSPECTIVE — WHAT THEY'LL ACTUALLY ASK

A BNY Mellon interviewer reviewing this codebase would likely follow this flow:

1. **"Tell me about the project"** → Covered (Q1, Q2 in 01_core)
2. **"How does the agent work?"** → Covered (Q4, Q5 in 01_core)
3. **"I see you have SEC EDGAR integration — walk me through that"** → **NOT COVERED**
4. **"How do you handle financial data validation?"** → **NOT COVERED**
5. **"What valuation models did you build?"** → **BARELY COVERED**
6. **"How would this work in a regulated environment?"** → **NOT COVERED**
7. **"Tell me about a challenging debugging experience"** → Partially covered
8. **"How do you handle errors in the agent loop?"** → Covered (Q16 in 01_core)
9. **"What would you do differently for production?"** → Covered (Q13 in 07_gotcha)
10. **"Do you have questions for us?"** → Covered (Q5 in 05_hr)

**The candidate will be caught off-guard by questions 3, 4, 5, and 6.** These are the highest-risk gaps.

---

*Analysis complete. The candidate has strong architectural coverage but critical gaps in financial domain depth, compliance awareness, and code-level implementation details.*
