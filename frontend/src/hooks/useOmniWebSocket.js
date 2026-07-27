'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { WS_BASE_URL } from '../lib/api';

/**
 * Custom React Hook for OmniBridge Real-Time WebSocket Pipeline
 *
 * Manages WebSocket state, token streams, and background task events
 * (QUEUED -> PROCESSING -> PARSING -> COMPLETED -> FAILED) without full-page re-renders.
 */
export function useOmniWebSocket() {
  const [status, setStatus] = useState('DISCONNECTED'); // CONNECTING | CONNECTED | READY | DISCONNECTED | ERROR
  const [activeTaskMap, setActiveTaskMap] = useState({}); // taskId -> TaskState object
  const [eventLogs, setEventLogs] = useState([]); // List of recent raw WS events
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Helper to add event log
  const pushLog = useCallback((level, message, data = {}) => {
    const timestamp = new Date().toLocaleTimeString();
    setEventLogs((prev) => [
      ...prev.slice(-99),
      { id: Math.random().toString(36).substring(2, 9), level, message, data, timestamp }
    ]);
  }, []);

  // Initialize WebSocket connection
  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setStatus('CONNECTING');
    try {
      const ws = new WebSocket(WS_BASE_URL);

      ws.onopen = () => {
        setStatus('CONNECTED');
        pushLog('SYSTEM', 'WebSocket connection established');
      };

      ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          handleIncomingPacket(packet);
        } catch (err) {
          pushLog('WARN', 'Unparsed WebSocket frame', { raw: event.data });
        }
      };

      ws.onerror = (err) => {
        setStatus('ERROR');
        pushLog('ERROR', 'WebSocket pipeline error', { error: err.message || 'Connection failed' });
      };

      ws.onclose = () => {
        setStatus('DISCONNECTED');
        pushLog('SYSTEM', 'WebSocket connection closed');
        wsRef.current = null;
        
        // Auto reconnect after 4s
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 4000);
      };

      wsRef.current = ws;
    } catch (err) {
      setStatus('ERROR');
      pushLog('ERROR', 'Failed to instantiate WebSocket', { message: err.message });
    }
  }, [pushLog]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Handle incoming WS frames
  const handleIncomingPacket = useCallback((packet) => {
    const { type, event: taskEvent, taskId, taskType, status: taskStatus, progress, result, error, token } = packet;

    switch (type) {
      case 'CONNECTED':
        setStatus('READY');
        pushLog('INFO', packet.message || 'Gateway pipeline ready');
        break;

      case 'PONG':
        pushLog('DEBUG', 'PONG packet received');
        break;

      case 'TASK_ACCEPTED':
        pushLog('INFO', `Task ${taskId.slice(0, 8)} queued`, { taskId, taskType });
        setActiveTaskMap((prev) => ({
          ...prev,
          [taskId]: {
            id: taskId,
            taskType,
            status: 'QUEUED',
            progress: 5,
            message: packet.message,
            createdAt: Date.now()
          }
        }));
        break;

      case 'TASK_EVENT':
        pushLog(taskEvent === 'FAILED' ? 'ERROR' : 'EVENT', `Task ${taskId.slice(0, 8)} -> ${taskEvent}`, {
          taskId,
          taskStatus,
          progress
        });

        setActiveTaskMap((prev) => {
          const existing = prev[taskId] || { id: taskId, taskType };
          return {
            ...prev,
            [taskId]: {
              ...existing,
              status: taskStatus || existing.status,
              progress: progress !== undefined ? progress : existing.progress,
              message: packet.message || existing.message,
              result: result || existing.result,
              error: error || existing.error,
              updatedAt: Date.now()
            }
          };
        });
        break;

      case 'STREAM_START':
        setIsStreaming(true);
        setStreamingContent('');
        pushLog('INFO', `Stream started (${packet.provider || 'AI'})`);
        break;

      case 'TOKEN':
        if (token) {
          setStreamingContent((prev) => prev + token);
        }
        break;

      case 'STREAM_END':
        setIsStreaming(false);
        pushLog('SUCCESS', `Stream finished for ${packet.provider || 'AI'}`);
        break;

      case 'ERROR':
        setIsStreaming(false);
        pushLog('ERROR', packet.message || 'Gateway error packet', { error });
        break;

      default:
        break;
    }
  }, [pushLog]);

  // Send JSON message over WS
  const sendAction = useCallback((action, data = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = { action, requestId: Math.random().toString(36).substring(2, 9), ...data };
      wsRef.current.send(JSON.stringify(payload));
      return payload.requestId;
    } else {
      pushLog('WARN', `Cannot send action '${action}': WebSocket is not OPEN`);
      return null;
    }
  }, [pushLog]);

  // Higher level helpers
  const submitAsyncTask = useCallback(({ prompt, temperature = 0.7, preferHighQuality = false, outputFormat = 'json' }) => {
    return sendAction('submit_task', { prompt, temperature, preferHighQuality, outputFormat });
  }, [sendAction]);

  const startTokenStream = useCallback(({ prompt, provider, model, temperature = 0.7, useRouter = true }) => {
    setStreamingContent('');
    setIsStreaming(true);
    return sendAction('stream_prompt', { prompt, provider, model, temperature, useRouter });
  }, [sendAction]);

  const subscribeToTask = useCallback((taskId) => {
    return sendAction('subscribe_task', { taskId });
  }, [sendAction]);

  const stopStream = useCallback(() => {
    setIsStreaming(false);
    pushLog('WARN', 'Stream execution aborted by user');
  }, [pushLog]);

  const clearLogs = useCallback(() => {
    setEventLogs([]);
  }, []);

  return {
    status,
    activeTaskMap,
    eventLogs,
    streamingContent,
    isStreaming,
    sendAction,
    submitAsyncTask,
    startTokenStream,
    subscribeToTask,
    stopStream,
    clearLogs
  };
}
