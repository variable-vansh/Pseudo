// panel/api.js — All network calls: fetch wrapper, error mapping, provider dispatchers.

'use strict';

import { PROVIDER_ENDPOINTS } from './constants.js';
import { nativeModelId } from './models.js';
import { _currentController, setCurrentController } from './state.js';

// ─── Fetch with timeout ─────────────────────
// Wraps fetch with an AbortController timeout.
// Throws a user-friendly error on timeout.
// Uses the module-level _currentController so callers can abort it externally.

export async function fetchWithTimeout(url, options, timeoutMs = 60000) {
  // Abort any previous in-flight request
  if (_currentController) {
    _currentController.abort();
    setCurrentController(null);
  }
  const controller = new AbortController();
  setCurrentController(controller);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err) {
    if (err.name === 'AbortError')
      throw new Error('Request timed out. The model may be overloaded — try again or switch to a stable model.');
    throw err;
  } finally {
    clearTimeout(timer);
    // Clear the ref only if it still points to this controller
    if (_currentController === controller) setCurrentController(null);
  }
}

// ─── Error mapping ──────────────────────────
// Maps raw error messages to actionable user copy.
// Pass currentModelId so we don't suggest a model the user is already on.

export function getErrorMessage(err, currentModelId) {
  const msg = err?.message || '';

  // Check timeout FIRST — fetchWithTimeout message contains 'overloaded'
  // so it must be caught before the 503/overloaded branch.
  if (msg.includes('timed out') || err?.name === 'AbortError')
    return 'Request timed out — the model is slow right now. Try again in a moment.';

  if (msg.includes('API_KEY_INVALID') || msg.includes('403'))
    return 'Invalid API key. Check your key in Settings.';
  if (msg.includes('401'))
    return 'Unauthorized — your API key may be expired or incorrect.';
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED'))
    return 'Rate limit hit. Wait a moment and try again.';
  if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
    // Don't suggest switching if they're already on the stable model
    const onStable = currentModelId === 'google/gemini-2.5-flash';
    return onStable
      ? 'Gemini is overloaded right now. Wait a moment and try again.'
      : 'Model is overloaded. Try switching to Gemini 2.5 Flash (stable) or try again later.';
  }
  if (msg.includes('blocked') || msg.includes('SAFETY') || msg.includes('RECITATION'))
    return 'Request blocked by model safety filters. Rephrase your pseudocode.';
  if (msg.includes('empty') || msg.includes('Empty'))
    return msg; // already user-friendly from callGoogle
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network'))
    return 'Network error. Check your connection and try again.';
  if (msg.includes('not found') || msg.includes('NOT_FOUND'))
    return `Model not found: ${currentModelId || 'unknown'}. It may not be available yet — try a stable model.`;
  return `Error: ${msg}`;
}

// ─── Provider helpers ───────────────────────

function messageSystemPrompt(messages) {
  return messages.find(m => m.role === 'system')?.content || '';
}

// ─── Provider callees ───────────────────────

async function callGoogle(apiKey, modelId, messages) {
  const nativeId = nativeModelId(modelId);
  const systemPrompt = messageSystemPrompt(messages);
  const contents = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${nativeId}:generateContent?key=${apiKey}`;

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API error ${res.status}`);
  }

  const data         = await res.json();
  const candidate    = data?.candidates?.[0];
  const finishReason = candidate?.finishReason;

  if (!candidate || finishReason === 'SAFETY' || finishReason === 'RECITATION') {
    throw new Error(`blocked (reason: ${finishReason || 'unknown'})`);
  }

  const text = candidate?.content?.parts?.[0]?.text;
  if (!text || text.trim() === '') {
    throw new Error('Gemini returned an empty response. Try rephrasing your pseudocode.');
  }

  return { text, responseData: data };
}

async function callOpenAICompat(apiKey, baseUrl, modelId, messages) {
  const nativeId = nativeModelId(modelId);
  const res = await fetchWithTimeout(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: nativeId,
      messages,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }

  const data   = await res.json();
  const choice = data?.choices?.[0];
  const text   = choice?.message?.content;
  if (!text || text.trim() === '') {
    const reason = choice?.finish_reason || 'unknown';
    throw new Error(`Model returned an empty response (finish_reason: ${reason}). Try rephrasing.`);
  }

  return { text, responseData: data };
}

async function callAnthropic(apiKey, modelId, messages) {
  const nativeId = nativeModelId(modelId);
  const systemPrompt = messageSystemPrompt(messages);
  const chatMessages = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content }));
  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: nativeId,
      max_tokens: 4096,
      system: systemPrompt,
      messages: chatMessages,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Anthropic API error ${res.status}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text || text.trim() === '') {
    const reason = data?.stop_reason || 'unknown';
    throw new Error(`Anthropic returned an empty response (stop_reason: ${reason}). Try rephrasing.`);
  }

  return { text, responseData: data };
}

// ─── Dispatcher ─────────────────────────────

export async function dispatchAPI(provider, apiKey, modelId, messages) {
  if (provider === 'google') {
    return callGoogle(apiKey, modelId, messages);
  }
  if (provider === 'anthropic') {
    return callAnthropic(apiKey, modelId, messages);
  }
  // All other providers use OpenAI-compatible chat/completions
  const baseUrl = PROVIDER_ENDPOINTS[provider];
  if (!baseUrl) throw new Error(`Unknown provider: ${provider}`);
  return callOpenAICompat(apiKey, baseUrl, modelId, messages);
}
