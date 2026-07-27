const ProviderService = require('../services/provider.service');

/**
 * Controller for OmniBridge REST Gateway API
 */
class GatewayController {
  /**
   * GET /api/v1/gateway/health
   */
  static async healthCheck(req, res) {
    return res.json({
      status: 'online',
      gateway: 'OmniBridge API Gateway',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * GET /api/v1/gateway/providers
   */
  static async getProviders(req, res) {
    try {
      const providers = ProviderService.getProviderList();
      return res.json({ success: true, providers });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/gateway/completion
   */
  static async processCompletion(req, res) {
    const startTime = Date.now();
    try {
      const { provider = 'gemini', model, prompt, temperature } = req.body;

      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'Missing required body parameter: prompt'
        });
      }

      const result = await ProviderService.generateCompletion({
        provider,
        model,
        prompt,
        temperature
      });

      const latencyMs = Date.now() - startTime;

      return res.json({
        success: true,
        latencyMs,
        data: result
      });
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      return res.status(500).json({
        success: false,
        latencyMs,
        error: err.message
      });
    }
  }
}

module.exports = GatewayController;
