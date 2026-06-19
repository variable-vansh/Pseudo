// panel/events.js — All addEventListener() calls wired in one place.

'use strict';

import { el } from './dom.js';
import * as State from './state.js';
import {
  setInfoModalOpen, setPanelMode, setMetricsExpanded, setLastTokenMetrics,
} from './state.js';
import { updateMetrics } from './metrics.js';
import { applyPanelMode } from './panel-mode.js';
import { isShortcut } from './shortcuts.js';
import { generateCode } from './generate.js';
import { openHistory, closeHistory, renderHistoryDrawer } from './history.js';
import { closeAllDropdowns, syncGenerateState } from './dropdowns.js';
import { lockSession, commitBudgetInput, applyBudgetPreset, startNewSession } from './session.js';
import { persistSessionSnapshot } from './storage.js';

function mountBudgetHelpTooltips() {
  const tpl = document.getElementById('budget-help-template');
  if (!tpl) return;
  document.querySelectorAll('[data-budget-help]').forEach((slot) => {
    slot.appendChild(tpl.content.cloneNode(true));
  });
}

export function bindEvents() {
  mountBudgetHelpTooltips();

  // ─── Textarea — debounced pre-flight ───────
  let _metricsTimer = null;
  el.pseudoInput.addEventListener('input', () => {
    clearTimeout(_metricsTimer);
    _metricsTimer = setTimeout(() => {
      updateMetrics();
      syncGenerateState();
      persistSessionSnapshot();
    }, 300);
  });

  // ─── Generate button ────────────────────────
  el.generateBtn.addEventListener('click', generateCode);

  // ─── Keyboard shortcut (⌘/Ctrl + Enter) ────
  document.addEventListener('keydown', (e) => {
    if (isShortcut(e, 'Enter')) {
      e.preventDefault();
      if (!el.generateBtn.disabled) el.generateBtn.click();
    }
  });

  // ─── Copy button ────────────────────────────
  // §4 — Read textContent fresh at click time
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

  // ─── Metrics toggle ─────────────────────────
  el.metricsToggle.addEventListener('click', () => {
    const next = !State.metricsExpanded;
    setMetricsExpanded(next);
    el.metricsExpanded.classList.toggle('visible', next);
    el.metricsToggle.textContent = next ? 'Show less' : 'Show more';
    if (State.lastTokenMetrics) {
      State.lastTokenMetrics.metricsExpanded = next;
      setLastTokenMetrics(State.lastTokenMetrics);
    }
    persistSessionSnapshot();
  });

  // ─── Info modal (metrics info panel) ────────
  el.metricsInfoBtn.addEventListener('click', () => {
    const next = !State.infoModalOpen;
    setInfoModalOpen(next);
    el.infoModal.classList.toggle('open', next);
  });
  el.infoModalClose.addEventListener('click', () => {
    setInfoModalOpen(false);
    el.infoModal.classList.remove('open');
  });

  // ─── System prompt viewer ────────────────────
  el.syspromptBtn.addEventListener('click', () => {
    el.syspromptModal.classList.add('open');
  });
  el.syspromptClose.addEventListener('click', () => {
    el.syspromptModal.classList.remove('open');
  });

  // ─── GitHub link ─────────────────────────────
  el.githubBtn.addEventListener('click', () => {
    window.open('https://github.com/variable-vansh/Pseudo', '_blank');
  });

  // ─── Model pill ──────────────────────────────
  el.modelPill.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = el.modelDropdown.classList.contains('open');
    closeAllDropdowns();
    if (!open) el.modelDropdown.classList.add('open');
  });

  // ─── Language pill ───────────────────────────
  el.langPill.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = el.langDropdown.classList.contains('open');
    closeAllDropdowns();
    if (!open) el.langDropdown.classList.add('open');
  });

  document.addEventListener('click', closeAllDropdowns);

  // ─── Keys button ─────────────────────────────
  el.keysBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'open-keys' });
  });

  // ─── Minimize ────────────────────────────────
  el.minimizeBtn.addEventListener('click', () => {
    window.parent.postMessage({ type: 'pseudo-minimize' }, '*');
  });

  // ─── Wide/narrow toggle ──────────────────────
  el.wideBtn.addEventListener('click', () => {
    const newMode = State.panelMode === 'narrow' ? 'wide' : 'narrow';
    applyPanelMode(newMode);
    chrome.storage.local.set({ panelMode: newMode });
  });

  // ─── History drawer ──────────────────────────
  el.historyBtn.addEventListener('click', () => {
    if (State.historyOpen) closeHistory();
    else openHistory();
  });
  el.historyCloseBtn.addEventListener('click', closeHistory);

  // ─── Clear history (with confirm step) ───────
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

  // ─── Session controls ────────────────────────
  // (No "Start session" button — sessions auto-start on first generate)

  el.lockBtn.addEventListener('click', () => { lockSession('manual'); });

  el.newSessionBtn.addEventListener('click', () => { startNewSession(); });

  // ─── Resume dialog ───────────────────────────
  el.resumeContinueBtn.addEventListener('click', () => {
    el.resumeDialog.classList.remove('visible');
  });
  el.resumeFreshBtn.addEventListener('click', async () => {
    el.resumeDialog.classList.remove('visible');
    await startNewSession();
  });

  el.budgetBtn.addEventListener('click', () => {
    el.budgetControl.classList.add('is-editing');
    el.budgetInput.focus();
  });
  el.budgetInput.addEventListener('blur', () => { commitBudgetInput(); });
  el.budgetInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      el.budgetInput.blur();
    }
  });

  // Preset chips live inside the tooltip — keep focus so blur doesn't fire first
  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('.budget-preset-btn')) e.preventDefault();
  });
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.budget-preset-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const ru = Number(btn.dataset.budget);
    if (!Number.isFinite(ru)) return;
    await applyBudgetPreset(ru);
  });

  // ─── Messages from content script ────────────
  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'pseudo-set-width') {
      // Content script echoes back width changes (handled natively, but guard here too)
    } else if (msg.type === 'pseudo-panel-mode') {
      setPanelMode(msg.mode || 'narrow');
    }
  });
}
