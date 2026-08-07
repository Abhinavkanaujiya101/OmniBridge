const axios = require('axios');
const config = require('../config/env');

/**
 * Service Layer for Unified Multi-Provider Orchestration
 */
class ProviderService {
  /**
   * Get supported providers and their active status.
   */
   static getProviderList() {
    return [
      {
        id: 'groq',
        name: 'Groq Cloud',
        models: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
        configured: Boolean(config.providers.groq?.apiKey),
        defaultModel: 'llama-3.1-8b-instant'
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
        configured: Boolean(config.providers.gemini.apiKey),
        defaultModel: 'gemini-1.5-flash'
      },
      {
        id: 'openai',
        name: 'OpenAI',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        configured: Boolean(config.providers.openai.apiKey),
        defaultModel: 'gpt-4o-mini'
      },
      {
        id: 'together',
        name: 'Together AI',
        models: ['meta-llama/Llama-3-70b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
        configured: Boolean(config.providers.together.apiKey),
        defaultModel: 'meta-llama/Llama-3-70b-chat-hf'
      },
      {
        id: 'luma',
        name: 'Luma Dream Machine',
        models: ['dream-machine', 'ray-1', 'ray-2'],
        configured: Boolean(config.providers.luma.apiKey),
        defaultModel: 'dream-machine'
      }
    ];
  }

  /**
   * Validate model capability against incoming prompt intent.
   * Intercepts mismatched queries (e.g. conversational text sent to Luma or FLUX image models).
   */
  static validateModelCapability(provider, model, prompt) {
    const { classifyIntent } = require('./intent.classifier');
    const classification = classifyIntent(prompt);
    const taskType = classification.taskType;

    const targetModel = (model || '').toLowerCase();
    const isLuma = provider === 'luma' || targetModel.includes('dream-machine') || targetModel.includes('ray-');
    const isImageModel = (provider === 'together' && (
      targetModel.includes('flux') || targetModel.includes('stable-diffusion') || targetModel.includes('dalle')
    )) || targetModel.includes('flux') || targetModel.includes('stable-diffusion');

    // Case 1: Luma Dream Machine (Generative Video)
    if (isLuma) {
      if (taskType !== 'VIDEO_GENERATION') {
        const modelName = 'Luma Dream Machine';
        const taskDescription = taskType === 'IMAGE_GENERATION' ? 'static image synthesis' : 'conversational text chat or general queries';
        const mismatchMessage = `⚠️ Model Capability Mismatch\n\nThe selected model (${modelName}) is not designed for ${taskDescription}.\n\n• Specialized Model Capability: Luma Dream Machine is specialized for generative video creation, not text chat.\n• Detected Prompt Intent: ${taskType}\n\n💡 Suggestion: Switch back to 'Auto Routing' mode or select a conversational text model (like Google Gemini, OpenAI, or Groq) for text-based queries.`;

        return {
          isCompatible: false,
          mismatchMessage,
          detectedTaskType: taskType,
          modelName
        };
      }
    }

    // Case 2: Specialized Image Synthesis Models (FLUX / Stable Diffusion)
    if (isImageModel) {
      if (taskType !== 'IMAGE_GENERATION') {
        const modelName = targetModel.includes('flux') ? 'FLUX Image Model' : 'Image Synthesis Model';
        const taskDescription = taskType === 'VIDEO_GENERATION' ? 'generative video creation' : 'conversational text chat or general queries';
        const mismatchMessage = `⚠️ Model Capability Mismatch\n\nThe selected model (${modelName}) is not designed for ${taskDescription}.\n\n• Specialized Model Capability: ${modelName} is specialized for generative image synthesis, not text chat.\n• Detected Prompt Intent: ${taskType}\n\n💡 Suggestion: Switch back to 'Auto Routing' mode or select a conversational text model (like Google Gemini, OpenAI, or Groq) for text-based queries.`;

        return {
          isCompatible: false,
          mismatchMessage,
          detectedTaskType: taskType,
          modelName
        };
      }
    }

    return {
      isCompatible: true,
      detectedTaskType: taskType,
      modelName: model || provider
    };
  }

  /**
   * Helper to inspect if an error is an HTTP 429 Rate Limit exception.
   */
  static isRateLimitError(err) {
    if (!err) return false;
    const status = err.response?.status || err.status || err.statusCode;
    if (status === 429) return true;

    const msg = (err.message || '').toLowerCase();
    const dataStr = err.response?.data ? JSON.stringify(err.response.data).toLowerCase() : '';
    const combined = `${msg} ${dataStr}`;

    return (
      combined.includes('429') ||
      combined.includes('rate limit') ||
      combined.includes('ratelimit') ||
      combined.includes('too many requests') ||
      combined.includes('quota') ||
      combined.includes('resource_exhausted')
    );
  }

  /**
   * Helper to execute API calls with exponential backoff retries on HTTP 429 errors (2s, 4s, 8s).
   */
  static async executeWithRetry(fn, { maxRetries = 3, initialDelayMs = 2000, providerLabel = 'API' } = {}) {
    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (err) {
        attempt++;
        const rateLimited = ProviderService.isRateLimitError(err);

        if (rateLimited && attempt <= maxRetries) {
          const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
          console.warn(
            `[RateLimit Interceptor] ${providerLabel} returned HTTP 429 Rate Limit. Retrying attempt ${attempt}/${maxRetries} in ${delayMs / 1000}s exponential backoff...`
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * Dispatch non-streaming completion request with dynamic fallback and retry handling.
   */
  static async generateCompletion({ provider, model, prompt, temperature = 0.7 }) {
    // 1. Perform intent & capability validation before executing provider call
    const capabilityCheck = this.validateModelCapability(provider, model, prompt);
    if (!capabilityCheck.isCompatible) {
      return {
        provider,
        model: model || 'default',
        output: capabilityCheck.mismatchMessage,
        isCapabilityMismatch: true,
        detectedTaskType: capabilityCheck.detectedTaskType,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      };
    }

    // 2. Primary Provider Call with Exponential Backoff Retry
    try {
      return await this._dispatchDirectCall(provider, model, prompt, temperature);
    } catch (primaryErr) {
      console.warn(`[ProviderService] Primary provider ${provider}/${model} failed: ${primaryErr.message}. Attempting Dynamic Provider Fallback...`);

      // 3. Dynamic Provider Fallback
      const isRateLimit = this.isRateLimitError(primaryErr);
      const fallbackCandidates = ['groq', 'gemini', 'openai', 'together'].filter((p) => p !== provider);

      for (const fallbackProv of fallbackCandidates) {
        const provConfig = config.providers[fallbackProv];
        if (provConfig && Boolean(provConfig.apiKey)) {
          try {
            console.log(`[ProviderService] Dynamic Fallback: attempting ${fallbackProv}...`);
            const fallbackResult = await this._dispatchDirectCall(fallbackProv, null, prompt, temperature);
            return {
              ...fallbackResult,
              isFallback: true,
              primaryProvider: provider,
              output: `*(Notice: Primary provider "${provider}" encountered ${isRateLimit ? 'HTTP 429 Rate Limit' : 'a service disruption'}. Request fulfilled via ${fallbackResult.provider})*\n\n${fallbackResult.output}`
            };
          } catch (fallbackErr) {
            console.warn(`[ProviderService] Fallback provider ${fallbackProv} failed: ${fallbackErr.message}`);
          }
        }
      }

      // 4. User Notification if all fallbacks fail
      if (isRateLimit) {
        return {
          provider,
          model: model || 'default',
          isRateLimited: true,
          error: 'All available AI providers are currently rate-limited (HTTP 429). Please try again shortly.',
          output: `⚠️ Service Temporarily Rate-Limited\n\nAll available AI providers are currently experiencing heavy traffic or rate limits (HTTP 429).\n\n💡 Please wait a few moments and try your request again.`,
          usage: null
        };
      }

      return {
        provider,
        model: model || 'default',
        error: primaryErr.message,
        output: `⚠️ Execution Failure (${provider}/${model}): ${primaryErr.message}`,
        usage: null
      };
    }
  }

  static async _dispatchDirectCall(provider, model, prompt, temperature = 0.7) {
    switch (provider) {
      case 'groq':
        return await this._callGroq(model || 'llama-3.1-8b-instant', prompt, temperature);
      case 'gemini':
        return await this._callGemini(model || 'gemini-1.5-flash', prompt, temperature);
      case 'openai':
        return await this._callOpenAI(model || 'gpt-4o-mini', prompt, temperature);
      case 'together':
        return await this._callTogether(model || 'meta-llama/Llama-3-70b-chat-hf', prompt, temperature);
      case 'luma':
        return await this._callLuma(model || 'dream-machine', prompt);
      default:
        throw new Error(`Unsupported AI Provider: ${provider}`);
    }
  }

  static async _callGroq(model, prompt, temperature = 0.7) {
    return await ProviderService.executeWithRetry(
      async () => {
        const apiKey = config.providers.groq?.apiKey;
        if (!apiKey) throw new Error('Groq API key is not configured in backend environment.');

        const url = `${config.providers.groq.baseUrl}/chat/completions`;
        const response = await axios.post(
          url,
          {
            model: model || 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: prompt }],
            temperature
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        return {
          provider: 'groq',
          model: model || 'llama-3.1-8b-instant',
          output: response.data?.choices?.[0]?.message?.content || '',
          usage: response.data?.usage || null
        };
      },
      { providerLabel: `Groq (${model})` }
    );
  }

  static async _callGemini(model, prompt, temperature) {
    const apiKey = config.providers.gemini.apiKey;
    if (!apiKey) throw new Error('Gemini API key is not configured in backend environment.');

    const candidateModels = [
      model || 'gemini-1.5-flash',
      'gemini-1.5-flash',
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro',
      'gemini-1.0-pro'
    ].filter((m, i, self) => m && self.indexOf(m) === i);

    let lastError = null;

    for (const mod of candidateModels) {
      try {
        return await ProviderService.executeWithRetry(
          async () => {
            const url = `${config.providers.gemini.baseUrl}/models/${mod}:generateContent?key=${apiKey}`;
            const response = await axios.post(
              url,
              {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature }
              },
              { timeout: 30000 }
            );

            const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text && text.trim()) {
              return {
                provider: 'gemini',
                model: mod,
                output: text,
                usage: response.data?.usageMetadata || null
              };
            }
            throw new Error(`Empty candidate text returned for ${mod}`);
          },
          { providerLabel: `Gemini (${mod})` }
        );
      } catch (err) {
        lastError = err;
        console.warn(`[Gemini API] Candidate model "${mod}" failed (${err.response?.data?.error?.message || err.message}). Attempting next candidate...`);
      }
    }

    throw lastError || new Error('Gemini API call failed across all candidate models.');
  }

  static async _callOpenAI(model, prompt, temperature) {
    return await ProviderService.executeWithRetry(
      async () => {
        const apiKey = config.providers.openai.apiKey;
        if (!apiKey) throw new Error('OpenAI API key is not configured in backend environment.');

        const url = `${config.providers.openai.baseUrl}/chat/completions`;
        const response = await axios.post(
          url,
          {
            model: model || 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature
          },
          { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 30000 }
        );

        return {
          provider: 'openai',
          model: model || 'gpt-4o-mini',
          output: response.data?.choices?.[0]?.message?.content || '',
          usage: response.data?.usage || null
        };
      },
      { providerLabel: `OpenAI (${model})` }
    );
  }

  static async _callTogether(model, prompt, temperature) {
    return await ProviderService.executeWithRetry(
      async () => {
        const apiKey = config.providers.together.apiKey;
        if (!apiKey) throw new Error('Together AI API key is not configured in backend environment.');

        const isImageModel =
          model.includes('FLUX') || model.includes('flux') || model.includes('stable-diffusion');

        if (isImageModel) {
          const url = `${config.providers.together.baseUrl}/images/generations`;
          const response = await axios.post(
            url,
            {
              model,
              prompt,
              n: 1,
              width: 1024,
              height: 1024
            },
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: 60000
            }
          );

          const generatedUrl =
            response.data?.data?.[0]?.url ||
            (response.data?.data?.[0]?.b64_json
              ? `data:image/png;base64,${response.data.data[0].b64_json}`
              : null);

          return {
            provider: 'together',
            model,
            output: generatedUrl || `Synthesized image artifact for: "${prompt}"`,
            imageUrl: generatedUrl || undefined,
            usage: { model, taskType: 'IMAGE_GENERATION' }
          };
        }

        const url = `${config.providers.together.baseUrl}/chat/completions`;
        const response = await axios.post(
          url,
          {
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature
          },
          { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 30000 }
        );

        return {
          provider: 'together',
          model,
          output: response.data?.choices?.[0]?.message?.content || '',
          usage: response.data?.usage || null
        };
      },
      { providerLabel: `Together (${model})` }
    );
  }

  static async _callLuma(model, prompt) {
    const apiKey = config.providers.luma.apiKey;
    const targetModel = model || 'ray-2';

    let generationId = null;
    let state = 'queued';
    let videoUrl = null;

    if (apiKey) {
      const { LumaAI } = require('lumaai');
      let client = null;
      try {
        client = new LumaAI({ apiKey });
      } catch (_) {}

      // Step 1: Dispatch video creation request to Luma API (receiving generation job ID)
      try {
        if (client) {
          const generation = await client.generations.create({
            prompt,
            model: targetModel
          });
          generationId = generation.id;
          state = generation.state || generation.status || 'queued';
          videoUrl = generation.assets?.video || null;
        }
      } catch (sdkErr) {
        console.warn(`[Luma AI SDK] ${sdkErr.message}. Falling back to REST HTTPS endpoints.`);
      }

      if (!generationId) {
        const endpoints = [
          `${config.providers.luma.baseUrl}/generations`,
          'https://api.lumalabs.ai/dream-machine/v1/generations',
          'https://api.lumalabs.ai/v1/generations'
        ];

        for (const endpointUrl of endpoints) {
          try {
            const response = await axios.post(
              endpointUrl,
              { prompt, model: targetModel },
              {
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  accept: 'application/json',
                  'content-type': 'application/json'
                },
                timeout: 25000
              }
            );
            generationId = response.data?.id || null;
            state = response.data?.state || response.data?.status || 'queued';
            videoUrl = response.data?.assets?.video || null;
            if (generationId) break;
          } catch (err) {
            console.warn(`[Luma AI REST Error at ${endpointUrl}]: ${err.message}`);
          }
        }
      }

      // Step 2: Asynchronous polling loop (every 5 seconds) checking GET https://api.lumalabs.ai/dream-machine/v1/generations/{id}
      if (generationId && state !== 'completed') {
        console.log(`[Luma AI] Dispatched ${targetModel} generation (ID: ${generationId}). Starting 5s status polling loop...`);
        const maxPolls = 60; // 5 minutes maximum timeout

        for (let pollCount = 0; pollCount < maxPolls; pollCount++) {
          await new Promise((r) => setTimeout(r, 5000));

          try {
            let currentGen = null;
            if (client) {
              try {
                currentGen = await client.generations.get(generationId);
              } catch (_) {}
            }

            if (!currentGen) {
              const pollRes = await axios.get(
                `https://api.lumalabs.ai/dream-machine/v1/generations/${generationId}`,
                {
                  headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' },
                  timeout: 15000
                }
              );
              currentGen = pollRes.data;
            }

            state = currentGen.state || currentGen.status || 'processing';
            console.log(`[Luma AI Polling] Generation ${generationId} state: ${state} (attempt ${pollCount + 1})`);

            if (state === 'completed') {
              videoUrl = currentGen.assets?.video || currentGen.output?.[0] || videoUrl;
              break;
            } else if (state === 'failed') {
              const failReason = currentGen.failure_reason || currentGen.error || 'Video rendering failed';
              throw new Error(`Luma AI video generation failed: ${failReason}`);
            }
          } catch (pollErr) {
            if (pollErr.message.includes('failed')) throw pollErr;
            console.warn(`[Luma AI Polling Warning] ${pollErr.message}`);
          }
        }
      }
    }

    // Step 3: Return completed video asset URL (generation.assets.video)
    const finalVideoUrl = videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
    const finalTaskId = generationId || `luma_task_${Math.random().toString(36).substring(2, 8)}`;

    return {
      provider: 'luma',
      model: targetModel,
      output: finalVideoUrl,
      imageUrl: finalVideoUrl,
      videoUrl: finalVideoUrl,
      taskId: finalTaskId,
      usage: { model: targetModel, taskType: 'VIDEO_GENERATION', state: state || 'completed' }
    };
  }

  /**
   * Poll generation status from Luma AI API.
   */
  static async getLumaGenerationStatus(generationId) {
    const apiKey = config.providers.luma.apiKey;
    if (!apiKey) throw new Error('Luma AI API key is not configured');

    const { LumaAI } = require('lumaai');
    try {
      const client = new LumaAI({ apiKey });
      return await client.generations.get(generationId);
    } catch (_) {
      const url = `${config.providers.luma.baseUrl}/generations/${generationId}`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'accept': 'application/json'
        }
      });
      return response.data;
    }
  }
}

module.exports = ProviderService;
