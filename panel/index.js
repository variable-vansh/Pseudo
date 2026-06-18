// panel/index.js — Entry point. Imports all modules and runs init().

'use strict';

import { LANGUAGES, SESSION_KEY, SYSTEM_PROMPT } from './constants.js';
import { el } from './dom.js';
import {
  selectedLanguage, selectedModelId, configuredKeys, activeModels,
  lastResponse, lastTokenMetrics, currentSession,
  setConfiguredKeys, setActiveModels, setSelectedLanguage, setSelectedModelId, setPanelMode,
} from './state.js';
import { MODELS, loadModels } from './models.js';
import { updateMetrics, resetMetrics, updateMetricsFromUsage } from './metrics.js';
import { applyPanelMode } from './panel-mode.js';
import { updateShortcutLabel } from './shortcuts.js';
import {
  populateModelDropdown, populateLanguageDropdown, syncGenerateState,
} from './dropdowns.js';
import { restorePseudoSession, persistSessionSnapshot } from './storage.js';
import { updateSessionBanner, restoreSessionSummary, createSession } from './session.js';
import { bindEvents } from './events.js';

const INACTIVITY_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

function formatAge(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''}`;
  const hrs = Math.round(ms / 3600000);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''}`;
  const days = Math.round(ms / 86400000);
  return `${days} day${days !== 1 ? 's' : ''}`;
}

async function init() {
  try {
    const stored = await chrome.storage.local.get([
      'keys', 'activeModels', 'selectedModel', 'selectedLanguage', 'panelMode', SESSION_KEY,
    ]);

    setConfiguredKeys(stored.keys || {});
    setActiveModels(stored.activeModels || {});
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
      setSelectedLanguage(sessionSnapshot.language);
    } else if (stored.selectedLanguage) {
      setSelectedLanguage(stored.selectedLanguage);
    }
    const lang = LANGUAGES.find(l => l.id === selectedLanguage);
    if (lang) el.langName.textContent = lang.name;

    if (stored.panelMode) {
      setPanelMode(stored.panelMode);
      // Tell content script to resize immediately (no animation on load)
      applyPanelMode(stored.panelMode, false);
    }

    // §1 — Load models (from cache or OpenRouter), then populate dropdown
    await loadModels();

    if (sessionSnapshot?.model && MODELS.find(m => m.id === sessionSnapshot.model)) {
      setSelectedModelId(sessionSnapshot.model);
    } else if (stored.selectedModel && MODELS.find(m => m.id === stored.selectedModel)) {
      setSelectedModelId(stored.selectedModel);
    }

    populateModelDropdown();
    populateLanguageDropdown();

    const restored = restorePseudoSession(sessionSnapshot, {
      updateMetricsFromUsage,
      resetMetrics,
      updateSessionBanner,
      restoreSessionSummary,
      syncGenerateState,
    });

    // Populate dropdowns again after session restore (model may have been updated)
    populateModelDropdown();
    populateLanguageDropdown();

    if (!restored) {
      updateMetrics();
      syncGenerateState();
    }

    // If no session was restored, auto-create a shell so budget is settable
    // before the first generate (same effect as the old "Start Session" button).
    if (!currentSession) {
      createSession();
    }

    // ─── Inactivity resume check ─────────────────
    // Only prompt if the snapshot has real content and the session is NOT already locked.
    const snapshotAge = sessionSnapshot?.timestamp ? Date.now() - sessionSnapshot.timestamp : 0;
    const snapshotHasContent = hasRestoredSession;
    const sessionIsLocked = sessionSnapshot?.currentSession?.locked === true;
    if (snapshotHasContent && !sessionIsLocked && snapshotAge > INACTIVITY_THRESHOLD_MS) {
      el.resumeDialogAge.textContent = formatAge(snapshotAge);
      el.resumeDialog.classList.add('visible');
    }

    updateShortcutLabel(el.shortcutLabel);

    // Populate read-only system prompt viewer
    const syspromptBody = document.getElementById('sysprompt-body');
    if (syspromptBody) syspromptBody.textContent = SYSTEM_PROMPT;

    // Wire all event listeners
    bindEvents();

    // React to key and active-model changes from settings page
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      let needsDropdownRefresh = false;
      if (changes.keys) {
        setConfiguredKeys(changes.keys.newValue || {});
        if (Object.keys(configuredKeys).length === 0 && !el.pseudoInput.value && !lastResponse) {
          el.panelMain.classList.add('empty');
        } else {
          el.panelMain.classList.remove('empty');
        }
        needsDropdownRefresh = true;
      }
      if (changes.activeModels) {
        setActiveModels(changes.activeModels.newValue || {});
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
