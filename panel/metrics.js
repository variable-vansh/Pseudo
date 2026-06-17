// panel/metrics.js — Token count display: reset, update, and formatting helpers.

'use strict';

import { el } from './dom.js';
import { setLastTokenMetrics } from './state.js';

// ─── Formatting helpers ─────────────────────

export function fmt$(n) {
  if (n === 0) return '$0.0000';
  if (n < 0.0001) return '$' + n.toFixed(6);
  return '$' + n.toFixed(4);
}

export function fmtTokenNumber(n) {
  return n.toLocaleString();
}

// ─── Pre-generation state ───────────────────
// Show dashes until we have real numbers.

export function resetMetrics() {
  setLastTokenMetrics(null);
  el.metricsCompact.textContent              = 'Tokens';
  el.metricsInputTk.textContent              = '—';
  el.metricsOutputTk.textContent             = '—';
  el.metricsTotalTk.textContent              = '—';
  el.metricsTotalCost.textContent            = '';
  el.metricsThinkingTk.textContent           = '—';
  el.metricsThinkingRow.style.display        = 'none';
  const inAnnot  = document.getElementById('metrics-input-annotation');
  const outAnnot = document.getElementById('metrics-output-annotation');
  if (inAnnot)  inAnnot.textContent  = '';
  if (outAnnot) outAnnot.textContent = '';
}

// ─── Post-generation: populate exact values ─

export function updateMetricsFromUsage(usage, modelId) {
  // If all zeros, the provider returned no usage data — hide the expanded rows
  if (usage.total === 0 && usage.input === 0 && usage.output === 0) {
    el.metricsCompact.textContent   = 'Tokens';
    el.metricsTotalTk.textContent   = '—';
    el.metricsTotalCost.textContent = '';
    return;
  }

  // Input row
  el.metricsInputTk.textContent = fmtTokenNumber(usage.input);

  // Thinking row (Gemini only)
  if (usage.thinking > 0) {
    el.metricsThinkingTk.textContent    = fmtTokenNumber(usage.thinking);
    el.metricsThinkingRow.style.display = '';
  } else {
    el.metricsThinkingRow.style.display = 'none';
  }

  // Output row
  el.metricsOutputTk.textContent = fmtTokenNumber(usage.output);

  // Total row
  el.metricsTotalTk.textContent = fmtTokenNumber(usage.total);

  // Cost display removed — show token count only
  el.metricsTotalCost.textContent = '';
  el.metricsCompact.textContent   = `${usage.total.toLocaleString()} tokens`;
}

// updateMetrics is called before a generation (resets to pre-flight state)
export function updateMetrics() {
  resetMetrics();
}
