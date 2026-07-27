/**
 * OmniBridge Intent Router Controller
 * Handles HTTP endpoints for the Dynamic Intent Routing & API Proxy engine.
 */

'use strict';

const { routeIntent } = require('../services/intent.router');
const { classifyIntent, optimizePrompt } = require('../services/intent.classifier');
const { resolveRoute, getFullMatrix } = require('../services/routing.matrix');

class RouterController {
  /**
   * POST /api/v1/router/route
   *
   * Full pipeline: classify → resolve → proxy → structured response.
   *
   * Body: { prompt, temperature?, preferHighQuality?, dryRun? }
   *
   * Response: {
   *   success, taskType, targetModel, targetProvider,
   *   optimizedPrompt, estimatedLatency, actualLatencyMs,
   *   confidence, classificationMethod, output, usage,
   *   fallbacksAttempted, error
   * }
   */
  static async route(req, res) {
    const { prompt, temperature, preferHighQuality, dryRun } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: "prompt" must be a non-empty string.',
        errorCode: 'INVALID_PROMPT'
      });
    }

    try {
      const result = await routeIntent({ prompt, temperature, preferHighQuality, dryRun });

      const statusCode = result.success ? 200 : 502;
      return res.status(statusCode).json(result);
    } catch (err) {
      console.error('[RouterController] Unexpected error:', err);
      return res.status(500).json({
        success: false,
        error: 'Internal gateway error during intent routing.',
        details: err.message
      });
    }
  }

  /**
   * POST /api/v1/router/classify
   *
   * Classify-only endpoint — no API call made, returns task type + confidence.
   *
   * Body: { prompt }
   */
  static async classify(req, res) {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: "prompt" must be a non-empty string.'
      });
    }

    try {
      const { taskType, confidence, method } = classifyIntent(prompt);
      const optimized = optimizePrompt(prompt, taskType);
      const route = resolveRoute(taskType);

      return res.json({
        success: true,
        taskType,
        confidence,
        classificationMethod: method,
        optimizedPrompt: optimized,
        recommendedProvider: route.primary?.provider || null,
        recommendedModel: route.primary?.model || null,
        estimatedLatency: route.primary?.estimatedLatencyMs || null,
        costTier: route.primary?.costTier || null,
        capability: route.primary?.capability || null,
        fallbackCount: route.fallbackChain?.length || 0
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/router/matrix
   *
   * Returns the full routing cost/performance matrix for inspection.
   */
  static async getMatrix(req, res) {
    try {
      const matrix = getFullMatrix();
      return res.json({
        success: true,
        description: 'OmniBridge cost/performance routing matrix — sorted by cost-effectiveness.',
        matrix
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/router/dry-run
   *
   * Resolve routing plan without executing the API call.
   * Useful for UI preview / cost estimation.
   *
   * Body: { prompt, preferHighQuality? }
   */
  static async dryRun(req, res) {
    const { prompt, preferHighQuality } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: "prompt" must be a non-empty string.'
      });
    }

    try {
      const result = await routeIntent({ prompt, preferHighQuality, dryRun: true });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = RouterController;
