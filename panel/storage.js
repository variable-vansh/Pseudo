// panel/storage.js — Session snapshot persistence and restoration.

'use strict';

import { SYSTEM_PROMPT, LANGUAGES, SESSION_KEY } from './constants.js';
import { el } from './dom.js';
import {
  selectedLanguage, selectedModelId, conversationMessages, lastResponse,
  lastTokenMetrics, currentSession,
  setSelectedLanguage, setSelectedModelId, setConversationMessages,
  setLastResponse, setLastTokenMetrics, setCurrentSession,
} from './state.js';
import { MODELS, providerFromId } from './models.js';

// ─── Helpers ────────────────────────────────

export function iterationTotalTokens(iteration) {
  return Number(iteration?.total_tokens) || 0;
}

export function sessionTotalTokens(session) {
  return (session?.iterations || []).reduce((s, i) => s + iterationTotalTokens(i), 0);
}

export const BUDGET_RU_MIN = 10;

export function readBudgetInput() {
  const value = Number(el.budgetInput.value);
  return Number.isFinite(value) && value >= BUDGET_RU_MIN ? value : 0;
}

/** Active session RU budget (ignores legacy token budgets from older versions). */
export function sessionBudgetResourceUnits(session) {
  return Number(session?.budgetResourceUnits) || 0;
}

export function sessionResourceUnits(session) {
  return Number(session?.resourceUnits ?? session?.totals?.resource_units) || 0;
}

export function selectedProvider() {
  if (!selectedModelId) return '';
  return MODELS.find(m => m.id === selectedModelId)?.provider || providerFromId(selectedModelId);
}

// ─── Message normalisation ──────────────────

export function normalizeStoredMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(m => m && typeof m.content === 'string' && ['system', 'user', 'assistant'].includes(m.role))
    .map(m => ({ role: m.role, content: m.content }));
}

export function buildRequestMessages(userMsg) {
  const history = normalizeStoredMessages(conversationMessages)
    .filter(m => m.role === 'user' || m.role === 'assistant');
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMsg },
  ];
}

// ─── Snapshot ───────────────────────────────

export function buildSessionSnapshot() {
  return {
    pseudoInput:  el.pseudoInput.value,
    messages:     conversationMessages,
    lastResponse,
    language:     selectedLanguage,
    provider:     selectedProvider(),
    model:        selectedModelId || '',
    tokenMetrics: lastTokenMetrics || {},
    budgetUsed:   currentSession ? sessionResourceUnits(currentSession) : 0,
    timestamp:    Date.now(),
    currentSession,
  };
}

export async function persistSessionSnapshot() {
  await chrome.storage.local.set({ [SESSION_KEY]: buildSessionSnapshot() });
}

// ─── Restoration ────────────────────────────
// Imported lazily inside restorePseudoSession to avoid circular dependency.

export function restorePseudoSession(snapshot, {
  updateMetricsFromUsage,
  resetMetrics,
  updateSessionBanner,
  restoreSessionSummary,
  syncGenerateState,
}) {
  if (!snapshot || typeof snapshot !== 'object') return false;

  el.pseudoInput.value = typeof snapshot.pseudoInput === 'string' ? snapshot.pseudoInput : '';
  setConversationMessages(normalizeStoredMessages(snapshot.messages));
  setLastResponse(typeof snapshot.lastResponse === 'string' ? snapshot.lastResponse : '');
  setLastTokenMetrics(
    snapshot.tokenMetrics && typeof snapshot.tokenMetrics === 'object'
      ? snapshot.tokenMetrics
      : null
  );

  if (snapshot.language && LANGUAGES.find(l => l.id === snapshot.language)) {
    setSelectedLanguage(snapshot.language);
    const lang = LANGUAGES.find(l => l.id === selectedLanguage);
    if (lang) el.langName.textContent = lang.name;
  }
  if (snapshot.model) {
    setSelectedModelId(snapshot.model);
  }
  if (snapshot.currentSession && typeof snapshot.currentSession === 'object') {
    setCurrentSession(snapshot.currentSession);
    el.sessionIdle.classList.add('hidden');
    if (snapshot.currentSession.locked) {
      // locked: show summary, not active controls
      el.sessionActive.classList.remove('visible');
    } else {
      el.sessionActive.classList.add('visible');
    }
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
    // Restore metrics expansion state
    const expanded = !!lastTokenMetrics.metricsExpanded;
    el.metricsExpanded.classList.toggle('visible', expanded);
    el.metricsToggle.textContent = expanded ? 'Show less' : 'Show more';
  } else {
    resetMetrics();
  }

  syncGenerateState();
  return true;
}
