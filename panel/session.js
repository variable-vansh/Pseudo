// panel/session.js — Session lifecycle: create, update banner, lock, save, and history.

'use strict';

import { el } from './dom.js';
import { currentSession, selectedModelId, setCurrentSession, setConversationMessages, setLastResponse, setLastTokenMetrics } from './state.js';
import { MODELS } from './models.js';
import { getModelParams } from './constants.js';
import { sessionTotalTokens, readBudgetInput, persistSessionSnapshot } from './storage.js';
import { resetMetrics } from './metrics.js';

const MAX_HISTORY = 50;

// ─── Resource Units scoring ──────────────────

/**
 * computeResourceUnits — compute RU for a single API call.
 *
 * Formula: N × (T_in + 3 × T_out_all) / 1e9
 *   N          = estimated parameter count of the model (from MODEL_PARAMS)
 *   T_in       = input tokens for this call
 *   T_out_all  = output_tokens + thinking_tokens (all generated tokens)
 *   /1e9       = converts raw numbers to human-readable Resource Units
 *
 * The 2× from the standard FLOPs formula is intentionally dropped — it is a
 * constant multiplier that cancels in all comparisons and adds no user-facing
 * information. Do not "fix" this.
 */
export function computeResourceUnits(modelId, inputTokens, outputTokens, thinkingTokens) {
  const N       = getModelParams(modelId);
  const T_out   = (outputTokens || 0) + (thinkingTokens || 0);
  return N * ((inputTokens || 0) + 3 * T_out) / 1e9;
}

/**
 * formatResourceUnits — display formatting for a Resource Units value.
 *   ≥ 1000 RU  →  "1,234 Resource Units"   (comma-separated, no decimals)
 *   < 1000 RU  →  "234.5 Resource Units"   (1 decimal place)
 *   < 1 RU     →  "0.3 Resource Units"     (1 decimal place)
 */
export function formatResourceUnits(ru) {
  if (ru >= 1000) return `${Math.round(ru).toLocaleString()} Resource Units`;
  return `${ru.toFixed(1)} Resource Units`;
}

// ─── Session creation ───────────────────────

export function createSession(platform, url, title) {
  if (currentSession) {
    currentSession.platform      = currentSession.platform      || platform;
    currentSession.problem_url   = currentSession.problem_url   || url;
    currentSession.problem_title = currentSession.problem_title || title || '';
    el.sessionIdle.classList.add('hidden');
    el.sessionActive.classList.add('visible');
    updateSessionBanner();
    restoreSessionSummary();
    persistSessionSnapshot();
    return;
  }

  setCurrentSession({
    id:                 crypto.randomUUID(),
    problem_url:        url || '',
    problem_title:      title || '',
    platform:           platform || '',
    started_at:         Date.now(),
    locked_at:          null,
    outcome:            null,
    locked:             false,
    budgetTokens:       0,
    iterations:         [],
    pseudoSnippet:      '',
    estimatedCostUSD:   0,
    // Resource Units accumulator
    resourceUnits:      0,
    totals: {
      input_tokens:     0,
      output_tokens:    0,
      thinking_tokens:  0,
      total_tokens:     0,
      cost_usd:         0,
      iteration_count:  0,
      resource_units:   0,
    },
  });

  el.sessionIdle.classList.add('hidden');
  el.sessionActive.classList.add('visible');
  el.budgetInput.value = '';
  updateSessionBanner();
  persistSessionSnapshot();
}

// ─── Banner ─────────────────────────────────

export function updateSessionBanner() {
  if (!currentSession) return;

  const n           = currentSession.iterations.length;
  const totalTk     = sessionTotalTokens(currentSession);
  const budget      = Number(currentSession.budgetTokens) || 0;
  const canSetBudget = !currentSession.locked && n === 0;
  const hasCalls    = n > 0;

  if (currentSession.locked) {
    el.sessionDot.classList.add('locked');
    el.sessionStatusText.textContent = 'Ended';
    el.lockBtn.style.display = 'none';
  } else {
    el.sessionDot.classList.remove('locked');
    el.sessionStatusText.textContent = 'Active';
    el.lockBtn.style.display = '';
    // Disable End session visually when no calls yet
    if (hasCalls) {
      el.lockBtn.classList.remove('disabled');
    } else {
      el.lockBtn.classList.add('disabled');
    }
  }

  // Teal call count when > 0
  el.sessionCallCount.textContent = n.toLocaleString();
  el.sessionCallCount.classList.toggle('active', hasCalls);

  el.sessionMetricsText.textContent = n === 0 ? '—' : totalTk.toLocaleString();

  // Budget button: only when no iterations yet and no budget set
  const showBudgetBtn = canSetBudget && budget === 0 && el.budgetInput.style.display !== 'block';
  el.budgetBtn.style.display = showBudgetBtn ? '' : 'none';
  if (!canSetBudget || budget > 0) {
    el.budgetInput.style.display = 'none';
  }

  if (budget > 0) {
    const ratio   = totalTk / budget;
    const pct     = Math.max(0, Math.min(ratio, 1)) * 100;
    const overage = Math.max(0, totalTk - budget);
    el.budgetBarFill.style.width      = `${pct}%`;
    el.budgetBarFill.style.background = ratio > 1 ? '#ef4444' : ratio >= 0.8 ? '#f59e0b' : '#2dd4bf';
    el.budgetBarLabel.textContent     = overage > 0
      ? `${totalTk.toLocaleString()} / ${budget.toLocaleString()}  ·  +${overage.toLocaleString()} over`
      : `${totalTk.toLocaleString()} / ${budget.toLocaleString()}`;
    el.budgetBarWrap.classList.add('visible');
  } else {
    el.budgetBarWrap.classList.remove('visible');
    el.budgetBarFill.style.width  = '0';
    el.budgetBarLabel.textContent = '';
  }
}

