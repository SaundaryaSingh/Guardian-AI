# Audit Report: Fix Completeness Verification

**Date:** 2026-08-10
**Scope:** All 7 files in `interview_prep/questions/`
**Auditor:** Independent verification pass

---

## Files Audited

| # | File | Lines | Status |
|---|------|-------|--------|
| 01 | `01_core_architecture.md` | 456 | PASS (minor issue) |
| 02 | `02_tools_data.md` | 276 | PASS |
| 03 | `03_ai_ml.md` | 336 | PASS |
| 04 | `04_bonus_technical.md` | 545 | PASS (minor issue) |
| 05 | `05_hr_behavioral.md` | 374 | FAIL — meme coin content |
| 06 | `06_system_design.md` | 404 | PASS |
| 07 | `07_gotcha_edge.md` | 241 | FAIL — meme coin content |

---

## Fix-by-Fix Verification

### Fix 1: Meme coin content removed/reframed for BNY safety

**Result: FAIL**

Meme coin references remain in two files:

**05_hr_behavioral.md — 3 problems:**
- Q6 (line 149): *"I rushed to integrate the meme coin launch feature without proper testing"*
- Q7 (line 173): Ethics dilemma centers on meme coin launch: *"When building the meme coin launch feature, I discovered that social media scanning for viral ideas could potentially be used to manipulate markets or promote scams."*
- Q11 (line 282): *"I was working on the meme coin scanning feature while also trying to fix a bug"*
- Quick Reference table (line 305): Lists "Meme Coin Safeguards" as a core story

**07_gotcha_edge.md — 2 problems:**
- Q5 (line 79): *"Someone sends a malicious prompt trying to get the agent to deploy a meme coin without permission"*
- Q13 (line 201): *"What about the meme coin feature?" -> "Remove it entirely for a bank."*

**Risk:** BNY Mellon is a custodian bank managing trillions. Discussing meme coin deployment in an interview — especially in behavioral/ethics questions — is a red flag. An interviewer hearing "meme coin launch feature" will question judgment.

**Recommended fix for 05_hr_behavioral.md:**
- Q6: Reframe as *"I rushed to integrate the web search feature without proper testing"* or *"I rushed to add the shell command execution feature without proper testing"* — something that still demonstrates the lesson (shortcuts cost time) without the meme coin association.
- Q7: Reframe the ethical dilemma around data privacy (social media scanning for market signals could violate user privacy) or around financial advice (the agent could be mistaken for giving investment advice). Both are bank-relevant ethical concerns.
- Q11: Replace "meme coin scanning feature" with "social signal processing pipeline" or "web search feature."
- Quick Reference table: Rename "Meme Coin Safeguards" to "Ethical Safeguards" or "Financial Safety Gates."

**Recommended fix for 07_gotcha_edge.md:**
- Q5: Reframe as prompt injection targeting financial data access or unauthorized tool use.
- Q13: Change the answer to say *"The social media scanning pipeline would need additional privacy controls for a bank environment"* — not about removing meme coins.

---

### Fix 2: Jargon terms defined inline on first use

**Result: PASS**

All 7 files include:
- A glossary table at the top of the file
- Inline parenthetical definitions on first use of key terms throughout answers

Examples verified:
- 01: `LLM (Large Language Model — the AI like ChatGPT)`, `message bus (a system that passes messages between parts of your app — like a post office between departments)`
- 02: `cache (like keeping frequently used tools on your desk)`, `TTL (time-to-live — how long data stays fresh)`
- 03: `context window (like a whiteboard that can only fit so much)`
- 04: `Docker (like a shipping container for software)`, `WebSocket (a two-way communication channel — like a phone call)`
- 05: `custodian bank (a bank that holds and safeguards financial assets for other institutions)`
- 06: `load balancer (like a traffic cop distributing requests across servers)`, `circuit breaker (like a fuse in your house)`
- 07: `Concurrency (multiple things happening at the same time)`, `race condition (like two people clicking "buy" at the same time)`

No instances found of jargon used without inline definition or glossary coverage.

---

### Fix 3: Analogies added (message bus, agent loop, cache, etc.)

