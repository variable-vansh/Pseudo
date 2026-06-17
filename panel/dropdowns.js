// panel/dropdowns.js — Model and language dropdown population and toggling.

'use strict';

import { LANGUAGES, PROVIDER_LABELS, PROVIDER_KEY_NAME } from './constants.js';
import { el } from './dom.js';
import {
  selectedModelId, selectedLanguage, configuredKeys, activeModels,
  setSelectedModelId, setSelectedLanguage,
} from './state.js';
import * as State from './state.js';
import { MODELS } from './models.js';
import { updateMetrics } from './metrics.js';
import { persistSessionSnapshot } from './storage.js';

// ─── Helpers ────────────────────────────────

export function closeAllDropdowns() {
  document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
}

export function syncGenerateState() {
  const hasText  = el.pseudoInput.value.trim().length > 0;
  const hasModel = !!selectedModelId;
  el.generateBtn.disabled = !hasText || !hasModel || State.isGenerating;
}

// ─── Model dropdown ─────────────────────────

export function populateModelDropdown() {
  el.modelDropdown.innerHTML = '';

  // For each provider with a key, show only the models the user has checked in Settings.
  // activeModels[keyName] is now an Array of enabled model IDs (or undefined = show all).
  const available = [];
  for (const m of MODELS) {
    const keyName = PROVIDER_KEY_NAME[m.provider] || m.provider;
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
    setSelectedModelId(null);

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
    setSelectedModelId(gemini ? gemini.id : available[0].id);
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
        setSelectedModelId(m.id);
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

// ─── Language dropdown ──────────────────────

export function populateLanguageDropdown() {
  el.langDropdown.innerHTML = '';

  for (const lang of LANGUAGES) {
    const item = document.createElement('div');
    item.className = 'dropdown-item' + (lang.id === selectedLanguage ? ' selected' : '');
    item.textContent = lang.name;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      setSelectedLanguage(lang.id);
      el.langName.textContent = lang.name;
      closeAllDropdowns();
      populateLanguageDropdown();
      chrome.storage.local.set({ selectedLanguage: lang.id });
      persistSessionSnapshot();
    });
    el.langDropdown.appendChild(item);
  }
}
