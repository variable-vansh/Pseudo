// panel/constants.js — Static configuration; never mutated at runtime.

'use strict';

// =============================================
// SYSTEM PROMPT — locked, never modified
// =============================================

export const SYSTEM_PROMPT = `You are a code transcription engine, not a coding assistant.

Your ONLY job is to translate the user's pseudocode into working code, exactly as described.

Rules:
- Implement the approach the user described. Do not improve it.
- If the approach has a bug, implement it anyway. Do not fix it.
- If the approach is suboptimal, implement it anyway. Do not optimize it.
- Do not add comments explaining a better way.
- Do not suggest alternatives.
- Return only the code. No explanation, no preamble, no "note that...".
- Do not add trailing notes, suggestions, or improvement hints after the code.
- If a step is genuinely ambiguous, pick the most straightforward interpretation and implement it.
  State your interpretation in exactly one line before the code block, prefixed with "Interpretation:".
  Do not ask clarifying questions.

The user is practicing. Correcting their approach defeats the purpose.`;

// ─── Resource Units: model parameter lookup ────────────────────────────────
// Used by computeResourceUnits() in session.js.
// Key ordering: longer/more-specific keys must precede shorter ones (e.g.
// "gpt-4o-mini" before "gpt-4o" before "gpt-4") to avoid false prefix matches.
// Matched case-insensitively via modelId.toLowerCase().includes(key).
// Active params used for MoE models (DeepSeek) — not total declared params.
// All counts are estimates from public reporting; purpose is proportional
// comparison, not exact FLOPs. Do not expose these values in the UI.
export const MODEL_PARAMS = {
  // OpenAI
  'gpt-4o-mini':        8e9,
  'gpt-4o':           200e9,
  'gpt-4-turbo':      200e9,
  'gpt-4':            200e9,
  'gpt-3.5-turbo':     20e9,
  'o3-mini':           20e9,
  'o1-mini':           20e9,
  'o1':               200e9,
  'o3':               200e9,
  // Anthropic
  'claude-3-5-haiku':  20e9,
  'claude-3-haiku':    20e9,
  'claude-haiku':      20e9,
  'claude-3-5-sonnet': 70e9,
  'claude-3-sonnet':   70e9,
  'claude-sonnet':     70e9,
  'claude-3-opus':    175e9,
  'claude-opus':      175e9,
  // Google
  'gemini-2.5-flash':  24e9,
  'gemini-2.0-flash':  24e9,
  'gemini-1.5-flash':  24e9,
  'gemini-2.5-pro':   175e9,
  'gemini-1.5-pro':   175e9,
  'gemini-1.0-pro':    70e9,
  'gemini-pro':        70e9,
  // xAI
  'grok-2':           314e9,
  'grok-beta':        314e9,
  'grok':             314e9,
  // DeepSeek — active params for MoE, not total declared
  'deepseek-r1':       37e9,
  'deepseek-v3':       37e9,
  'deepseek-chat':     37e9,
  'deepseek-reasoner': 37e9,
  // Moonshot
  'moonshot-v1-128k':  70e9,
  'moonshot-v1-32k':   70e9,
  'moonshot-v1-8k':     7e9,
};

export const DEFAULT_PARAMS = 70e9;

export function getModelParams(modelId) {
  if (!modelId) return DEFAULT_PARAMS;
  const id = modelId.toLowerCase();
  for (const [key, params] of Object.entries(MODEL_PARAMS)) {
    if (id.includes(key)) return params;
  }
  return DEFAULT_PARAMS;
}

// =============================================
// §1 — PROVIDER & MODEL CONFIGURATION
// =============================================

// Provider prefix → native API endpoint
export const PROVIDER_ENDPOINTS = {
  'google':      'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
  'anthropic':   'https://api.anthropic.com/v1/messages',
  'openai':      'https://api.openai.com/v1/chat/completions',
  'x-ai':        'https://api.x.ai/v1/chat/completions',
  'deepseek':    'https://api.deepseek.com/v1/chat/completions',
  'moonshotai':  'https://api.moonshot.cn/v1/chat/completions',
};

// Provider prefix → which key to look up in configuredKeys
export const PROVIDER_KEY_NAME = {
  'google':      'google',
  'anthropic':   'anthropic',
  'openai':      'openai',
  'x-ai':        'xai',
  'deepseek':    'deepseek',
  'moonshotai':  'moonshotai',
};

// Allowed provider prefixes from OpenRouter — only these pass the safety gate
export const ALLOWED_PREFIXES = [
  'google', 'anthropic', 'openai', 'x-ai', 'deepseek', 'moonshotai',
];

// Friendly display names for provider groups in dropdown
export const PROVIDER_LABELS = {
  'google':      'Google / Gemini',
  'anthropic':   'Anthropic',
  'openai':      'OpenAI',
  'x-ai':        'xAI / Grok',
  'deepseek':    'DeepSeek',
  'moonshotai':  'Moonshot / Kimi',
};