// ─── End-session guard ───────────────────────

let _endWarningTimer = null;

export function showEndWarning(msg) {
  el.sessionEndWarning.textContent = msg;
  el.sessionEndWarning.classList.add('visible');
  clearTimeout(_endWarningTimer);
  _endWarningTimer = setTimeout(() => {
    el.sessionEndWarning.classList.remove('visible');
    el.sessionEndWarning.textContent = '';
  }, 3000);
}

// ─── Session summary ────────────────────────

export function restoreSessionSummary() {
  if (!currentSession?.locked) {
    el.sessionSummary.classList.remove('visible');
    return;
  }

  const totals = currentSession.totals || {};
  const ru = totals.resource_units ?? currentSession.resourceUnits ?? 0;

  // Score display
  el.ruScore.textContent = formatResourceUnits(ru);

  // Summary stats
  el.summaryIterations.textContent = totals.iteration_count ?? currentSession.iterations?.length ?? 0;
  el.summaryTokens.textContent     = (totals.total_tokens ?? sessionTotalTokens(currentSession)).toLocaleString();

  // Est. cost row
  const cost = currentSession.estimatedCostUSD;
  el.summaryCost.textContent = (cost != null && cost > 0) ? fmt$(cost) : '—';

  // Token breakdown bar
  const T_in    = totals.input_tokens    || 0;
  const T_think = totals.thinking_tokens || 0;
  const T_out   = totals.output_tokens   || 0;
  renderTokenBar(T_in, T_think, T_out);

  el.sessionSummary.classList.add('visible');
}

// ─── Token breakdown bar ─────────────────────

function renderTokenBar(T_in, T_think, T_out) {
  const total = T_in + T_think + T_out;
  if (total === 0) {
    el.ruTokenBar.style.display  = 'none';
    el.ruTokenLegend.style.display = 'none';
    return;
  }

  const inPct    = (T_in    / total * 100).toFixed(2);
  const thinkPct = (T_think / total * 100).toFixed(2);
  const outPct   = (T_out   / total * 100).toFixed(2);

  // Bar segments
  el.ruBarInput.style.width   = `${inPct}%`;
  el.ruBarThink.style.width   = `${thinkPct}%`;
  el.ruBarOutput.style.width  = `${outPct}%`;

  // Hide thinking segment if zero
  el.ruBarThink.style.display = T_think > 0 ? '' : 'none';

  el.ruTokenBar.style.display    = '';
  el.ruTokenLegend.style.display = '';

  // Legend counts
  el.ruLegendInput.textContent  = T_in.toLocaleString();
  el.ruLegendOutput.textContent = T_out.toLocaleString();

  // Thinking legend item: show/hide
  el.ruLegendThinkItem.style.display = T_think > 0 ? '' : 'none';
  el.ruLegendThink.textContent = T_think.toLocaleString();
}

// ─── Budget commit ──────────────────────────

export async function commitBudgetInput() {
  if (!currentSession || currentSession.locked || currentSession.iterations.length > 0) return;
  currentSession.budgetTokens = readBudgetInput();
  el.budgetInput.style.display = 'none';
  updateSessionBanner();
  await saveSession();
  await persistSessionSnapshot();
}

// ─── Lock ───────────────────────────────────