**Result: PASS**

| Analogy | Files Present | Status |
|---------|--------------|--------|
| Message bus = post office between departments | 01, 02, 03, 06, 07 | ✓ |
| Agent loop = detective investigating a case | 01, 03, 07 | ✓ |
| Cache = keeping frequently used tools on your desk | 01, 02, 04, 05, 06 | ✓ |
| Context window = whiteboard that can only fit so much | 01, 03 | ✓ |
| Rate limiting = bouncer at a club | 02, 04, 06 | ✓ |
| WebSocket = phone call (vs HTTP = sending a letter) | 04, 06, 07 | ✓ |
| Docker = shipping container for software | 04, 06 | ✓ |
| JWT = digital ID card | 06 | ✓ |
| Load balancer = traffic cop | 06 | ✓ |
| Circuit breaker = fuse in your house | 06, 07 | ✓ |
| Gateway = universal power adapter | 03 | ✓ |
| Middleware = filter that processes data before the main system | 01, 06 | ✓ |
| Tool registry = menu of options | 01 | ✓ |
| Cron = calendar alarm | 01, 04 | ✓ |
| Debounce = brief pause to collect rapid inputs | 01 | ✓ |
| Token bucket = bouncer at a club | 06 | ✓ |
| Failover = backup generator | 07 | ✓ |
| Race condition = two people clicking "buy" | 07 | ✓ |
| Distillation = student learning from a master | 03 | ✓ |

Analogies are consistent across files and cover all major concepts.

---

### Fix 4: Finance 101 glossary added

**Result: PASS**

Present in `02_tools_data.md` (lines 28-38) with 6 terms:

| Term | Definition Quality |
|------|-------------------|
| P/E Ratio | Plain English + numerical example |
| DCF | Plain English + practical example |
| WACC | Plain English + threshold example |
| Beta | Plain English + concrete examples |
| Free Cash Flow | Plain English + example |
| Terminal Value | Plain English + usage context |

All definitions include a "Plain English" column and an "Example" column — excellent for interview prep. Cross-referenced from the glossary with "see Finance 101 below" notes on WACC, DCF, and Beta.

Appropriately placed in the tools/data file where financial terms are most relevant. Not needed in AI/ML, HR, or system design files.

---

### Fix 5: "How LLMs Work" primer added

**Result: PASS**

Present in `03_ai_ml.md` (lines 8-23) as "How LLMs Work — A 60-Second Primer" covering:

1. Training — how the model learns from text
2. Prediction — next-word-prediction core mechanism
3. Context Window — limits with concrete token counts
4. Temperature — deterministic vs creative with practical use cases
5. Function Calling — how agents call tools with structured output
6. Hallucination — what it is and why grounding matters

All 6 concepts are explained in plain language with concrete numbers (128K tokens, 4K tokens). This primer is referenced throughout the AI/ML questions.

---

### Fix 6: Answers shortened to ~45 seconds

**Result: PASS**

Estimated word counts and timing (at ~150 words/minute speaking pace):

| File | Typical Answer Length | Est. Time |
|------|----------------------|-----------|
| 01_core_architecture | 60-120 words | 25-50s ✓ |
| 02_tools_data | 80-130 words | 30-52s ✓ |
| 03_ai_ml | 80-130 words | 30-52s ✓ |
| 04_bonus_technical | 50-100 words | 20-40s ✓ |
| 05_hr_behavioral | 80-130 words (STAR) | 30-52s ✓ |
| 06_system_design | 120-150 words (labeled) | 48-60s ✓ |
| 07_gotcha_edge | 100-150 words | 40-60s ✓ |

06_system_design.md explicitly labels answers with timing (e.g., "(50s)", "(55s)"). All other files keep answers concise. No answers exceed 60 seconds.

---

### Fix 7: Follow-up probes present on all questions

**Result: PASS**

| File | Questions | All Have Probes? |
|------|-----------|-----------------|
| 01_core_architecture | 30 | Yes ✓ |
| 02_tools_data | 16 | Yes ✓ |
| 03_ai_ml | 20 | Yes ✓ |
| 04_bonus_technical | ~25 | Yes ✓ |
| 05_hr_behavioral | 11 | Yes ✓ |
| 06_system_design | 12 + 5 bonus | Yes ✓ |
| 07_gotcha_edge | 15 | Yes ✓ |

