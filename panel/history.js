// panel/history.js — Session history drawer: render, open, close.

'use strict';

import { el } from './dom.js';
import { setHistoryOpen } from './state.js';

// ─── Formatting helpers ─────────────────────

function fmtRU(ru) {
  if (ru == null) return null;
  const n = Number(ru);
  if (!isFinite(n) || n === 0) return null;
  if (n >= 1000) return `${Math.round(n).toLocaleString()} RU`;
  return `${n.toFixed(1)} RU`;
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
         + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch (_) { return iso; }
}

// ─── Renderer ──────────────────────────────

export function renderHistoryDrawer(history) {
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

    const ruFormatted = fmtRU(entry.resourceUnits);
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'history-score';
    scoreSpan.textContent = ruFormatted ?? '—';
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

// ─── Open / close ───────────────────────────

export async function openHistory() {
  const { sessionHistory = [] } = await chrome.storage.local.get('sessionHistory');
  renderHistoryDrawer(sessionHistory);
  el.historyDrawer.classList.add('open');
  setHistoryOpen(true);
}

export function closeHistory() {
  el.historyDrawer.classList.remove('open');
  setHistoryOpen(false);
  // Reset clear button confirm state
  el.clearHistoryBtn.textContent = 'Clear';
  el.clearHistoryBtn.classList.remove('confirming');
}
