# Pseudo — Fresh Start Prompt
*Give this file to any LLM or coding agent to get it up to speed from zero.*

---

## What is Pseudo

A Chrome extension. You write pseudocode. It generates the exact code you described via an LLM. It shows you how many tokens that cost.

That's it.

The insight behind it: token efficiency is a real engineering skill that nobody is teaching or measuring yet. How clearly and concisely can you express an approach so an AI does useful work cheaply? Pseudo makes that visible.

---

## The problem it solves

The modern coding workflow is:
1. Think through the problem
2. Write pseudocode
3. Have an LLM turn that into code
4. Verify it matches your approach

Nobody is measuring how well someone does step 2–3. Pseudo does.

---

## Hard constraints the LLM must follow

The LLM inside Pseudo is a transcription engine — not a coding assistant. It implements exactly what the user described. Bugs, suboptimal choices, wrong data structures — all of it gets implemented as-is. Correcting the user defeats the point.

**System prompt (locked, never changes):**

```
You are a code transcription engine, not a coding assistant.

Your ONLY job is to translate the user's pseudocode into working code, exactly as described.

Rules:
- Implement the approach the user described. Do not improve it.
- If the approach has a bug, implement it anyway. Do not fix it.
- If the approach is suboptimal, implement it anyway. Do not optimize it.
- Do not add comments explaining a better way.
- Do not suggest alternatives.
- Return only the code. No explanation, no preamble, no "note that...".
- Do not add trailing notes, suggestions, or improvement hints after the code.
- If a step is genuinely ambiguous, pick the most straightforward interpretation, implement it, and state your interpretation in one line before the code. Do not ask clarifying questions.

The user is practicing. Correcting their approach defeats the purpose.
```

---

## How model access works

Zero running costs to the developer — always.

- **Default (Gemini):** User signs in with Google (OAuth) or pastes a Gemini API key from AI Studio. Free tier covers casual use.
- **Other models:** User pastes their own API key — Anthropic, OpenAI, DeepSeek. Stored in `chrome.storage.local` only. Never touches any server.
- **Model selector in the panel** only shows models the user has actually configured. No key = not shown.
- All API calls go: browser extension → LLM API directly. No proxy, no backend.

---

## Token metrics

What gets shown:

**Compact (default):** `~120 tokens · $0.0006`

**Expanded ([Show more]):**
```
Input    ~120 tk        $0.000036   ← you control this
Output   360–600 tk     $0.0005–0.0009   ← model decides this
──────────────────────────────────
Total    ~480–720 tk    ~$0.0005–0.0009
```

Showing input vs output separately is intentional. Output is where the money goes. Tighter pseudocode = shorter output = lower cost. That's the lesson.

V1 uses `tiktoken` WASM (cl100k_base) locally for estimation — no server needed. Falls back to word-count (~1.3 tokens/word) if WASM fails. These are estimates; exact counts come in V2 from real API responses.

Cost always in USD.

---

## Session tracking

A session = one problem-solving attempt.

**Starts:** When the panel opens on a supported coding platform.

**Tracks:** Every Generate Code call — input tokens, output tokens, cost, model used.

**Locks:** Automatically, when an accepted verdict is detected in the DOM. Also lockable manually via a button (fallback for platforms where DOM detection is unreliable).

**On lock:** Shows a session summary — total tokens, total cost, iteration count, efficiency score.

**Efficiency score (0–100):**
```
base = 100
− 15 per iteration after the first
− 0.05 per token over 120 average input
+ 20 if solved first attempt
clamped to [0, 100]
```

Score is meaningless in isolation. It becomes useful when comparing attempts across problems or candidates.

**Session stored as:**
```json
{
  "id": "uuid",
  "problem_url": "...",
  "problem_title": "Two Sum",
  "platform": "leetcode",
  "started_at": 1718000000000,
  "locked_at": 1718000400000,
  "outcome": "accepted",
  "iterations": [
    { "input_tokens": 140, "output_tokens": 380, "cost_usd": 0.00089, "model": "gemini-flash" }
  ],
  "totals": {
    "input_tokens": 140,
    "output_tokens": 380,
    "cost_usd": 0.00089,
    "iteration_count": 1,
    "efficiency_score": 100
  }
}
```