Every question has 2-4 follow-up probes. Probes escalate from surface-level to deeper technical follow-ons.

---

### Fix 8: Reference tables present

**Result: PASS with one gap**

| File | Reference/Summary Table | Status |
|------|------------------------|--------|
| 01_core_architecture | Summary table (Q grouping by topic) | ✓ |
| 02_tools_data | Quick Reference: Key Concepts table | ✓ |
| 03_ai_ml | Quick Reference: Key Terms table | ✓ |
| 04_bonus_technical | **None** | ⚠️ Missing |
| 05_hr_behavioral | Story Bank, Key Themes, BNY Values tables | ✓ |
| 06_system_design | STAR-S Framework table | ✓ |
| 07_gotcha_edge | Key Patterns to Remember table | ✓ |

**Gap:** `04_bonus_technical.md` has 12 question sections across Docker, WebSocket, CORS, channels, WhatsApp, cron, testing, performance, async patterns, error handling, testing async, and CI/CD — but no summary/reference table at the end. A "Quick Reference: Key Concepts" table mapping each topic to where it appears and why it matters would improve consistency with the other 6 files.

---

### Fix 9: HR supplementary sections present

**Result: PASS**

`05_hr_behavioral.md` includes:
- **Interview Day Checklist** (lines 329-336): Pre-interview prep items with checkboxes
- **Questions to Ask the Interviewer** (lines 339-343): 5 questions to ask
- **Red Flags to Avoid** (lines 345-350): 5 things to avoid
- **Resources** (lines 354-368): Books, practice tips, BNY Mellon research links
- **Quick Reference: Story Bank** (lines 297-306): Stories mapped to which questions they answer
- **Key Themes to Emphasize** (lines 309-315): 5 themes
- **BNY Mellon Values to Reference** (lines 318-325): Values mapped to demonstration evidence

Supplementary material is comprehensive and well-structured.

---

## Remaining Issues

### Critical (Must Fix Before PDF)

1. **Meme coin references in 05_hr_behavioral.md** — 3 questions + 1 table cell reference meme coin launch/launching. These must be reframed for BNY Mellon context.

2. **Meme coin references in 07_gotcha_edge.md** — 2 questions reference meme coin deployment. Must be reframed.

### Minor (Should Fix)

3. **04_bonus_technical.md missing reference table** — All other files have a summary/reference table. Adding one would improve consistency and serve as a quick-study cheat sheet.

### No Issues Found

- Inline definitions: ✓ All jargon defined
- Analogies: ✓ Consistent and comprehensive
- Finance 101: ✓ Well-placed in 02
- How LLMs Work primer: ✓ Complete in 03
- Answer length: ✓ All ~45-60 seconds
- Follow-up probes: ✓ Present on all questions
- HR supplementary: ✓ Complete

---

## Overall Quality Rating: 8/10

**Strengths:**
- Glossary tables are consistent across all 7 files
- Analogies are consistent (post office, detective, whiteboard, bouncer, etc.) and reinforce memory
- Finance 101 section in 02 is excellent — plain English + examples
- LLM primer in 03 covers exactly what an interviewer would ask about
- Follow-up probes are well-calibrated (escalating difficulty)
- HR section has a complete interview prep toolkit (checklist, stories, red flags)
- Answer lengths are consistently within 45-60 second range

**Deductions:**
- -1 for meme coin references in HR and gotcha sections (content risk for BNY context)
- -1 for missing reference table in 04_bonus_technical.md

---

## Verdict: NOT READY FOR FINAL PDF

**Blocked by:** Fix 1 (meme coin references) — this is a content safety issue for a BNY Mellon interview guide.

**After fixing meme coin references + adding 04 reference table → READY**

The remaining work is surgical: 5 specific edits across 2 files (reframe 3 Qs in 05, reframe 2 Qs in 07, rename 1 table entry in 05) plus adding one summary table to 04. Estimated 15 minutes of work.
