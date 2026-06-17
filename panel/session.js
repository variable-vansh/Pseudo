// panel/session.js — Session lifecycle: create, update banner, lock, save, and history.

'use strict';

import { el } from './dom.js';
import { currentSession, selectedModelId, setCurrentSession } from './state.js';
import { MODELS } from './models.js';
import { sessionTotalTokens, readBudgetInput, persistSessionSnapshot } from './storage.js';

const MAX_HISTORY = 50;

// ─── Session creation ───────────────────────

export function createSession(platform, url, title) {
  if (currentSession) {
    currentSession.platform      = currentSession.platform      || platform;
    currentSession.problem_url   = currentSession.problem_url   || url;
    currentSession.problem_title = currentSession.problem_title || title || 'Unknown Problem';
    el.sessionBanner.classList.add('visible');
    updateSessionBanner();
    restoreSessionSummary();
    persistSessionSnapshot();
    return;
  }

  setCurrentSession({
    id:            crypto.randomUUID(),
    problem_url:   url,
    problem_title: title || 'Unknown Problem',
    platform,
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
  });

  el.sessionBanner.classList.add('visible');
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

  if (currentSession.locked) {
    el.sessionDot.classList.add('locked');
    el.sessionStatusText.textContent = 'Locked';
    el.lockBtn.style.display = 'none';
  } else {
    el.sessionDot.classList.remove('locked');
    el.sessionStatusText.textContent = 'Active';
    el.lockBtn.style.display = '';
  }

  el.sessionCallCount.textContent   = n.toLocaleString();
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

// ─── Session summary ────────────────────────

export function restoreSessionSummary() {
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
