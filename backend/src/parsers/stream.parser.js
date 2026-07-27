/**
 * Server Stream Parsing Utilities for Multi-Provider AI Gateway
 * Normalizes vendor-specific chunk formats (Gemini, OpenAI, Together AI) into unified gateway packets.
 */

/**
 * Parse an incoming SSE (Server-Sent Events) chunk line or raw buffer.
 * @param {string} rawChunk - Raw string chunk from HTTP/SSE stream
 * @param {string} provider - Vendor identifier: 'gemini' | 'openai' | 'together' | 'runway'
 * @returns {Array<Object>} List of normalized token payloads
 */
function parseStreamChunk(rawChunk, provider = 'openai') {
  if (!rawChunk || typeof rawChunk !== 'string') return [];

  const lines = rawChunk
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const parsedPackets = [];

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const dataStr = line.replace('data: ', '').trim();
      
      if (dataStr === '[DONE]') {
        parsedPackets.push({
          type: 'DONE',
          provider,
          timestamp: new Date().toISOString()
        });
        continue;
      }

      try {
        const json = JSON.parse(dataStr);
        const normalized = extractTokenByProvider(json, provider);
        if (normalized) {
          parsedPackets.push(normalized);
        }
      } catch (err) {
        // Fallback for non-JSON SSE strings
        parsedPackets.push({
          type: 'TEXT_CHUNK',
          provider,
          content: dataStr,
          timestamp: new Date().toISOString()
        });
      }
    } else if (line.startsWith('{') && line.endsWith('}')) {
      // Direct JSON chunk line
      try {
        const json = JSON.parse(line);
        const normalized = extractTokenByProvider(json, provider);
        if (normalized) {
          parsedPackets.push(normalized);
        }
      } catch (e) {
        // Ignore parse error
      }
    }
  }

  return parsedPackets;
}

/**
 * Normalizes vendor-specific JSON payload structures.
 */
function extractTokenByProvider(json, provider) {
  const timestamp = new Date().toISOString();

  switch (provider.toLowerCase()) {
    case 'gemini': {
      // Gemini response chunk structure: candidates[0].content.parts[0].text
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const finishReason = json?.candidates?.[0]?.finishReason || null;
      return {
        type: finishReason ? 'DONE' : 'TOKEN',
        provider: 'gemini',
        token: text,
        finishReason,
        timestamp
      };
    }

    case 'together':
    case 'openai': {
      // OpenAI/Together chunk structure: choices[0].delta.content
      const delta = json?.choices?.[0]?.delta;
      const text = delta?.content || '';
      const finishReason = json?.choices?.[0]?.finish_reason || null;
      return {
        type: finishReason ? 'DONE' : 'TOKEN',
        provider,
        token: text,
        finishReason,
        usage: json?.usage || null,
        timestamp
      };
    }

    case 'runway': {
      // Runway ML job status update packet
      return {
        type: 'STATUS_UPDATE',
        provider: 'runway',
        status: json?.status || 'PROCESSING',
        progress: json?.progress || 0,
        outputUrl: json?.output?.[0] || null,
        timestamp
      };
    }

    default:
      return {
        type: 'TOKEN',
        provider,
        token: JSON.stringify(json),
        timestamp
      };
  }
}

/**
 * Format outbound WebSocket frame for client frontend.
 */
function formatGatewayPacket(payload) {
  return JSON.stringify({
    gateway: 'OmniBridge',
    version: '1.0.0',
    ...payload
  });
}

module.exports = {
  parseStreamChunk,
  extractTokenByProvider,
  formatGatewayPacket
};
