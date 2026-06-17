// panel/state.js — All mutable runtime state. Modules import and mutate these directly.

'use strict';

// Currently selected model ID (e.g. 'google/gemini-2.5-flash')
export let selectedModelId    = null;
export let selectedLanguage   = 'cpp';
export let configuredKeys     = {};
export let activeModels       = {};  // { providerKeyName → modelId } — set from keys page
export let isGenerating       = false;
export let metricsExpanded    = false;
export let currentSession     = null;
export let panelMode          = 'narrow';  // 'narrow' | 'wide'
export let historyOpen        = false;
export let infoModalOpen      = false;
export let sessionExpanded    = false;
export let _currentController = null;  // module-level AbortController ref
export let conversationMessages = [];
export let lastResponse       = '';
export let lastTokenMetrics   = null;

// ─── Setters ───────────────────────────────
// ES modules export live bindings for primitives; other modules must call these
// setters to mutate state so all importers see the updated value.

export function setSelectedModelId(v)       { selectedModelId    = v; }
export function setSelectedLanguage(v)      { selectedLanguage   = v; }
export function setConfiguredKeys(v)        { configuredKeys     = v; }
export function setActiveModels(v)          { activeModels       = v; }
export function setIsGenerating(v)          { isGenerating       = v; }
export function setMetricsExpanded(v)       { metricsExpanded    = v; }
export function setCurrentSession(v)        { currentSession     = v; }
export function setPanelMode(v)             { panelMode          = v; }
export function setHistoryOpen(v)           { historyOpen        = v; }
export function setInfoModalOpen(v)         { infoModalOpen      = v; }
export function setCurrentController(v)     { _currentController = v; }
export function setConversationMessages(v)  { conversationMessages = v; }
export function setLastResponse(v)          { lastResponse       = v; }
export function setLastTokenMetrics(v)      { lastTokenMetrics   = v; }