export function lockSession(outcome) {
  if (!currentSession || currentSession.locked) return;

  const n = currentSession.iterations.length;
  if (n === 0) {
    showEndWarning('Make at least one call before ending the session.');
    return;
  }

  currentSession.locked    = true;
  currentSession.locked_at = Date.now();
  currentSession.outcome   = outcome || 'manual';

  const totalIn    = currentSession.iterations.reduce((s, i) => s + (i.input_tokens    || 0), 0);
  const totalOut   = currentSession.iterations.reduce((s, i) => s + (i.output_tokens   || 0), 0);
  const totalThink = currentSession.iterations.reduce((s, i) => s + (i.thinking_tokens || 0), 0);
  const totalTk    = sessionTotalTokens(currentSession);
  const totalC     = currentSession.estimatedCostUSD ?? 0;
  const totalRU    = currentSession.resourceUnits ?? 0;

  currentSession.totals = {
    input_tokens:    totalIn,
    output_tokens:   totalOut,
    thinking_tokens: totalThink,
    total_tokens:    totalTk,
    cost_usd:        totalC,
    iteration_count: n,
    resource_units:  totalRU,
  };

  // Populate summary
  el.ruScore.textContent           = formatResourceUnits(totalRU);
  el.summaryIterations.textContent = n;
  el.summaryTokens.textContent     = totalTk.toLocaleString();
  el.summaryCost.textContent       = totalC > 0 ? fmt$(totalC) : '—';
  renderTokenBar(totalIn, totalThink, totalOut);

  el.sessionActive.classList.remove('visible');
  el.sessionSummary.classList.add('visible');

  updateSessionBanner();
  saveSession();
  saveToHistory();
  persistSessionSnapshot();
}

// ─── Cost formatter (local) ─────────────────

function fmt$(n) {
  if (n === 0) return '$0.0000';
  if (n < 0.0001) return '$' + n.toFixed(6);
  return '$' + n.toFixed(4);
}

// ─── Persistence ────────────────────────────

export async function saveSession() {
  if (!currentSession) return;
  const { sessions = [] } = await chrome.storage.local.get('sessions');
  const idx = sessions.findIndex(s => s.id === currentSession.id);
  if (idx >= 0) sessions[idx] = currentSession;
  else sessions.push(currentSession);
  await chrome.storage.local.set({ sessions });
}

export async function saveToHistory() {
  if (!currentSession) return;
  const n       = currentSession.iterations.length;
  const totalTk = sessionTotalTokens(currentSession);
  const totalC  = currentSession.estimatedCostUSD ?? 0;

  const entry = {
    id:            currentSession.id,
    date:          new Date().toISOString(),
    platform:      currentSession.platform || '',
    model:         MODELS.find(m => m.id === selectedModelId)?.name || selectedModelId || '',
    iterations:    n,
    totalTokens:   totalTk,
    totalCost:     totalC,
    resourceUnits: currentSession.totals?.resource_units ?? currentSession.resourceUnits ?? 0,
    pseudoSnippet: currentSession.pseudoSnippet || '',
  };

  const { sessionHistory = [] } = await chrome.storage.local.get('sessionHistory');
  const idx = sessionHistory.findIndex(e => e.id === entry.id);
  if (idx >= 0) sessionHistory[idx] = entry;
  else sessionHistory.unshift(entry);

  // Cap at 50
  if (sessionHistory.length > MAX_HISTORY) sessionHistory.length = MAX_HISTORY;
  await chrome.storage.local.set({ sessionHistory });
}

// ─── New session ─────────────────────────────

export async function startNewSession() {
  // Clear runtime state
  setCurrentSession(null);
  setConversationMessages([]);
  setLastResponse('');
  setLastTokenMetrics(null);

  // Reset UI
  el.pseudoInput.value = '';
  el.outputCode.textContent = '';
  el.outputArea.classList.remove('visible');
  // Revert to idle state
  el.sessionIdle.classList.remove('hidden');
  el.sessionActive.classList.remove('visible');
  el.sessionSummary.classList.remove('visible');
  el.sessionDot.classList.remove('locked');
  el.sessionStatusText.textContent = 'Active';
  el.lockBtn.classList.add('disabled');
  el.lockBtn.style.display = '';
  el.budgetBtn.style.display = '';
  el.budgetInput.value = '';
  el.budgetInput.style.display = 'none';
  el.budgetBarWrap.classList.remove('visible');
  el.budgetBarFill.style.width = '0';
  el.budgetBarLabel.textContent = '';
  el.sessionCallCount.textContent = '0';
  el.sessionCallCount.classList.remove('active');
  el.sessionMetricsText.textContent = '—';
  el.sessionEndWarning.classList.remove('visible');
  el.sessionEndWarning.textContent = '';

  // Reset metrics display
  resetMetrics();
  el.metricsExpanded.classList.remove('visible');
  el.metricsToggle.textContent = 'Show more';

  // Auto-create a fresh session shell so budget is settable before the first generate.
  // createSession() will hide session-idle and show session-active immediately.
  createSession();

  // Persist cleared state (createSession persists too, but await here for safety)
  await persistSessionSnapshot();
}