// ─────────────────────────────────────────────
// SUPPORTED_MODELS — curated allowlist (mid-2026).
// Update this list consciously when new models ship
// — don't pull from OpenRouter unfiltered.
// Latest first, stable fallbacks at the bottom of each
// provider section. After fetching, only IDs in this
// set are kept; everything else is silently dropped.
// ─────────────────────────────────────────────
export const SUPPORTED_MODELS = new Set([
  // Google — Gemini
  'google/gemini-3.5-flash',        // Best speed/cost for most pseudocode tasks
  'google/gemini-3.1-pro-preview',  // Highest Google coding quality (SWE-bench ~80.6%)
  'google/gemini-2.5-flash',        // ★ Stable fallback — proven, widely available
  // Anthropic — Claude
  'anthropic/claude-opus-4-8',      // Best overall coding model (SWE-bench ~88.6%)
  'anthropic/claude-sonnet-4-6',    // Balanced speed + quality
  'anthropic/claude-haiku-4-5',     // Fastest / cheapest Claude option
  // OpenAI
  'openai/gpt-5.5',                 // Frontier quality (~$5/$30 per 1M)
  'openai/gpt-5.4-mini',            // Cost-efficient GPT option
  'openai/gpt-4.1-mini',            // ★ Stable fallback — reliable, low cost
  // DeepSeek — best cost-adjusted coding performance
  'deepseek/deepseek-v4-pro',       // ~$0.14/$0.28 — high LiveCodeBench scores
  'deepseek/deepseek-v4-flash',     // Even cheaper, slightly lower quality
  // xAI — Grok
  'x-ai/grok-4.3',                  // Flagship, 1M context ($1.25/$2.50)
  'x-ai/grok-build-0.1',            // Coding-specialized, 256K context ($1/$2)
  // Moonshot AI — Kimi
  'moonshotai/kimi-k2.6',           // Strong long-horizon agentic coding (~$0.95/$4)
]);

// Fallback static models (used when OpenRouter fetch fails).
// Should mirror the SUPPORTED_MODELS set.
export const FALLBACK_MODELS = [
  { id: 'google/gemini-3.5-flash',          name: 'Gemini 3.5 Flash',       pricing: { input: 0.15,  output: 0.60  } },
  { id: 'google/gemini-3.1-pro-preview',    name: 'Gemini 3.1 Pro',         pricing: { input: 1.25,  output: 10.00 } },
  { id: 'google/gemini-2.5-flash',          name: 'Gemini 2.5 Flash',       pricing: { input: 0.15,  output: 0.60  } },
  { id: 'anthropic/claude-opus-4-8',        name: 'Claude Opus 4.8',        pricing: { input: 15.00, output: 75.00 } },
  { id: 'anthropic/claude-sonnet-4-6',      name: 'Claude Sonnet 4.6',      pricing: { input: 3.00,  output: 15.00 } },
  { id: 'anthropic/claude-haiku-4-5',       name: 'Claude Haiku 4.5',       pricing: { input: 0.80,  output: 4.00  } },
  { id: 'openai/gpt-5.5',                   name: 'GPT-5.5',                pricing: { input: 5.00,  output: 30.00 } },
  { id: 'openai/gpt-5.4-mini',              name: 'GPT-5.4 Mini',           pricing: { input: 0.40,  output: 1.60  } },
  { id: 'openai/gpt-4.1-mini',              name: 'GPT-4.1 Mini',           pricing: { input: 0.10,  output: 0.40  } },
  { id: 'deepseek/deepseek-v4-pro',         name: 'DeepSeek V4 Pro',        pricing: { input: 0.14,  output: 0.28  } },
  { id: 'deepseek/deepseek-v4-flash',       name: 'DeepSeek V4 Flash',      pricing: { input: 0.07,  output: 0.14  } },
  { id: 'x-ai/grok-4.3',                   name: 'Grok 4.3',               pricing: { input: 1.25,  output: 2.50  } },
  { id: 'x-ai/grok-build-0.1',             name: 'Grok Build 0.1',         pricing: { input: 1.00,  output: 2.00  } },
  { id: 'moonshotai/kimi-k2.6',            name: 'Kimi K2.6',              pricing: { input: 0.95,  output: 4.00  } },
];

// =============================================
// LANGUAGES
// =============================================

export const LANGUAGES = [
  { id: 'cpp',        name: 'C++' },
  { id: 'python',     name: 'Python' },
  { id: 'java',       name: 'Java' },
  { id: 'javascript', name: 'JavaScript' },
  { id: 'typescript', name: 'TypeScript' },
  { id: 'go',         name: 'Go' },
  { id: 'rust',       name: 'Rust' },
  { id: 'c',          name: 'C' },
  { id: 'kotlin',     name: 'Kotlin' },
  { id: 'swift',      name: 'Swift' },
];

// Storage key for session persistence
export const SESSION_KEY = 'pseudo_session';
