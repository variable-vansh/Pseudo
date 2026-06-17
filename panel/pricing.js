// panel/pricing.js — Token usage parsing and cost calculation.

'use strict';

// ─────────────────────────────────────────────
// MODEL_PRICING — source of truth for cost display.
// Keyed by full OpenRouter model ID.
// If a model is missing, cost is hidden (not shown as $0).
// ─────────────────────────────────────────────
export const MODEL_PRICING = {
  'google/gemini-3.5-flash':        { inputPer1M: 1.50,  outputPer1M: 9.00  },
  'google/gemini-3.1-pro-preview':  { inputPer1M: 2.00,  outputPer1M: 12.00 },
  'google/gemini-2.5-flash':        { inputPer1M: 0.30,  outputPer1M: 2.50  },
  'anthropic/claude-opus-4-8':      { inputPer1M: 5.00,  outputPer1M: 25.00 },
  'anthropic/claude-sonnet-4-6':    { inputPer1M: 1.50,  outputPer1M: 7.50  },
  'anthropic/claude-haiku-4-5':     { inputPer1M: 0.25,  outputPer1M: 1.25  },
  'openai/gpt-5.5':                 { inputPer1M: 5.00,  outputPer1M: 30.00 },
  'openai/gpt-5.4-mini':            { inputPer1M: 0.40,  outputPer1M: 1.60  },
  'openai/gpt-4.1-mini':            { inputPer1M: 0.30,  outputPer1M: 1.20  },
  'deepseek/deepseek-v4-pro':       { inputPer1M: 0.435, outputPer1M: 0.87  },
  'deepseek/deepseek-v4-flash':     { inputPer1M: 0.14,  outputPer1M: 0.28  },
  'x-ai/grok-4.3':                  { inputPer1M: 1.25,  outputPer1M: 2.50  },
  'x-ai/grok-build-0.1':           { inputPer1M: 1.00,  outputPer1M: 2.00  },
  'moonshotai/kimi-k2.6':          { inputPer1M: 0.95,  outputPer1M: 4.00  },
};

/**
 * extractTokenUsage — parses exact token counts from a raw API response.
 * Never throws. Returns { input, output, thinking, total }.
 * thinking is provider-specific reasoning/thought usage where the API exposes it.
 * If the provider returned no usage data, all fields are 0.
 */
export function extractTokenUsage(providerKey, responseData) {
  try {
    switch (providerKey) {
      case 'google': {
        const m        = responseData?.usageMetadata ?? {};
        const input    = m.promptTokenCount     ?? 0;
        const thinking = m.thoughtsTokenCount   ?? 0;  // Gemini 2.5+ thinking
        const output   = m.candidatesTokenCount ?? 0;
        const total    = m.totalTokenCount      ?? 0;
        return { input, output, thinking, total };
      }
      case 'anthropic': {
        const u = responseData?.usage ?? {};
        const input  = u.input_tokens  ?? 0;
        const output = u.output_tokens ?? 0;
        return { input, output, thinking: 0, total: input + output };
      }
      case 'openrouter': {
        const u      = responseData?.usage ?? {};
        const input  = u.prompt_tokens     ?? 0;
        const output = u.completion_tokens ?? 0;
        const total  = u.total_tokens      ?? (input + output);
        const thinking = u.completion_tokens_details?.reasoning_tokens ?? 0;
        return { input, output, thinking, total };
      }
      default: {
        // OpenAI-compatible: openai, x-ai, deepseek, moonshotai
        const u      = responseData?.usage ?? {};
        const input  = u.prompt_tokens     ?? 0;
        const output = u.completion_tokens ?? 0;
        const thinking = u.completion_tokens_details?.reasoning_tokens ?? 0;
        return { input, output, thinking, total: input + output };
      }
    }
  } catch (_) {
    return { input: 0, output: 0, thinking: 0, total: 0 };
  }
}

/**
 * calculateCost — returns exact cost in USD from a usage object + model ID.
 * Returns null if the model has no pricing entry (cost is then hidden).
 * Gemini bills thinking tokens at the output rate.
 */
export function calculateCost(usage, modelId) {
  const pricing = MODEL_PRICING[modelId];
  if (!pricing) return null;
  const billableOutput = usage.output + usage.thinking;
  return (usage.input / 1_000_000)        * pricing.inputPer1M
       + (billableOutput / 1_000_000)      * pricing.outputPer1M;
}
