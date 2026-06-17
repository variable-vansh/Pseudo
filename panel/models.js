// panel/models.js — Live model list: loading, caching, and building from OpenRouter data.

'use strict';

import { SUPPORTED_MODELS, ALLOWED_PREFIXES, FALLBACK_MODELS } from './constants.js';

// Live model list (populated from OpenRouter cache or fallback).
// Shape: [{ id, name, provider, pricing }]
export let MODELS = [];

export function setModels(v) { MODELS = v; }

// ─── Helpers ───────────────────────────────

export function providerFromId(modelId) {
  // e.g. 'google/gemini-2.5-flash' → 'google'
  return modelId.split('/')[0];
}

export function nativeModelId(modelId) {
  // e.g. 'google/gemini-2.5-flash' → 'gemini-2.5-flash'
  return modelId.split('/').slice(1).join('/');
}

function toModelEntry(m) {
  return {
    id:       m.id,
    name:     m.name,
    provider: providerFromId(m.id),
    pricing:  m.pricing,
  };
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

// Fetch/refresh from OpenRouter, respecting 24h TTL
const CACHE_TTL = 24 * 60 * 60 * 1000;

export async function loadModels() {
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
