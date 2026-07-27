'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Terminal, RefreshCw, Radio, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import { generateCompletion, createWebSocketStream } from '../lib/api';

export default function GatewayConsole({
  selectedProvider,
  selectedModel,
  temperature,
  streaming,
  onMetricsUpdate
}) {
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('DISCONNECTED');
  const wsRef = useRef(null);
  const outputEndRef = useRef(null);

  // Initialize WebSocket connection when in streaming mode
  useEffect(() => {
    if (streaming) {
      const socket = createWebSocketStream({
        onOpen: () => {
          setConnectionStatus('CONNECTED');
          addLog('SYSTEM', 'WebSocket Gateway connected on ws://localhost:5001');
        },
        onMessage: (packet) => {
          if (packet.type === 'CONNECTED') {
            setConnectionStatus('READY');
          } else if (packet.type === 'TOKEN') {
            setOutput((prev) => prev + (packet.token || ''));
          } else if (packet.type === 'STREAM_END') {
            setLoading(false);
            addLog('SUCCESS', `Stream finished for ${packet.provider}`);
            if (onMetricsUpdate) {
              onMetricsUpdate({
                provider: packet.provider,
                status: 'IDLE',
                tokens: Math.floor(Math.random() * 200 + 80)
              });
            }
          } else if (packet.type === 'ERROR') {
            setLoading(false);
            addLog('ERROR', packet.message || 'Stream error');
          }
        },
        onError: (err) => {
          setConnectionStatus('ERROR');
          addLog('ERROR', 'WebSocket connection error');
        },
        onClose: () => {
          setConnectionStatus('DISCONNECTED');
          addLog('SYSTEM', 'WebSocket stream closed');
        }
      });

      wsRef.current = socket;
      return () => {
        if (wsRef.current) wsRef.current.close();
      };
    } else {
      setConnectionStatus('REST_MODE');
    }
  }, [streaming]);

  const addLog = (level, message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-49), { level, message, timestamp }]);
  };

  const handleDispatch = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setOutput('');
    setLoading(true);
    const startTime = Date.now();

    addLog('INFO', `Dispatching request to ${selectedProvider} (${selectedModel})`);

    if (streaming && wsRef.current) {
      wsRef.current.send({
        action: 'stream_prompt',
        provider: selectedProvider,
        model: selectedModel,
        prompt,
        temperature
      });
    } else {
      // Synchronous REST API Fallback
      try {
        const res = await generateCompletion({
          provider: selectedProvider,
          model: selectedModel,
          prompt,
          temperature
        });

        const latencyMs = Date.now() - startTime;

        if (res.success) {
          setOutput(res.data?.output || 'No response data');
          addLog('SUCCESS', `Completed in ${latencyMs}ms`);
          if (onMetricsUpdate) {
            onMetricsUpdate({
              provider: selectedProvider,
              model: selectedModel,
              latency: latencyMs,
              tokens: (res.data?.output || '').length
            });
          }
        } else {
          setOutput(`Error: ${res.error}`);
          addLog('ERROR', res.error);
        }
      } catch (err) {
        setOutput(`Gateway Request Failed: ${err.message}`);
        addLog('ERROR', err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left 2 Cols: Prompt & Stream Output Terminal */}
      <div className="lg:col-span-2 space-y-4">
        {/* Terminal Header */}
        <div className="glass-panel rounded-xl overflow-hidden border border-gray-800">
          <div className="bg-dark-surface/80 px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-mono text-gray-300 font-semibold">
                OmniBridge Stream Terminal
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    connectionStatus === 'READY' || connectionStatus === 'REST_MODE'
                      ? 'bg-emerald-400'
                      : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    connectionStatus === 'READY' || connectionStatus === 'REST_MODE'
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                  }`}
                />
              </span>
              <span className="text-[11px] font-mono uppercase text-gray-400">
                {connectionStatus}
              </span>
            </div>
          </div>

          {/* Terminal Output Display */}
          <div className="p-5 font-mono text-sm bg-dark-base/90 min-h-[300px] max-h-[420px] overflow-y-auto text-gray-200 leading-relaxed leading-7">
            {output ? (
              <div className={loading ? 'typing-cursor' : ''}>
                {output}
              </div>
            ) : (
              <div className="text-gray-600 italic select-none py-12 text-center">
                Send a prompt to initialize real-time model token streaming...
              </div>
            )}
            <div ref={outputEndRef} />
          </div>

          {/* Prompt Form */}
          <form onSubmit={handleDispatch} className="p-3 bg-dark-surface/50 border-t border-gray-800/80">
            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`Ask ${selectedProvider} (${selectedModel})...`}
                className="flex-1 bg-dark-base border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-sky-500 font-mono"
              />
              <button
                type="submit"
                disabled={loading || !prompt.trim()}
                className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm transition-all duration-200 shadow-lg shadow-sky-600/20"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Dispatch</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Col: Server Event Telemetry Log */}
      <div className="glass-panel rounded-xl p-4 border border-gray-800 flex flex-col h-full max-h-[520px]">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-purple-400 animate-pulse" />
            <h3 className="text-xs font-semibold uppercase text-gray-300 tracking-wider">
              Gateway Packet Log
            </h3>
          </div>
          <button
            onClick={() => setLogs([])}
            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            Clear
          </button>
        </div>

        <div className="flex-1 overflow-y-auto font-mono text-xs space-y-2 pr-1">
          {logs.length === 0 ? (
            <div className="text-gray-600 italic py-8 text-center">
              No packet events recorded.
            </div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className="p-2 rounded bg-dark-surface/60 border border-white/5 flex flex-col gap-0.5"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span
                    className={`font-semibold ${
                      log.level === 'ERROR'
                        ? 'text-red-400'
                        : log.level === 'SUCCESS'
                        ? 'text-emerald-400'
                        : 'text-sky-400'
                    }`}
                  >
                    [{log.level}]
                  </span>
                  <span className="text-gray-500">{log.timestamp}</span>
                </div>
                <span className="text-gray-300 break-all">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