Stored in `chrome.storage.local`. No backend, no account needed.

---

## Supported platforms (auto-inject)

Panel injects automatically on:
- `leetcode.com/problems/*`
- `codeforces.com/problemset/problem/*`
- `codeforces.com/contest/*/problem/*`
- `hackerrank.com/challenges/*`
- `atcoder.jp/contests/*/tasks/*`
- `codechef.com/problems/*`

Also available on any other tab via the toolbar icon.

---

## Design language

Reference: Meridian app. The aesthetic is minimal, dark, physical-feeling. Not flat, not loud.

**Core rules:**
- Dark-first. Background `#111111`. Panel surface `#1c1c1c`. Input fields `#161616`.
- Elevation through border opacity only. Zero `box-shadow` anywhere.
- One accent color: `#2dd4bf` (teal). Used only on active model pill, generate button, interactive text. Nowhere else.
- Generate button: ghost style — `rgba(45,212,191,0.12)` background, `rgba(45,212,191,0.35)` border, teal text. Not a loud filled block.
- Typography: Inter for UI, Geist Mono for the pseudocode textarea.
- Pills (model selector, language selector): `border-radius: 20px`. Containers: `border-radius: 10px`. Nothing else.
- Spacing is generous but nothing is wasted.

**Panel layout:**
```
┌──────────────────────────────────┐
│  pseudo            [keys]  [−]   │  ← header
├──────────────────────────────────┤
│  [● Gemini Flash ▾]  [C++ ▾]     │  ← model + language pills
│                                  │
│  ┌──────────────────────────┐    │
│  │ pseudocode...            │    │  ← Geist Mono textarea
│  └──────────────────────────┘    │
│                                  │
│  [      Generate Code         ]  │  ← ghost accent button
│                                  │
├──────────────────────────────────┤
│  ~0 tokens · $0.00  [Show more]  │  ← compact metrics
│  (expanded breakdown)            │
├──────────────────────────────────┤
│  ● Session active · 2 calls      │  ← session banner
│  420 tokens · $0.0012  [Lock →]  │    (coding platforms only)
└──────────────────────────────────┘
```

Default language: **C++**.

---

## Keys / settings page

Opened from the [keys] button in the header.

**Google / Gemini section (top):**
- "Sign in with Google" button — OAuth, scoped to `generative-language` — one click, no API key needed, good for non-technical users
- "or paste Gemini API key" — for those who prefer it

**API keys section:**
- Lists all saved keys as read-only rows: model name | masked key | × delete button
- One editable row at the bottom: model name input + key input + [Save]
- Saving adds a new read-only row above and makes that model available in the panel immediately

**Trust copy (always visible):** *"Stored locally in your browser. Never sent anywhere."*

---

## Business model

**Now:** Free for everyone. Practitioners (students, job seekers, competitive programmers) use it at zero cost, forever. No paywalls, no limits, no account required.

**Later:** When companies start using this in hiring — structured interview sessions, candidate scoring, efficiency benchmarks — that's where monetization gets explored. Companies pay; candidates never do.

The sequencing is: get real users first, figure out how to charge companies later. Distribution before revenue.

---

## Open source posture

Pseudo is built to be open sourced.

- No proprietary backend, no secret sauce in the server — there is no server
- The core value is the concept and UX, not locked-up code
- Being open source builds trust (especially for a tool that handles API keys)
- Contributions from the community can extend platform support, add models, improve DOM selectors

---

## Tech stack

- Chrome Extension, Manifest V3
- Vanilla JS (no framework — keep it simple, keep it auditable)
- `tiktoken` WASM from CDN for local token estimation
- `chrome.storage.local` for all persistence
- `chrome.identity` for Google OAuth
- Direct fetch to LLM APIs — no proxy, no backend
- No build step if avoidable — ship plain files

---

## What's not built yet

- History view (list of past sessions with scores)
- V3 interview platform (shareable session links, live interviewer view)
- Platform-specific DOM selector hardening (needs real-device testing per platform)
- Exact monetization structure for the hiring use case

---

## Staging

```
V1 → estimate tokens, generate code, track sessions, show efficiency score
V2 → exact token counts from real API responses, session history view
V3 → interview platform, shareable sessions, company-facing tooling
```
