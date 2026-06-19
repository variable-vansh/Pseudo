// panel/generate.js — Code generation: pre-flight check, API dispatch, and UI update.

'use strict';

import { LANGUAGES, PROVIDER_KEY_NAME } from './constants.js';
import { el } from './dom.js';
import {
  selectedModelId, selectedLanguage, configuredKeys, isGenerating,
  currentSession, lastTokenMetrics,
  setIsGenerating, setLastResponse, setConversationMessages,
  setLastTokenMetrics, setMetricsExpanded, setCurrentController, _currentController,
} from './state.js';
import { MODELS } from './models.js';
import { dispatchAPI, getErrorMessage } from './api.js';
import { extractTokenUsage, calculateCost } from './pricing.js';
import { updateMetricsFromUsage, resetMetrics } from './metrics.js';
import { buildRequestMessages, persistSessionSnapshot, readBudgetInput } from './storage.js';
import { updateSessionBanner, saveSession, saveToHistory, createSession, computeResourceUnits } from './session.js';
import { syncGenerateState } from './dropdowns.js';

// ─── UI helpers (local) ─────────────────────

function showError(msg) {
  el.errorMsg.textContent = msg;
  el.errorMsg.style.display = 'block';
}

function hideError() {
  el.errorMsg.style.display = 'none';
  el.errorMsg.textContent = '';
}

// ─── Pseudocode guard ───────────────────────
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

// ─── Main generation function ───────────────

export async function generateCode() {
  // Reset all in-flight state at the very top of every new invocation
  setIsGenerating(false);
  if (_currentController) {
    _currentController.abort();
    setCurrentController(null);
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

  const langName        = LANGUAGES.find(l => l.id === selectedLanguage)?.name || selectedLanguage;
  const userMsg         = `Language: ${langName}\n\n${pseudocode}`;
  const requestMessages = buildRequestMessages(userMsg);

  setIsGenerating(true);
  el.generateBtn.disabled = true;
  el.generateBtnText.textContent = 'Generating…';
  el.generateSpinner.classList.add('active');
  resetMetrics();

  try {
    const result = await dispatchAPI(provider, apiKey, selectedModelId, requestMessages);

    // Strip markdown fences
    let code = result.text;
    code = code.replace(/^```[\w]*\n?/, '').replace(/\n?```\s*$/, '');

    // Strip leading Interpretation: line if present (per system prompt spec)
    const lines = code.split('\n');
    const strippedCode = lines[0]?.trimStart().startsWith('Interpretation:')
      ? lines.slice(1).join('\n').trimStart()
      : code;

    el.outputCode.textContent = strippedCode;
    el.outputArea.classList.add('visible');
    setLastResponse(strippedCode);
    setConversationMessages([
      ...requestMessages,
      { role: 'assistant', content: strippedCode },
    ]);

    // Extract exact token usage from the raw API response
    const usage = extractTokenUsage(provider, result.responseData);
    setLastTokenMetrics({
      usage,
      modelId:         selectedModelId,
      modelName:       modelEntry.name,
      metricsExpanded: true,
    });

    // Update display with exact values
    updateMetricsFromUsage(usage, selectedModelId);

    // Auto-expand the metrics section so token counts are visible.
    // Syncs the state flag and button label so the toggle still works.
    setMetricsExpanded(true);
    el.metricsExpanded.classList.add('visible');
    el.metricsToggle.textContent = 'Show less';

    // Exact cost from MODEL_PRICING (null if model unknown)
    const cost = calculateCost(usage, selectedModelId) ?? 0;

    // Auto-start a session on the first token sent — zero friction.
    if (!currentSession) {
      createSession();
    }

    if (currentSession && !currentSession.locked) {
      if (currentSession.iterations.length === 0) {
        currentSession.budgetResourceUnits = readBudgetInput();
      }
      currentSession.iterations.push({
        input_tokens:    usage.input,
        output_tokens:   usage.output,
        thinking_tokens: usage.thinking,
        total_tokens:    usage.total,
        cost_usd:        cost,
        model:           modelEntry.name,
        model_id:        selectedModelId,
        timestamp:       Date.now(),
      });
      if (currentSession.iterations.length === 1) {
        currentSession.pseudoSnippet = pseudocode.substring(0, 80);
      }
      // Compute and accumulate Resource Units for this call
      const ru = computeResourceUnits(selectedModelId, usage.input, usage.output, usage.thinking);
      currentSession.resourceUnits = (currentSession.resourceUnits || 0) + ru;
      currentSession.estimatedCostUSD = (currentSession.estimatedCostUSD || 0) + (cost ?? 0);
      updateSessionBanner();
      saveSession();
      saveToHistory();
    }
    await persistSessionSnapshot();

  } catch (err) {
    showError(getErrorMessage(err, selectedModelId));
  } finally {
    setIsGenerating(false);
    el.generateBtn.disabled = false;
    el.generateBtnText.textContent = 'Generate Code';
    el.generateSpinner.classList.remove('active');
    syncGenerateState();
  }
}
