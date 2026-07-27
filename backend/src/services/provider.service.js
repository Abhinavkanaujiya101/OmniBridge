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
        id: 'runway',
        name: 'Runway ML',
        models: ['gen-2', 'gen-3-alpha'],
        configured: Boolean(config.providers.runway.apiKey),
        defaultModel: 'gen-2'
      }
    ];
  }

  /**
   * Dispatch non-streaming completion request.
   */
  static async generateCompletion({ provider, model, prompt, temperature = 0.7 }) {
    try {
      switch (provider) {
        case 'gemini':
          return await this._callGemini(model || 'gemini-1.5-flash', prompt, temperature);
        case 'openai':
          return await this._callOpenAI(model || 'gpt-4o-mini', prompt, temperature);
        case 'together':
          return await this._callTogether(model || 'meta-llama/Llama-3-70b-chat-hf', prompt, temperature);
        case 'runway':
          return await this._callRunway(model || 'gen-2', prompt);
        default:
          throw new Error(`Unsupported AI Provider: ${provider}`);
      }
    } catch (err) {
      console.warn(`[ProviderService] ${provider}/${model} live call failed (${err.message}). Engaging Sandbox Fallback.`);
      return {
        provider,
        model: model || 'default',
        output: `OmniBridge Gateway Sandbox Output (${provider} / ${model})\n\nResponse to prompt: "${prompt}"\n\n*Note: To enable live API calls for ${provider}, populate your API key in backend/.env.*`,
        usage: { promptTokens: 20, completionTokens: 60, totalTokens: 80 }
      };
    }
  }

  static async _callGemini(model, prompt, temperature) {
    const apiKey = config.providers.gemini.apiKey;
    if (!apiKey) throw new Error('Gemini API key is not configured in backend environment.');

    const url = `${config.providers.gemini.baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    const response = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature }
    });

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return {
      provider: 'gemini',
      model,
      output: text,
      usage: response.data?.usageMetadata || null
    };
  }

  static async _callOpenAI(model, prompt, temperature) {
    const apiKey = config.providers.openai.apiKey;
    if (!apiKey) throw new Error('OpenAI API key is not configured in backend environment.');

    const url = `${config.providers.openai.baseUrl}/chat/completions`;
    const response = await axios.post(
      url,
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature
      },
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    return {
      provider: 'openai',
      model,
      output: response.data?.choices?.[0]?.message?.content || '',
      usage: response.data?.usage || null
    };
  }

  static async _callTogether(model, prompt, temperature) {
    const apiKey = config.providers.together.apiKey;
    if (!apiKey) throw new Error('Together AI API key is not configured in backend environment.');

    const url = `${config.providers.together.baseUrl}/chat/completions`;
    const response = await axios.post(
      url,
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature
      },
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    return {
      provider: 'together',
      model,
      output: response.data?.choices?.[0]?.message?.content || '',
      usage: response.data?.usage || null
    };
  }

  static async _callRunway(model, prompt) {
    const apiKey = config.providers.runway.apiKey;
    if (!apiKey) throw new Error('Runway API key is not configured in backend environment.');

    const url = `${config.providers.runway.baseUrl}/tasks`;
    const response = await axios.post(
      url,
      { taskType: 'gen2', text_prompt: prompt },
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    return {
      provider: 'runway',
      model,
      output: response.data?.id ? `Task Queued (ID: ${response.data.id})` : 'Task Created',
      taskId: response.data?.id || null
    };
  }
}

module.exports = ProviderService;
