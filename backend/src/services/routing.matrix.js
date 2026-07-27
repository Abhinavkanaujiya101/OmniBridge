/**
 * OmniBridge Cost/Performance Rule Matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * Maps each task type to an ordered list of (provider, model) candidates, sorted
 * by cost-effectiveness first, quality second.
 *
 * Each rule entry defines:
 *   provider      - The provider identifier (maps to config.providers)
 *   model         - The specific model string for the API call
 *   estimatedLatencyMs  - Expected p50 latency in milliseconds
 *   costTier      - 'low' | 'medium' | 'high'
 *   capability    - Human-readable reason this model fits the task
 *   supportsStream - Whether provider supports real-time token streaming
 *
 * Fallback chains are ordered: cheapest+fastest first, most capable last.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const config = require('../config/env');

/** @typedef {'TEXT'|'MATH'|'IMAGE_GENERATION'|'VIDEO_GENERATION'|'CODE'} TaskType */

/**
 * @typedef {Object} RouteRule
 * @property {string} provider
 * @property {string} model
 * @property {number} estimatedLatencyMs
 * @property {'low'|'medium'|'high'} costTier
 * @property {string} capability
 * @property {boolean} supportsStream
 */

/** @type {Record<TaskType, RouteRule[]>} */
const ROUTING_MATRIX = {

  // ── TEXT: Fast, cheap summarization, translation, Q&A ─────────────────────
  TEXT: [
    {
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      estimatedLatencyMs: 800,
      costTier: 'low',
      capability: 'Ultra-fast text generation, strong reasoning, 1M context window',
      supportsStream: true
    },
    {
      provider: 'openai',
      model: 'gpt-4o-mini',
      estimatedLatencyMs: 1200,
      costTier: 'low',
      capability: 'Balanced quality/cost, reliable for structured text tasks',
      supportsStream: true
    },
    {
      provider: 'together',
      model: 'meta-llama/Llama-3-70b-chat-hf',
      estimatedLatencyMs: 1800,
      costTier: 'low',
      capability: 'Open-source, privacy-friendly, strong generalization',
      supportsStream: true
    },
    {
      provider: 'openai',
      model: 'gpt-4o',
      estimatedLatencyMs: 2500,
      costTier: 'high',
      capability: 'Maximum quality fallback for complex text tasks',
      supportsStream: true
    }
  ],

  // ── MATH: Step-by-step reasoning, formal proofs, calculations ─────────────
  MATH: [
    {
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      estimatedLatencyMs: 1000,
      costTier: 'low',
      capability: 'Strong mathematical reasoning with chain-of-thought',
      supportsStream: true
    },
    {
      provider: 'openai',
      model: 'gpt-4o-mini',
      estimatedLatencyMs: 1400,
      costTier: 'low',
      capability: 'Reliable arithmetic and algebraic problem solving',
      supportsStream: true
    },
    {
      provider: 'together',
      model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      estimatedLatencyMs: 2000,
      costTier: 'low',
      capability: 'Mixture of Experts model, strong at structured reasoning',
      supportsStream: true
    },
    {
      provider: 'openai',
      model: 'gpt-4o',
      estimatedLatencyMs: 3000,
      costTier: 'high',
      capability: 'Best-in-class for complex proofs and multi-step derivations',
      supportsStream: true
    }
  ],

  // ── CODE: Code generation, debugging, refactoring ─────────────────────────
  CODE: [
    {
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      estimatedLatencyMs: 900,
      costTier: 'low',
      capability: 'Fast code generation with multi-language support',
      supportsStream: true
    },
    {
      provider: 'openai',
      model: 'gpt-4o-mini',
      estimatedLatencyMs: 1300,
      costTier: 'low',
      capability: 'Reliable code completion, debugging, and unit test generation',
      supportsStream: true
    },
    {
      provider: 'together',
      model: 'meta-llama/Llama-3-70b-chat-hf',
      estimatedLatencyMs: 2000,
      costTier: 'low',
      capability: 'Open-source alternative, strong at Python and JavaScript',
      supportsStream: true
    },
    {
      provider: 'openai',
      model: 'gpt-4o',
      estimatedLatencyMs: 3000,
      costTier: 'high',
      capability: 'Maximum code quality for complex architecture design',
      supportsStream: true
    }
  ],

  // ── IMAGE_GENERATION: Text-to-image via Together AI (FLUX) ────────────────
  IMAGE_GENERATION: [
    {
      provider: 'together',
      model: 'black-forest-labs/FLUX.1-schnell-Free',
      estimatedLatencyMs: 4000,
      costTier: 'low',
      capability: 'FLUX Schnell: ultra-fast free tier image generation',
      supportsStream: false
    },
    {
      provider: 'together',
      model: 'black-forest-labs/FLUX.1.1-pro',
      estimatedLatencyMs: 7000,
      costTier: 'medium',
      capability: 'FLUX Pro: photorealistic, high-detail image synthesis',
      supportsStream: false
    },
    {
      provider: 'together',
      model: 'stabilityai/stable-diffusion-xl-base-1.0',
      estimatedLatencyMs: 8000,
      costTier: 'medium',
      capability: 'Stable Diffusion XL fallback for diverse image styles',
      supportsStream: false
    }
  ],

  // ── VIDEO_GENERATION: Text-to-video via Runway ML ─────────────────────────
  VIDEO_GENERATION: [
    {
      provider: 'runway',
      model: 'gen3a_turbo',
      estimatedLatencyMs: 45000,
      costTier: 'medium',
      capability: 'Runway Gen-3 Alpha Turbo: fast, high-quality video generation',
      supportsStream: false
    },
    {
      provider: 'runway',
      model: 'gen-2',
      estimatedLatencyMs: 90000,
      costTier: 'medium',
      capability: 'Runway Gen-2: stable fallback for text-to-video tasks',
      supportsStream: false
    }
  ]
};

/**
 * Select the optimal routing rule for a given task type.
 * Skips entries whose provider API key is not configured.
 * Returns the first available (cheapest) configured rule.
 *
 * @param {TaskType} taskType
 * @param {{ preferHighQuality?: boolean }} [options]
 * @returns {{ primary: RouteRule|null, fallbackChain: RouteRule[], taskType: TaskType }}
 */
function resolveRoute(taskType, options = {}) {
  const rules = ROUTING_MATRIX[taskType] || ROUTING_MATRIX['TEXT'];

  // Check which providers actually have a configured API key
  const available = rules.filter((rule) => {
    const providerConfig = config.providers[rule.provider];
    return providerConfig && Boolean(providerConfig.apiKey);
  });

  const chain = options.preferHighQuality ? [...available].reverse() : available;

  if (chain.length === 0) {
    // All providers unconfigured — return rules without filtering so the
    // executor can surface a descriptive error per provider.
    return {
      primary: rules[0] || null,
      fallbackChain: rules.slice(1),
      taskType,
      allUnconfigured: true
    };
  }

  return {
    primary: chain[0],
    fallbackChain: chain.slice(1),
    taskType,
    allUnconfigured: false
  };
}

/**
 * Return the full routing matrix (for inspection / admin endpoints).
 */
function getFullMatrix() {
  return ROUTING_MATRIX;
}

module.exports = { resolveRoute, getFullMatrix, ROUTING_MATRIX };
