import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Fetch list of active AI providers from gateway backend.
 */
export async function getProviders() {
  try {
    const res = await apiClient.get('/gateway/providers');
    return res.data;
  } catch (err) {
    console.error('Failed to fetch providers:', err);
    return { success: false, providers: [] };
  }
}

/**
 * Perform a synchronous completion call via manual provider selection.
 */
export async function generateCompletion(payload) {
  const res = await apiClient.post('/gateway/completion', payload);
  return res.data;
}

/**
 * Classify prompt intent via Intent Router engine without executing API call.
 */
export async function classifyPrompt(prompt) {
  try {
    const res = await apiClient.post('/router/classify', { prompt });
    return res.data;
  } catch (err) {
    return { success: false, error: err.response?.data?.error || err.message };
  }
}

/**
 * Dispatch prompt to Dynamic Intent Router for auto model selection & completion.
 */
export async function routePrompt(payload) {
  try {
    const res = await apiClient.post('/router/route', payload);
    return res.data;
  } catch (err) {
    return { success: false, error: err.response?.data?.error || err.message };
  }
}

/**
 * Dry run prompt routing to preview model selection and estimated latency.
 */
export async function dryRunPrompt(payload) {
  try {
    const res = await apiClient.post('/router/dry-run', payload);
    return res.data;
  } catch (err) {
    return { success: false, error: err.response?.data?.error || err.message };
  }
}

/**
 * Fetch the cost/performance routing rule matrix.
 */
export async function getRoutingMatrix() {
  try {
    const res = await apiClient.get('/router/matrix');
    return res.data;
  } catch (err) {
    return { success: false, matrix: {} };
  }
}

/**
 * Construct downloadable export stream URLs.
 */
export function getExportUrl(format, taskId, extraParams = {}) {
  const base = `${API_BASE_URL}/export/${format}?taskId=${taskId}`;
  const query = Object.entries(extraParams)
    .map(([k, v]) => `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('');
  return `${base}${query}`;
}

/**
 * Create low-level WebSocket connection.
 */
export function createWebSocketStream({ onMessage, onError, onOpen, onClose }) {
  let ws = null;
  try {
    ws = new WebSocket(WS_BASE_URL);

    ws.onopen = (event) => {
      if (onOpen) onOpen(event);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onMessage) onMessage(data);
      } catch (err) {
        if (onMessage) onMessage({ type: 'RAW', content: event.data });
      }
    };

    ws.onerror = (err) => {
      if (onError) onError(err);
    };

    ws.onclose = (event) => {
      if (onClose) onClose(event);
    };
  } catch (err) {
    if (onError) onError(err);
  }

  return {
    send: (msg) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    },
    close: () => {
      if (ws) ws.close();
    }
  };
}
