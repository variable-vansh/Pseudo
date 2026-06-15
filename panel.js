// Pseudo — Panel Logic
// §1 OpenRouter model list  §2 Token cost simplification  §3 Wide/narrow toggle
// §4 Copy fix  §5 Session history  §6 Info modal  §7 Draggable icon (in content.js)

(() => {
  'use strict';

  // =============================================
  // SYSTEM PROMPT — locked, never modified
  // =============================================

  const SYSTEM_PROMPT = `You are a code transcription engine, not a coding assistant.

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

The user is practicing. Correcting their approach defeats the purpose.`;

  // =============================================
  // §1 — PROVIDER & MODEL CONFIGURATION
  // =============================================

  // Provider prefix → native API endpoint
  const PROVIDER_ENDPOINTS = {
    'google':      'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    'anthropic':   'https://api.anthropic.com/v1/messages',
    'openai':      'https://api.openai.com/v1/chat/completions',
    'x-ai':        'https://api.x.ai/v1/chat/completions',
    'deepseek':    'https://api.deepseek.com/v1/chat/completions',
    'moonshotai':  'https://api.moonshot.cn/v1/chat/completions',
  };

  // Provider prefix → which key to look up in configuredKeys
  const PROVIDER_KEY_NAME = {
    'google':      'google',
    'anthropic':   'anthropic',
    'openai':      'openai',
    'x-ai':        'xai',
    'deepseek':    'deepseek',
    'moonshotai':  'moonshotai',
  };

  // Allowed provider prefixes from OpenRouter — only these pass the safety gate
  const ALLOWED_PREFIXES = [
    'google', 'anthropic', 'openai', 'x-ai', 'deepseek', 'moonshotai',
  ];

  // Friendly display names for provider groups in dropdown
  const PROVIDER_LABELS = {
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
  const SUPPORTED_MODELS = new Set([
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
  const FALLBACK_MODELS = [
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

  // Live model list (populated from OpenRouter cache or fallback)
  let MODELS = [];   // [{ id, name, provider, pricing }]

  // ─────────────────────────────────────────────
  // MODEL_PRICING — source of truth for cost display.
  // Keyed by full OpenRouter model ID.
  // If a model is missing, cost is hidden (not shown as $0).
  // ─────────────────────────────────────────────
  const MODEL_PRICING = {
    'google/gemini-3.5-flash':        { inputPer1M: 1.50,  outputPer1M: 9.00  },
    'google/gemini-3.1-pro-preview':  { inputPer1M: 2.00,  outputPer1M: 12.00 },
    'google/gemini-2.5-flash':        { inputPer1M: 0.30,  outputPer1M: 2.50  },
    'anthropic/claude-opus-4-8':      { inputPer1M: 5.00,  outputPer1M: 25.00 },
    'anthropic/claude-sonnet-4-6':    { inputPer1M: 1.50,  outputPer1M: 7.50  },
    'anthropic/claude-haiku-4-5':     { inputPer1M: 0.25,  outputPer1M: 1.25  },
    'openai/gpt-5.5':                 { inputPer1M: 5.00,  outputPer1M: 30.00 },
    'openai/gpt-5.4-mini':            { inputPer1M: 0.40,  outputPer1M: 1.60  },
    'openai/gpt-4.1-mini':            { inputPer1M: 0.30,  outputPer1M: 1.20  },
    'deepseek/deepseek-v4-pro':       { inputPer1M: 0.435, outputPer1M: 0.87  },
    'deepseek/deepseek-v4-flash':     { inputPer1M: 0.14,  outputPer1M: 0.28  },
    'x-ai/grok-4.3':                  { inputPer1M: 1.25,  outputPer1M: 2.50  },
    'x-ai/grok-build-0.1':           { inputPer1M: 1.00,  outputPer1M: 2.00  },
    'moonshotai/kimi-k2.6':          { inputPer1M: 0.95,  outputPer1M: 4.00  },
  };

  /**
   * extractTokenUsage — parses exact token counts from a raw API response.
   * Never throws. Returns { input, output, thinking, total }.
   * thinking is provider-specific reasoning/thought usage where the API exposes it.
   * If the provider returned no usage data, all fields are 0.
   */
  function extractTokenUsage(providerKey, responseData) {
    try {
      switch (providerKey) {
        case 'google': {
          const m        = responseData?.usageMetadata ?? {};
          const input    = m.promptTokenCount     ?? 0;
          const thinking = m.thoughtsTokenCount   ?? 0;  // Gemini 2.5+ thinking
          const output   = m.candidatesTokenCount ?? 0;
          const total    = m.totalTokenCount      ?? 0;
          return { input, output, thinking, total };
        }
        case 'anthropic': {
          const u = responseData?.usage ?? {};
          const input  = u.input_tokens  ?? 0;
          const output = u.output_tokens ?? 0;
          return { input, output, thinking: 0, total: input + output };
        }
        case 'openrouter': {
          const u      = responseData?.usage ?? {};
          const input  = u.prompt_tokens     ?? 0;
          const output = u.completion_tokens ?? 0;
          const total  = u.total_tokens      ?? (input + output);
          const thinking = u.completion_tokens_details?.reasoning_tokens ?? 0;
          return { input, output, thinking, total };
        }
        default: {
          // OpenAI-compatible: openai, x-ai, deepseek, moonshotai
          const u      = responseData?.usage ?? {};
          const input  = u.prompt_tokens     ?? 0;
          const output = u.completion_tokens ?? 0;
          const thinking = u.completion_tokens_details?.reasoning_tokens ?? 0;
          return { input, output, thinking, total: input + output };
        }
      }
    } catch (_) {
      return { input: 0, output: 0, thinking: 0, total: 0 };
    }
  }

  /**
   * calculateCost — returns exact cost in USD from a usage object + model ID.
   * Returns null if the model has no pricing entry (cost is then hidden).
   * Gemini bills thinking tokens at the output rate.
   */
  function calculateCost(usage, modelId) {
    const pricing = MODEL_PRICING[modelId];
    if (!pricing) return null;
    const billableOutput = usage.output + usage.thinking;
    return (usage.input / 1_000_000)          * pricing.inputPer1M
         + (billableOutput / 1_000_000)        * pricing.outputPer1M;
  }

  function providerFromId(modelId) {
    // e.g. 'google/gemini-2.5-flash' → 'google'
    return modelId.split('/')[0];
  }

  function nativeModelId(modelId) {
    // e.g. 'google/gemini-2.5-flash' → 'gemini-2.5-flash'
    return modelId.split('/').slice(1).join('/');
  }

  // Build the models array from cached OpenRouter data.
  // Applies SUPPORTED_MODELS allowlist first, then provider-prefix check.
  function buildModelsFromCache(orData) {
    const out = [];
    for (const m of orData) {
      if (!SUPPORTED_MODELS.has(m.id)) continue;          // allowlist gate
      const prefix = providerFromId(m.id);
      if (!ALLOWED_PREFIXES.includes(prefix)) continue;   // safety: provider gate
      out.push({
        id:       m.id,
        name:     m.name || m.id,
        provider: prefix,
        pricing: {
          input:  parseFloat(m.pricing?.prompt || 0) * 1_000_000,
          output: parseFloat(m.pricing?.completion || 0) * 1_000_000,
        },
      });
    }
    return out.length > 0 ? out : FALLBACK_MODELS.map(toModelEntry);
  }

  function toModelEntry(m) {
    return {
      id:       m.id,
      name:     m.name,
      provider: providerFromId(m.id),
      pricing:  m.pricing,
    };
  }

  // Fetch/refresh from OpenRouter, respecting 24h TTL
  const CACHE_TTL = 24 * 60 * 60 * 1000;

  async function loadModels() {
    try {
      const stored = await chrome.storage.local.get(['modelsCache', 'modelsCacheFetchedAt']);
      const now = Date.now();
      const stale = !stored.modelsCacheFetchedAt || (now - stored.modelsCacheFetchedAt) > CACHE_TTL;

      if (!stale && stored.modelsCache && stored.modelsCache.length > 0) {
        MODELS = buildModelsFromCache(stored.modelsCache);
        return;
      }

      // Fetch fresh list
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'HTTP-Referer': 'https://pseudo.dev', 'X-Title': 'Pseudo' },
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.data || [];
        await chrome.storage.local.set({ modelsCache: list, modelsCacheFetchedAt: now });
        MODELS = buildModelsFromCache(list);
      } else {
        throw new Error('OpenRouter fetch failed');
      }
    } catch (_) {
      // Fall back to hardcoded list
      MODELS = FALLBACK_MODELS.map(toModelEntry);
    }
  }

  // =============================================
  // LANGUAGES
  // =============================================

  const LANGUAGES = [
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

  // =============================================
  // STATE
  // =============================================

  let selectedModelId    = null;
  let selectedLanguage   = 'cpp';
  let configuredKeys     = {};
  let activeModels       = {};   // { providerKeyName → modelId } — set from keys page
  let isGenerating       = false;
  let metricsExpanded    = false;
  let currentSession     = null;
  let panelMode          = 'narrow';  // 'narrow' | 'wide'
  let historyOpen        = false;
  let infoModalOpen      = false;
  let sessionExpanded    = false;
  let _currentController = null;  // module-level AbortController ref
  let conversationMessages = [];
  let lastResponse      = '';
  let lastTokenMetrics  = null;

  const SESSION_KEY = 'pseudo_session';

  // =============================================
  // DOM REFERENCES
  // =============================================

  const $ = (id) => document.getElementById(id);

  const el = {
    panelMain:          $('panel-main'),
    modelPill:          $('model-pill'),
    modelName:          $('model-name'),
    modelDropdown:      $('model-dropdown'),
    langPill:           $('lang-pill'),
    langName:           $('lang-name'),
    langDropdown:       $('lang-dropdown'),
    pseudoInput:        $('pseudo-input'),
    generateBtn:        $('generate-btn'),
    shortcutLabel:      $('shortcut-label'),
    errorMsg:           $('error-msg'),
    outputArea:         $('output-area'),
    outputCode:         $('output-code'),
    copyBtn:            $('copy-btn'),
    metricsCompact:     $('metrics-compact'),
    metricsToggle:      $('metrics-toggle'),
    metricsInfoBtn:     $('metrics-info-btn'),
    metricsExpanded:    $('metrics-expanded'),
    metricsInputTk:     $('metrics-input-tokens'),
    metricsThinkingRow: $('metrics-thinking-row'),
    metricsThinkingTk:  $('metrics-thinking-tokens'),
    metricsOutputTk:    $('metrics-output-tokens'),
    metricsTotalTk:     $('metrics-total-tokens'),
    metricsTotalCost:   $('metrics-total-cost'),
    sessionBanner:      $('session-banner'),
    sessionDot:         $('session-dot'),
    sessionStatusText:  $('session-status-text'),
    sessionMetricsText: $('session-metrics-text'),
    sessionCallCount:   $('session-call-count'),
    budgetBtn:          $('budget-btn'),
    budgetInput:        $('budget-input'),
    budgetBarWrap:      $('budget-bar-wrap'),
    budgetBarFill:      $('budget-bar-fill'),
    budgetBarLabel:     $('budget-bar-label'),
    lockBtn:            $('lock-btn'),
    sessionSummary:     $('session-summary'),
    efficiencyScore:    $('efficiency-score'),
    summaryIterations:  $('summary-iterations'),
    summaryTokens:      $('summary-tokens'),
    keysBtn:            $('keys-btn'),
    minimizeBtn:        $('minimize-btn'),
    wideBtn:            $('wide-btn'),
    wideIcon:           $('wide-icon'),
    historyBtn:         $('history-btn'),
    historyDrawer:      $('history-drawer'),
    historyList:        $('history-list'),
    historyCloseBtn:    $('history-close-btn'),
    clearHistoryBtn:    $('clear-history-btn'),
    infoModal:          $('info-modal'),
    infoModalClose:     $('info-modal-close'),
    syspromptBtn:       $('sysprompt-btn'),
    syspromptModal:     $('sysprompt-modal'),
    syspromptClose:     $('sysprompt-close'),
    githubBtn:          $('github-btn'),
  };

  // =============================================
  // TOKEN DISPLAY
  // =============================================

  function fmt$(n) {
    if (n === 0) return '$0.0000';
    if (n < 0.0001) return '$' + n.toFixed(6);
    return '$' + n.toFixed(4);
  }

  function fmtTokenNumber(n) {
    return n.toLocaleString();
  }

  function iterationTotalTokens(iteration) {
    return Number(iteration?.total_tokens) || 0;
  }

  function sessionTotalTokens(session) {
    return (session?.iterations || []).reduce((s, i) => s + iterationTotalTokens(i), 0);
  }

  function readBudgetInput() {
    const value = Number(el.budgetInput.value);
    return Number.isFinite(value) && value >= 100 ? Math.floor(value) : 0;
  }

  function selectedProvider() {
    if (!selectedModelId) return '';
    return MODELS.find(m => m.id === selectedModelId)?.provider || providerFromId(selectedModelId);
  }

  function buildSessionSnapshot() {
    return {
      pseudoInput:  el.pseudoInput.value,
      messages:     conversationMessages,
      lastResponse,
      language:     selectedLanguage,
      provider:     selectedProvider(),
      model:        selectedModelId || '',
      tokenMetrics: lastTokenMetrics || {},
      budgetUsed:   currentSession ? sessionTotalTokens(currentSession) : 0,
      timestamp:    Date.now(),
      currentSession,
    };
  }

  async function persistSessionSnapshot() {
    await chrome.storage.local.set({ [SESSION_KEY]: buildSessionSnapshot() });
  }

  function normalizeStoredMessages(messages) {
    if (!Array.isArray(messages)) return [];
    return messages
      .filter(m => m && typeof m.content === 'string' && ['system', 'user', 'assistant'].includes(m.role))
      .map(m => ({ role: m.role, content: m.content }));
  }

  function buildRequestMessages(userMsg) {
    const history = normalizeStoredMessages(conversationMessages)
      .filter(m => m.role === 'user' || m.role === 'assistant');
    return [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: userMsg },
    ];
  }

  function restoreSessionSummary() {
    if (!currentSession?.locked) {
      el.sessionSummary.classList.remove('visible');
      return;
    }

    const totals = currentSession.totals || {};
    el.efficiencyScore.textContent   = totals.efficiency_score ?? 0;
    el.summaryIterations.textContent = totals.iteration_count ?? currentSession.iterations?.length ?? 0;
    el.summaryTokens.textContent     = (totals.total_tokens ?? sessionTotalTokens(currentSession)).toLocaleString();
    el.sessionSummary.classList.add('visible');
  }

  function restorePseudoSession(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return false;

    el.pseudoInput.value = typeof snapshot.pseudoInput === 'string' ? snapshot.pseudoInput : '';
    conversationMessages = normalizeStoredMessages(snapshot.messages);
    lastResponse = typeof snapshot.lastResponse === 'string' ? snapshot.lastResponse : '';
    lastTokenMetrics = snapshot.tokenMetrics && typeof snapshot.tokenMetrics === 'object'
      ? snapshot.tokenMetrics
      : null;

    if (snapshot.language && LANGUAGES.find(l => l.id === snapshot.language)) {
      selectedLanguage = snapshot.language;
      const lang = LANGUAGES.find(l => l.id === selectedLanguage);
      if (lang) el.langName.textContent = lang.name;
    }
    if (snapshot.model) {
      selectedModelId = snapshot.model;
    }
    if (snapshot.currentSession && typeof snapshot.currentSession === 'object') {
      currentSession = snapshot.currentSession;
      el.sessionBanner.classList.add('visible');
      updateSessionBanner();
      restoreSessionSummary();
    }

    if (lastResponse) {
      el.outputCode.textContent = lastResponse;
      el.outputArea.classList.add('visible');
    } else {
      el.outputCode.textContent = '';
      el.outputArea.classList.remove('visible');
    }

    const usage = lastTokenMetrics?.usage;
    if (usage && typeof usage === 'object') {
      updateMetricsFromUsage(usage, lastTokenMetrics.modelId || selectedModelId);
      metricsExpanded = !!lastTokenMetrics.metricsExpanded;
      el.metricsExpanded.classList.toggle('visible', metricsExpanded);
      el.metricsToggle.textContent = metricsExpanded ? 'Show less' : 'Show more';
    } else {
      resetMetrics();
    }

    syncGenerateState();
    return true;
  }

  async function commitBudgetInput() {
    if (!currentSession || currentSession.locked || currentSession.iterations.length > 0) return;
    currentSession.budgetTokens = readBudgetInput();
    el.budgetInput.style.display = 'none';
    updateSessionBanner();
    await saveSession();
    await persistSessionSnapshot();
  }

  // Pre-generation state: show dashes until we have real numbers.
  function resetMetrics() {
    lastTokenMetrics = null;
    el.metricsCompact.textContent              = 'Tokens';
    el.metricsInputTk.textContent              = '—';
    el.metricsOutputTk.textContent             = '—';
    el.metricsTotalTk.textContent              = '—';
    el.metricsTotalCost.textContent            = '';
    el.metricsThinkingTk.textContent           = '—';
    el.metricsThinkingRow.style.display        = 'none';
    const inAnnot = document.getElementById('metrics-input-annotation');
    const outAnnot = document.getElementById('metrics-output-annotation');
    if (inAnnot)  inAnnot.textContent  = '';
    if (outAnnot) outAnnot.textContent = '';
  }

  // Post-generation: populate exact values from API usage.
  function updateMetricsFromUsage(usage, modelId) {
    // If all zeros, the provider returned no usage data — hide the expanded rows
    if (usage.total === 0 && usage.input === 0 && usage.output === 0) {
      el.metricsCompact.textContent   = 'Tokens';
      el.metricsTotalTk.textContent   = '—';
      el.metricsTotalCost.textContent = '';
      return;
    }

    // Input row
    el.metricsInputTk.textContent = fmtTokenNumber(usage.input);

    // Thinking row (Gemini only)
    if (usage.thinking > 0) {
      el.metricsThinkingTk.textContent    = fmtTokenNumber(usage.thinking);
      el.metricsThinkingRow.style.display = '';
    } else {
      el.metricsThinkingRow.style.display = 'none';
    }

    // Output row
    el.metricsOutputTk.textContent = fmtTokenNumber(usage.output);

    // Total row
    el.metricsTotalTk.textContent = fmtTokenNumber(usage.total);

    // Cost display removed — show token count only
    el.metricsTotalCost.textContent = '';
    el.metricsCompact.textContent   = `${usage.total.toLocaleString()} tokens`;
  }

  // updateMetrics is now only called before a generation (resets to pre-flight state)
  function updateMetrics() {
    resetMetrics();
  }

  // =============================================
  // §1 — API DISPATCH
  // =============================================

  // Wraps fetch with an AbortController timeout.
  // Throws a user-friendly error on timeout.
  // Uses the module-level _currentController so callers can abort it externally.
  async function fetchWithTimeout(url, options, timeoutMs = 60000) {
    // Abort any previous in-flight request
    if (_currentController) {
      _currentController.abort();
      _currentController = null;
    }
    const controller = new AbortController();
    _currentController = controller;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } catch (err) {
      if (err.name === 'AbortError')
        throw new Error('Request timed out. The model may be overloaded — try again or switch to a stable model.');
      throw err;
    } finally {
      clearTimeout(timer);
      // Clear the ref only if it still points to this controller
      if (_currentController === controller) _currentController = null;
    }
  }

  // Maps raw error messages to actionable user copy.
  // Pass currentModelId so we don't suggest a model the user is already on.
  function getErrorMessage(err, currentModelId) {
    const msg = err?.message || '';

    // Check timeout FIRST — fetchWithTimeout message contains 'overloaded'
    // so it must be caught before the 503/overloaded branch.
    if (msg.includes('timed out') || err?.name === 'AbortError')
      return 'Request timed out — the model is slow right now. Try again in a moment.';

    if (msg.includes('API_KEY_INVALID') || msg.includes('403'))
      return 'Invalid API key. Check your key in Settings.';
    if (msg.includes('401'))
      return 'Unauthorized — your API key may be expired or incorrect.';
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED'))
      return 'Rate limit hit. Wait a moment and try again.';
    if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
      // Don’t suggest switching if they’re already on the stable model
      const onStable = currentModelId === 'google/gemini-2.5-flash';
      return onStable
        ? 'Gemini is overloaded right now. Wait a moment and try again.'
        : 'Model is overloaded. Try switching to Gemini 2.5 Flash (stable) or try again later.';
    }
    if (msg.includes('blocked') || msg.includes('SAFETY') || msg.includes('RECITATION'))
      return 'Request blocked by model safety filters. Rephrase your pseudocode.';
    if (msg.includes('empty') || msg.includes('Empty'))
      return msg; // already user-friendly from callGoogle
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network'))
      return 'Network error. Check your connection and try again.';
    if (msg.includes('not found') || msg.includes('NOT_FOUND'))
      return `Model not found: ${currentModelId || 'unknown'}. It may not be available yet — try a stable model.`;
    return `Error: ${msg}`;
  }

  function messageSystemPrompt(messages) {
    return messages.find(m => m.role === 'system')?.content || SYSTEM_PROMPT;
  }

  async function callGoogle(apiKey, modelId, messages) {
    const nativeId = nativeModelId(modelId);
    const systemPrompt = messageSystemPrompt(messages);
    const contents = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${nativeId}:generateContent?key=${apiKey}`;

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.2 },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Gemini API error ${res.status}`);
    }

    const data         = await res.json();
    const candidate    = data?.candidates?.[0];
    const finishReason = candidate?.finishReason;

    if (!candidate || finishReason === 'SAFETY' || finishReason === 'RECITATION') {
      throw new Error(`blocked (reason: ${finishReason || 'unknown'})`);
    }

    const text = candidate?.content?.parts?.[0]?.text;
    if (!text || text.trim() === '') {
      throw new Error('Gemini returned an empty response. Try rephrasing your pseudocode.');
    }

    return { text, responseData: data };  // return full data for extractTokenUsage
  }

  async function callOpenAICompat(apiKey, baseUrl, modelId, messages) {
    const nativeId = nativeModelId(modelId);
    const res = await fetchWithTimeout(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: nativeId,
        messages,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error ${res.status}`);
    }

    const data   = await res.json();
    const choice = data?.choices?.[0];
    const text   = choice?.message?.content;
    if (!text || text.trim() === '') {
      const reason = choice?.finish_reason || 'unknown';
      throw new Error(`Model returned an empty response (finish_reason: ${reason}). Try rephrasing.`);
    }

    return { text, responseData: data };  // return full data for extractTokenUsage
  }

  async function callAnthropic(apiKey, modelId, messages) {
    const nativeId = nativeModelId(modelId);
    const systemPrompt = messageSystemPrompt(messages);
    const chatMessages = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: nativeId,
        max_tokens: 4096,
        system: systemPrompt,
        messages: chatMessages,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Anthropic API error ${res.status}`);
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text;
    if (!text || text.trim() === '') {
      const reason = data?.stop_reason || 'unknown';
      throw new Error(`Anthropic returned an empty response (stop_reason: ${reason}). Try rephrasing.`);
    }

    return { text, responseData: data };  // return full data for extractTokenUsage
  }

  async function dispatchAPI(provider, apiKey, modelId, messages) {
    if (provider === 'google') {
      return callGoogle(apiKey, modelId, messages);
    }
    if (provider === 'anthropic') {
      return callAnthropic(apiKey, modelId, messages);
    }
    // All other providers use OpenAI-compatible chat/completions
    const baseUrl = PROVIDER_ENDPOINTS[provider];
    if (!baseUrl) throw new Error(`Unknown provider: ${provider}`);
    return callOpenAICompat(apiKey, baseUrl, modelId, messages);
  }

  // =============================================
  // CODE GENERATION
  // =============================================

  // Soft pre-flight: returns false if the input doesn't look like pseudocode.
  // Cleared after one warning so the user is never hard-blocked.
  function looksLikePseudocode(input) {
    const trimmed = input.trim();
    if (trimmed.length < 10) return false;
    const signals = [
      /\b(if|else|for|while|return|function|def|loop|repeat|set|let|var|input|output|print|check|sort|find|call|push|pop|map|filter|iterate|traverse|initialize|declare)\b/i,
      /[\u2192\->=:]/,   // arrows or assignment-like chars common in pseudocode
      /\n/,              // multiline = likely structured
    ];
    return signals.some(p => p.test(trimmed));
  }

  let _pseudoWarnShown = false; // cleared after one bypass

  async function generateCode() {
    // Reset all in-flight state at the very top of every new invocation
    isGenerating = false;
    if (_currentController) {
      _currentController.abort();
      _currentController = null;
    }
    hideError();

    const pseudocode = el.pseudoInput.value.trim();
    if (!pseudocode || !selectedModelId) return;

    const modelEntry = MODELS.find(m => m.id === selectedModelId);
    if (!modelEntry) return;

    const provider = modelEntry.provider;
    const keyName  = PROVIDER_KEY_NAME[provider] || provider;
    const apiKey   = configuredKeys[keyName];

    if (!apiKey) {
      showError('No API key configured for this model. Click the key icon to add one.');
      return;
    }

    // Soft pseudocode pre-flight — warn once, allow bypass on second click
    if (!looksLikePseudocode(pseudocode) && !_pseudoWarnShown) {
      _pseudoWarnShown = true;
      showError("Input doesn't look like pseudocode. Describe an algorithm or logic flow. Click Generate again to proceed anyway.");
      return;
    }
    _pseudoWarnShown = false;

    const langName = LANGUAGES.find(l => l.id === selectedLanguage)?.name || selectedLanguage;
    const userMsg  = `Language: ${langName}\n\n${pseudocode}`;
    const requestMessages = buildRequestMessages(userMsg);

    isGenerating = true;
    el.generateBtn.disabled = true;
    el.generateBtn.innerHTML = '<span class="spinner"></span> Generating…';
    resetMetrics();

    try {
      const result = await dispatchAPI(provider, apiKey, selectedModelId, requestMessages);

      // Strip markdown fences
      let code = result.text;
      code = code.replace(/^```[\w]*\n?/, '').replace(/\n?```\s*$/, '');

      el.outputCode.textContent = code;
      el.outputArea.classList.add('visible');
      lastResponse = code;
      conversationMessages = [
        ...requestMessages,
        { role: 'assistant', content: code },
      ];

      // Extract exact token usage from the raw API response
      const usage = extractTokenUsage(provider, result.responseData);
      lastTokenMetrics = {
        usage,
        modelId: selectedModelId,
        modelName: modelEntry.name,
        metricsExpanded: true,
      };

      // Update display with exact values
      updateMetricsFromUsage(usage, selectedModelId);

      // Auto-expand the metrics section so token counts are visible.
      // Syncs the state flag and button label so the toggle still works.
      metricsExpanded = true;
      el.metricsExpanded.classList.add('visible');
      el.metricsToggle.textContent = 'Show less';

      // Exact cost from MODEL_PRICING (null if model unknown)
      const cost = calculateCost(usage, selectedModelId) ?? 0;

      if (currentSession && !currentSession.locked) {
        if (currentSession.iterations.length === 0) {
          currentSession.budgetTokens = readBudgetInput();
        }
        currentSession.iterations.push({
          input_tokens:  usage.input,
          output_tokens: usage.output,
          thinking_tokens: usage.thinking,
          total_tokens:  usage.total,
          cost_usd:      cost,
          model:         modelEntry.name,
          timestamp:     Date.now(),
        });
        if (currentSession.iterations.length === 1) {
          currentSession.pseudoSnippet = pseudocode.substring(0, 80);
        }
        updateSessionBanner();
        saveSession();
        saveToHistory();
      }
      await persistSessionSnapshot();

    } catch (err) {
      showError(getErrorMessage(err, selectedModelId));
    } finally {
      isGenerating = false;
      el.generateBtn.disabled = false;
      el.generateBtn.textContent = 'Generate Code';
      syncGenerateState();
    }
  }

  // =============================================
  // UI HELPERS
  // =============================================

  function showError(msg) {
    el.errorMsg.textContent = msg;
    el.errorMsg.style.display = 'block';
  }

  function hideError() {
    el.errorMsg.style.display = 'none';
    el.errorMsg.textContent = '';
  }

  function syncGenerateState() {
    const hasText  = el.pseudoInput.value.trim().length > 0;
    const hasModel = !!selectedModelId;
    el.generateBtn.disabled = !hasText || !hasModel || isGenerating;
  }

  // =============================================
  // DROPDOWNS — grouped by provider
  // =============================================

  function closeAllDropdowns() {
    document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
  }

  function populateModelDropdown() {
    el.modelDropdown.innerHTML = '';

    // For each provider with a key, show only the models the user has checked in Settings.
    // activeModels[keyName] is now an Array of enabled model IDs (or undefined = show all).
    const available = [];
    for (const m of MODELS) {
      const keyName  = PROVIDER_KEY_NAME[m.provider] || m.provider;
      if (!configuredKeys[keyName]) continue;           // no key → skip provider

      const chosen = activeModels[keyName];             // Array<string> | undefined
      if (Array.isArray(chosen)) {
        // User has made a selection — only include if checked
        if (!chosen.includes(m.id)) continue;
      }
      // If nothing stored yet (undefined), include all models for the provider
      available.push(m);
    }

    if (available.length === 0) {
      el.modelName.textContent    = 'No model';
      el.modelPill.dataset.active = 'false';
      selectedModelId             = null;

      const msg = document.createElement('div');
      msg.className = 'dropdown-empty';
      msg.textContent = 'Add an API key to get started';
      el.modelDropdown.appendChild(msg);
      syncGenerateState();
      return;
    }

    // Auto-select: prefer saved selection if still in available set, else prefer google, else first
    if (!selectedModelId || !available.find(m => m.id === selectedModelId)) {
      const gemini = available.find(m => m.provider === 'google');
      selectedModelId = gemini ? gemini.id : available[0].id;
    }

    // Group by provider for display
    const groups = {};
    for (const m of available) {
      if (!groups[m.provider]) groups[m.provider] = [];
      groups[m.provider].push(m);
    }

    for (const [providerKey, models] of Object.entries(groups)) {
      const header = document.createElement('div');
      header.className = 'dropdown-group-header';
      header.textContent = PROVIDER_LABELS[providerKey] || providerKey;
      el.modelDropdown.appendChild(header);

      for (const m of models) {
        const item = document.createElement('div');
        item.className = 'dropdown-item' + (m.id === selectedModelId ? ' selected' : '');
        item.textContent = m.name;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          selectedModelId = m.id;
          el.modelName.textContent    = m.name;
          el.modelPill.dataset.active = 'true';
          closeAllDropdowns();
          populateModelDropdown();
          updateMetrics();
          syncGenerateState();
          chrome.storage.local.set({ selectedModel: m.id });
          persistSessionSnapshot();
        });
        el.modelDropdown.appendChild(item);
      }
    }

    const selModel = available.find(m => m.id === selectedModelId);
    if (selModel) {
      el.modelName.textContent    = selModel.name;
      el.modelPill.dataset.active = 'true';
    }
  }

  function populateLanguageDropdown() {
    el.langDropdown.innerHTML = '';

    for (const lang of LANGUAGES) {
      const item = document.createElement('div');
      item.className = 'dropdown-item' + (lang.id === selectedLanguage ? ' selected' : '');
      item.textContent = lang.name;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedLanguage = lang.id;
        el.langName.textContent = lang.name;
        closeAllDropdowns();
        populateLanguageDropdown();
        chrome.storage.local.set({ selectedLanguage: lang.id });
        persistSessionSnapshot();
      });
      el.langDropdown.appendChild(item);
    }
  }

  // =============================================
  // §4 — WIDE/NARROW TOGGLE
  // =============================================

  const NARROW_W = 400;
  const WIDE_W   = 800;

  function applyPanelMode(mode, animate = true) {
    panelMode = mode;
    const w = mode === 'wide' ? WIDE_W : NARROW_W;
    window.parent.postMessage({ type: 'pseudo-set-width', width: w, animate }, '*');

    // Swap icon: when narrow show expand arrows; when wide show compress arrows
    if (mode === 'wide') {
      el.wideIcon.innerHTML =
        '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>' +
        '<line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>';
    } else {
      el.wideIcon.innerHTML =
        '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>' +
        '<line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>';
    }
  }

  // =============================================
  // §5 — SESSION HISTORY
  // =============================================

  const MAX_HISTORY = 50;

  async function saveToHistory() {
    if (!currentSession) return;
    const n       = currentSession.iterations.length;
    const totalTk = sessionTotalTokens(currentSession);
    const totalC  = currentSession.iterations.reduce((s, i) => s + i.cost_usd, 0);

    const entry = {
      id:              currentSession.id,
      date:            new Date().toISOString(),
      platform:        currentSession.platform || '',
      model:           MODELS.find(m => m.id === selectedModelId)?.name || selectedModelId || '',
      iterations:      n,
      totalTokens:     totalTk,
      totalCost:       totalC,
      efficiencyScore: currentSession.totals?.efficiency_score ?? null,
      pseudoSnippet:   currentSession.pseudoSnippet || '',
    };

    const { sessionHistory = [] } = await chrome.storage.local.get('sessionHistory');
    const idx = sessionHistory.findIndex(e => e.id === entry.id);
    if (idx >= 0) sessionHistory[idx] = entry;
    else sessionHistory.unshift(entry);

    // Cap at 50
    if (sessionHistory.length > MAX_HISTORY) sessionHistory.length = MAX_HISTORY;
    await chrome.storage.local.set({ sessionHistory });
  }

  function scoreClass(score) {
    if (score === null || score === undefined) return '';
    if (score >= 80) return 'score-green';
    if (score >= 50) return 'score-yellow';
    return 'score-red';
  }

  function fmtDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
           + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (_) { return iso; }
  }

  function renderHistoryDrawer(history) {
    el.historyList.innerHTML = '';

    if (!history || history.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.textContent = 'No sessions yet. Generate some code to start tracking.';
      el.historyList.appendChild(empty);
      return;
    }

    for (const entry of history) {
      const row = document.createElement('div');
      row.className = 'history-row';

      // — top row: date + score —
      const topRow = document.createElement('div');
      topRow.className = 'history-row-top';

      const dateSpan = document.createElement('span');
      dateSpan.className = 'history-date';
      dateSpan.textContent = fmtDate(entry.date);
      topRow.appendChild(dateSpan);

      const hasScore = entry.efficiencyScore !== null && entry.efficiencyScore !== undefined;
      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'history-score' + (hasScore ? ' ' + scoreClass(entry.efficiencyScore) : '');
      scoreSpan.textContent = hasScore ? `Score: ${entry.efficiencyScore}` : '—';
      topRow.appendChild(scoreSpan);
      row.appendChild(topRow);

      // — mid row: platform + model —
      const midRow = document.createElement('div');
      midRow.className = 'history-row-mid';
      if (entry.platform) {
        const platSpan = document.createElement('span');
        platSpan.className = 'history-platform';
        platSpan.textContent = entry.platform;
        midRow.appendChild(platSpan);
      }
      const modelSpan = document.createElement('span');
      modelSpan.className = 'history-model';
      modelSpan.textContent = entry.model || '—';
      midRow.appendChild(modelSpan);
      row.appendChild(midRow);

      // — stats row —
      const statsRow = document.createElement('div');
      statsRow.className = 'history-row-stats';
      const iterSpan = document.createElement('span');
      iterSpan.textContent = `${entry.iterations} iter`;
      const tkSpan = document.createElement('span');
      tkSpan.textContent = `${Number(entry.totalTokens || 0).toLocaleString()} tk`;
      statsRow.appendChild(iterSpan);
      statsRow.appendChild(tkSpan);
      row.appendChild(statsRow);

      // — snippet —
      if (entry.pseudoSnippet) {
        const snippet = document.createElement('div');
        snippet.className = 'history-snippet';
        snippet.textContent = entry.pseudoSnippet;  // textContent = safe, no XSS
        row.appendChild(snippet);
      }

      el.historyList.appendChild(row);
    }
  }

  async function openHistory() {
    const { sessionHistory = [] } = await chrome.storage.local.get('sessionHistory');
    renderHistoryDrawer(sessionHistory);
    el.historyDrawer.classList.add('open');
    historyOpen = true;
  }

  function closeHistory() {
    el.historyDrawer.classList.remove('open');
    historyOpen = false;
    // Reset clear button confirm state
    el.clearHistoryBtn.textContent = 'Clear';
    el.clearHistoryBtn.classList.remove('confirming');
  }

  // =============================================
  // SESSION TRACKING
  // =============================================

  function createSession(platform, url, title) {
    if (currentSession) {
      currentSession.platform = currentSession.platform || platform;
      currentSession.problem_url = currentSession.problem_url || url;
      currentSession.problem_title = currentSession.problem_title || title || 'Unknown Problem';
      el.sessionBanner.classList.add('visible');
      updateSessionBanner();
      restoreSessionSummary();
      persistSessionSnapshot();
      return;
    }

    currentSession = {
      id:            crypto.randomUUID(),
      problem_url:   url,
      problem_title: title || 'Unknown Problem',
      platform:      platform,
      started_at:    Date.now(),
      locked_at:     null,
      outcome:       null,
      locked:        false,
      budgetTokens:  0,
      iterations:    [],
      pseudoSnippet: '',
      totals: {
        input_tokens:     0,
        output_tokens:    0,
        total_tokens:     0,
        cost_usd:         0,
        iteration_count:  0,
        efficiency_score: 0,
      },
    };

    el.sessionBanner.classList.add('visible');
    el.budgetInput.value = '';
    updateSessionBanner();
    persistSessionSnapshot();
  }

  function updateSessionBanner() {
    if (!currentSession) return;

    const n        = currentSession.iterations.length;
    const totalTk  = sessionTotalTokens(currentSession);
    const budget   = Number(currentSession.budgetTokens) || 0;
    const canSetBudget = !currentSession.locked && n === 0;

    if (currentSession.locked) {
      el.sessionDot.classList.add('locked');
      el.sessionStatusText.textContent = 'Locked';
      el.lockBtn.style.display = 'none';
    } else {
      el.sessionDot.classList.remove('locked');
      el.sessionStatusText.textContent = 'Active';
      el.lockBtn.style.display = '';
    }

    el.sessionCallCount.textContent = n.toLocaleString();
    el.sessionMetricsText.textContent = n === 0 ? '—' : totalTk.toLocaleString();

    // Budget button: only when no iterations yet and no budget set
    const showBudgetBtn = canSetBudget && budget === 0 && el.budgetInput.style.display !== 'block';
    el.budgetBtn.style.display = showBudgetBtn ? '' : 'none';
    if (!canSetBudget || budget > 0) {
      el.budgetInput.style.display = 'none';
    }

    if (budget > 0) {
      const ratio = totalTk / budget;
      const pct = Math.max(0, Math.min(ratio, 1)) * 100;
      const overage = Math.max(0, totalTk - budget);
      el.budgetBarFill.style.width = `${pct}%`;
      el.budgetBarFill.style.background = ratio > 1 ? '#ef4444' : ratio >= 0.8 ? '#f59e0b' : '#2dd4bf';
      el.budgetBarLabel.textContent = overage > 0
        ? `${totalTk.toLocaleString()} / ${budget.toLocaleString()}  ·  +${overage.toLocaleString()} over`
        : `${totalTk.toLocaleString()} / ${budget.toLocaleString()}`;
      el.budgetBarWrap.classList.add('visible');
    } else {
      el.budgetBarWrap.classList.remove('visible');
      el.budgetBarFill.style.width = '0';
      el.budgetBarLabel.textContent = '';
    }
  }

  function lockSession(outcome) {
    if (!currentSession || currentSession.locked) return;

    currentSession.locked    = true;
    currentSession.locked_at = Date.now();
    currentSession.outcome   = outcome || 'manual';

    const n        = currentSession.iterations.length;
    const totalIn  = currentSession.iterations.reduce((s, i) => s + i.input_tokens, 0);
    const totalOut = currentSession.iterations.reduce((s, i) => s + i.output_tokens, 0);
    const totalTk  = sessionTotalTokens(currentSession);
    const totalC   = currentSession.iterations.reduce((s, i) => s + i.cost_usd, 0);

    let score = 100;
    score -= Math.max(0, n - 1) * 15;
    const avgIn = n > 0 ? totalIn / n : 0;
    score -= Math.max(0, avgIn - 120) * 0.05;
    if (n === 1) score += 20;
    score = Math.max(0, Math.min(100, Math.round(score)));

    currentSession.totals = {
      input_tokens:     totalIn,
      output_tokens:    totalOut,
      total_tokens:     totalTk,
      cost_usd:         totalC,
      iteration_count:  n,
      efficiency_score: score,
    };

    el.efficiencyScore.textContent   = score;
    el.summaryIterations.textContent = n;
    el.summaryTokens.textContent     = totalTk.toLocaleString();
    el.sessionSummary.classList.add('visible');

    updateSessionBanner();
    saveSession();
    saveToHistory();
    persistSessionSnapshot();
  }

  async function saveSession() {
    if (!currentSession) return;
    const { sessions = [] } = await chrome.storage.local.get('sessions');
    const idx = sessions.findIndex(s => s.id === currentSession.id);
    if (idx >= 0) sessions[idx] = currentSession;
    else sessions.push(currentSession);
    await chrome.storage.local.set({ sessions });
  }

  function isMacPlatform() {
    const platform = navigator.userAgentData?.platform || navigator.platform || '';
    return /mac|iphone|ipad|ipod/i.test(platform);
  }

  function shortcutMod() {
    return isMacPlatform() ? '⌘' : 'Ctrl';
  }

  function isShortcut(e, key, shiftKey = false) {
    const wantsMod = isMacPlatform()
      ? e.metaKey && !e.ctrlKey
      : e.ctrlKey && !e.metaKey;
    return wantsMod && e.shiftKey === shiftKey && e.key.toLowerCase() === key.toLowerCase();
  }

  function updateShortcutLabel() {
    const mod = shortcutMod();
    const label = el.shortcutLabel;
    if (label) label.textContent = `${mod}+Return`;
  }

  // Textarea → debounced metrics
  let _metricsTimer = null;
  el.pseudoInput.addEventListener('input', () => {
    clearTimeout(_metricsTimer);
    _metricsTimer = setTimeout(() => {
      updateMetrics();
      syncGenerateState();
      persistSessionSnapshot();
    }, 300);
  });

  el.generateBtn.addEventListener('click', generateCode, { once: false });

  document.addEventListener('keydown', (e) => {
    if (isShortcut(e, 'Enter')) {
      e.preventDefault();
      if (!el.generateBtn.disabled) el.generateBtn.click();
    }
  });

  // §4 — Copy fix: read textContent fresh at click time
  el.copyBtn.addEventListener('click', () => {
    const code = document.getElementById('output-code').textContent;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      el.copyBtn.textContent = 'Copied!';
      setTimeout(() => { el.copyBtn.textContent = 'Copy'; }, 1500);
    }).catch(() => {
      // Fallback for edge cases
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      el.copyBtn.textContent = 'Copied!';
      setTimeout(() => { el.copyBtn.textContent = 'Copy'; }, 1500);
    });
  });

  // Metrics toggle
  el.metricsToggle.addEventListener('click', () => {
    metricsExpanded = !metricsExpanded;
    el.metricsExpanded.classList.toggle('visible', metricsExpanded);
    el.metricsToggle.textContent = metricsExpanded ? 'Show less' : 'Show more';
    if (lastTokenMetrics) lastTokenMetrics.metricsExpanded = metricsExpanded;
    persistSessionSnapshot();
  });

  // §6 — Info modal (metrics info panel, now in-flow)
  el.metricsInfoBtn.addEventListener('click', () => {
    infoModalOpen = !infoModalOpen;
    el.infoModal.classList.toggle('open', infoModalOpen);
  });
  el.infoModalClose.addEventListener('click', () => {
    infoModalOpen = false;
    el.infoModal.classList.remove('open');
  });

  // Footer — System Prompt viewer
  el.syspromptBtn.addEventListener('click', () => {
    el.syspromptModal.classList.add('open');
  });
  el.syspromptClose.addEventListener('click', () => {
    el.syspromptModal.classList.remove('open');
  });

  // Footer — GitHub link
  el.githubBtn.addEventListener('click', () => {
    window.open('https://github.com/variable-vansh/Pseudo', '_blank');
  });

  // Model pill
  el.modelPill.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = el.modelDropdown.classList.contains('open');
    closeAllDropdowns();
    if (!open) el.modelDropdown.classList.add('open');
  });

  // Language pill
  el.langPill.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = el.langDropdown.classList.contains('open');
    closeAllDropdowns();
    if (!open) el.langDropdown.classList.add('open');
  });

  document.addEventListener('click', closeAllDropdowns);

  // Keys button
  el.keysBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'open-keys' });
  });

  // Minimize
  el.minimizeBtn.addEventListener('click', () => {
    window.parent.postMessage({ type: 'pseudo-minimize' }, '*');
  });

  // §4 — Wide/narrow toggle
  el.wideBtn.addEventListener('click', () => {
    const newMode = panelMode === 'narrow' ? 'wide' : 'narrow';
    applyPanelMode(newMode);
    chrome.storage.local.set({ panelMode: newMode });
  });

  // §5 — History drawer
  el.historyBtn.addEventListener('click', () => {
    if (historyOpen) closeHistory();
    else openHistory();
  });
  el.historyCloseBtn.addEventListener('click', closeHistory);

  // Clear history (with confirm step)
  let _clearConfirmTimer = null;
  el.clearHistoryBtn.addEventListener('click', async () => {
    if (el.clearHistoryBtn.classList.contains('confirming')) {
      clearTimeout(_clearConfirmTimer);
      await chrome.storage.local.set({ sessionHistory: [] });
      renderHistoryDrawer([]);
      el.clearHistoryBtn.textContent = 'Clear';
      el.clearHistoryBtn.classList.remove('confirming');
    } else {
      el.clearHistoryBtn.textContent = 'Sure?';
      el.clearHistoryBtn.classList.add('confirming');
      _clearConfirmTimer = setTimeout(() => {
        el.clearHistoryBtn.textContent = 'Clear';
        el.clearHistoryBtn.classList.remove('confirming');
      }, 3000);
    }
  });

  // Lock session
  el.lockBtn.addEventListener('click', () => { lockSession('manual'); });
  el.budgetBtn.addEventListener('click', () => {
    el.budgetBtn.style.display = 'none';
    el.budgetInput.style.display = 'block';
    el.budgetInput.focus();
  });
  el.budgetInput.addEventListener('blur', () => { commitBudgetInput(); });
  el.budgetInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      el.budgetInput.blur();
    }
  });

  // Messages from content script
  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'pseudo-set-width') {
      // Content script echoes back width changes (handled natively, but guard here too)
    } else if (msg.type === 'pseudo-panel-mode') {
      panelMode = msg.mode || 'narrow';
    }
  });

  // =============================================
  // INIT
  // =============================================

  async function init() {
    try {
      const stored = await chrome.storage.local.get([
        'keys', 'activeModels', 'selectedModel', 'selectedLanguage', 'panelMode', SESSION_KEY,
      ]);

      configuredKeys = stored.keys || {};
      activeModels   = stored.activeModels || {};
      const sessionSnapshot = stored[SESSION_KEY];
      const hasRestoredSession = !!(
        sessionSnapshot?.pseudoInput ||
        sessionSnapshot?.lastResponse ||
        sessionSnapshot?.messages?.length
      );

      if (Object.keys(configuredKeys).length === 0 && !hasRestoredSession) {
        el.panelMain.classList.add('empty');
      } else {
        el.panelMain.classList.remove('empty');
      }

      if (sessionSnapshot?.language && LANGUAGES.find(l => l.id === sessionSnapshot.language)) {
        selectedLanguage = sessionSnapshot.language;
      } else if (stored.selectedLanguage) {
        selectedLanguage = stored.selectedLanguage;
      }
      const lang = LANGUAGES.find(l => l.id === selectedLanguage);
      if (lang) el.langName.textContent = lang.name;

      if (stored.panelMode) {
        panelMode = stored.panelMode;
        // Tell content script to resize immediately (no animation on load)
        applyPanelMode(panelMode, false);
      }

      // §1 — Load models (from cache or OpenRouter), then populate dropdown
      await loadModels();

      if (sessionSnapshot?.model && MODELS.find(m => m.id === sessionSnapshot.model)) {
        selectedModelId = sessionSnapshot.model;
      } else if (stored.selectedModel && MODELS.find(m => m.id === stored.selectedModel)) {
        selectedModelId = stored.selectedModel;
      }

      populateModelDropdown();
      populateLanguageDropdown();

      const restored = restorePseudoSession(sessionSnapshot);
      populateModelDropdown();
      populateLanguageDropdown();
      if (!restored) {
        updateMetrics();
        syncGenerateState();
      }
      updateShortcutLabel();

      // Populate read-only system prompt viewer
      const syspromptBody = document.getElementById('sysprompt-body');
      if (syspromptBody) syspromptBody.textContent = SYSTEM_PROMPT;

      // React to key and active-model changes from settings page
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        let needsDropdownRefresh = false;
        if (changes.keys) {
          configuredKeys = changes.keys.newValue || {};
          if (Object.keys(configuredKeys).length === 0 && !el.pseudoInput.value && !lastResponse) {
            el.panelMain.classList.add('empty');
          } else {
            el.panelMain.classList.remove('empty');
          }
          needsDropdownRefresh = true;
        }
        if (changes.activeModels) {
          activeModels = changes.activeModels.newValue || {};
          needsDropdownRefresh = true;
        }
        if (needsDropdownRefresh) {
          populateModelDropdown();
          updateMetrics();
          syncGenerateState();
          persistSessionSnapshot();
        }
      });
    } finally {
      document.body.classList.remove('hydrating');
    }
  }

  init();

})();
