'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Network, Cpu, Zap, Send, Sparkles, RefreshCw, Terminal,
  Sliders, ShieldCheck, Download, Code2, Film, Image as ImageIcon,
  Layers, Play, AlertCircle, CheckCircle, FileText, Square, Clock, Plus, History,
  PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { routePrompt, classifyPrompt, extractUrlFromText } from '../lib/api';
import ProviderSelector from '../components/ProviderSelector';
import TelemetryBadge from '../components/TelemetryBadge';
import CodeMarkdownCard from '../components/CodeMarkdownCard';
import MediaPreviewCard from '../components/MediaPreviewCard';
import ChatHistoryPanel from '../components/ChatHistoryPanel';

// Quick prompt presets to showcase multi-type dynamic routing
const PROMPT_PRESETS = [
  {
    label: '💻 Code Generation',
    prompt: 'Write a Python function to implement a binary search tree with insertion and traversal methods.',
    taskType: 'CODE'
  },
  {
    label: '🎨 Image Synthesis',
    prompt: 'Generate a photorealistic image of a futuristic neon cybernetic dragon perched on a skyscraper at dusk.',
    taskType: 'IMAGE_GENERATION'
  },
  {
    label: '📄 Document Generation',
    prompt: 'Write a comprehensive executive report on the impact of artificial intelligence in healthcare in 2026.',
    taskType: 'DOCUMENT_GENERATION'
  },
  {
    label: '🎬 Generative Video',
    prompt: 'Create a cinematic video of glowing ocean waves crashing on a black sand beach under moonlight.',
    taskType: 'VIDEO_GENERATION'
  }
];

export default function WorkspaceDashboard() {
  const [routingMode, setRoutingMode] = useState('auto'); // 'auto' (Intent Router) | 'manual'
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');
  const [temperature, setTemperature] = useState(0.7);
  const [streaming, setStreaming] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [activePresetMode, setActivePresetMode] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Messages state for current chat session
  const [messages, setMessages] = useState([]);

  // Chat History & Sessions State (Persisted in localStorage)
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);

  // Collapsible Left Sidebar State (Persisted in localStorage)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Load saved sidebar preference from localStorage on initial mount
  useEffect(() => {
    try {
      const savedSidebar = localStorage.getItem('omnibridge_sidebar_open');
      if (savedSidebar !== null) {
        setIsSidebarOpen(JSON.parse(savedSidebar));
      }
    } catch (err) {
      console.warn('Failed to load sidebar preference from localStorage:', err);
    }
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('omnibridge_sidebar_open', JSON.stringify(next));
      } catch (e) { }
      return next;
    });
  };

  // Telemetry metric state
  const [metrics, setMetrics] = useState({
    status: 'OPERATIONAL',
    provider: 'Gemini 1.5',
    model: 'gemini-1.5-flash',
    latency: 24,
    tokens: 420
  });

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Load saved chat sessions from localStorage on initial mount ───────────
  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem('omnibridge_sessions');
      const savedActiveId = localStorage.getItem('omnibridge_active_session_id');
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          const activeSess = parsed.find((s) => s.id === savedActiveId) || parsed[0];
          setActiveSessionId(activeSess.id);
          setMessages(activeSess.messages || []);
        }
      }
    } catch (err) {
      console.warn('Failed to load chat history from localStorage:', err);
    }
  }, []);

  // ── Auto-save current messages to active session in localStorage ──────────
  useEffect(() => {
    if (messages.length === 0) return;

    setSessions((prevSessions) => {
      let currentId = activeSessionId;
      let isNewSession = false;

      if (!currentId || !prevSessions.some((s) => s.id === currentId)) {
        currentId = `session_${Date.now()}`;
        setActiveSessionId(currentId);
        try {
          localStorage.setItem('omnibridge_active_session_id', currentId);
        } catch (e) { }
        isNewSession = true;
      }

      // Extract first user prompt text as session title
      const firstUserMsg = messages.find((m) => m.sender === 'user');
      const title = firstUserMsg
        ? firstUserMsg.text.slice(0, 30) + (firstUserMsg.text.length > 30 ? '...' : '')
        : 'New Session';

      let updated;
      if (isNewSession) {
        const newSession = {
          id: currentId,
          title,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages
        };
        updated = [newSession, ...prevSessions];
      } else {
        updated = prevSessions.map((s) =>
          s.id === currentId
            ? {
              ...s,
              title: s.title || title,
              updatedAt: Date.now(),
              messages
            }
            : s
        );
      }

      try {
        localStorage.setItem('omnibridge_sessions', JSON.stringify(updated));
      } catch (e) { }

      return updated;
    });
  }, [messages]);

  // ── Session Handlers ──────────────────────────────────────────────────────
  const handleSelectSession = (sessionId) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (target) {
      setActiveSessionId(sessionId);
      setMessages(target.messages || []);
      try {
        localStorage.setItem('omnibridge_active_session_id', sessionId);
      } catch (e) { }
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    try {
      localStorage.removeItem('omnibridge_active_session_id');
    } catch (e) { }
  };

  const handleDeleteSession = (sessionId) => {
    const updated = sessions.filter((s) => s.id !== sessionId);
    setSessions(updated);
    try {
      localStorage.setItem('omnibridge_sessions', JSON.stringify(updated));
    } catch (e) { }

    if (activeSessionId === sessionId) {
      handleNewChat();
    }
  };

  const handleClearAllHistory = () => {
    setSessions([]);
    setActiveSessionId(null);
    setMessages([]);
    try {
      localStorage.removeItem('omnibridge_sessions');
      localStorage.removeItem('omnibridge_active_session_id');
    } catch (e) { }
  };

  // Stop Execution action handler
  const handleStopExecution = () => {
    setIsSubmitting(false);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.loading
          ? {
            ...msg,
            loading: false,
            error: 'Execution stopped by user.'
          }
          : msg
      )
    );
  };

  // Dispatch prompt submission
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;

    const currentPrompt = prompt;
    const currentPresetMode = activePresetMode;
    setPrompt('');
    setActivePresetMode(null);
    setIsSubmitting(true);

    const messageId = Math.random().toString(36).substring(2, 9);
    const userMsg = { id: messageId, sender: 'user', text: currentPrompt, timestamp: new Date().toLocaleTimeString() };

    setMessages((prev) => [...prev, userMsg]);

    if (routingMode === 'auto') {
      // Step 1: Pre-classify intent for instant UI telemetry feedback
      const cls = await classifyPrompt(currentPrompt);

      const assistantMsgId = Math.random().toString(36).substring(2, 9);
      const initialAssistantMsg = {
        id: assistantMsgId,
        sender: 'assistant',
        loading: true,
        telemetry: {
          userPrompt: currentPrompt,
          presetMode: currentPresetMode,
          taskType: cls.taskType || 'TEXT',
          targetModel: cls.recommendedModel || 'gemini-1.5-flash',
          targetProvider: cls.recommendedProvider || 'gemini',
          confidence: cls.confidence || 0.95,
          classificationMethod: cls.classificationMethod || 'keyword',
          estimatedLatency: cls.estimatedLatency || 800,
          costTier: cls.costTier || 'low',
          capability: cls.capability || ''
        },
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages((prev) => [...prev, initialAssistantMsg]);

      // Dispatch via REST Intent Router pipeline
      const start = Date.now();
      const res = await routePrompt({ prompt: currentPrompt, temperature });
      const latencyMs = Date.now() - start;

      setIsSubmitting(false);

      if (res.success) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                ...msg,
                loading: false,
                output: res.output,
                telemetry: {
                  ...msg.telemetry,
                  taskType: res.isCapabilityMismatch ? 'TEXT' : res.taskType,
                  targetModel: res.targetModel,
                  targetProvider: res.targetProvider,
                  actualLatencyMs: res.actualLatencyMs || latencyMs,
                  confidence: res.confidence,
                  classificationMethod: res.classificationMethod,
                  isCapabilityMismatch: res.isCapabilityMismatch || false
                },
                imageUrl: res.imageUrl,
                taskId: res.taskId
              }
              : msg
          )
        );

        setMetrics((prev) => ({
          ...prev,
          provider: res.targetProvider,
          model: res.targetModel,
          latency: res.actualLatencyMs || latencyMs
        }));
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                ...msg,
                loading: false,
                isRateLimited: res.isRateLimited || false,
                error: res.error || 'Router dispatch failed',
                output: res.output || null
              }
              : msg
          )
        );
      }
    } else {
      // Manual provider mode
      const assistantMsgId = Math.random().toString(36).substring(2, 9);
      const initialAssistantMsg = {
        id: assistantMsgId,
        sender: 'assistant',
        loading: true,
        telemetry: {
          taskType: 'TEXT',
          targetModel: selectedModel,
          targetProvider: selectedProvider,
          confidence: 1.0,
          classificationMethod: 'manual-override',
          costTier: 'fixed',
          capability: `${selectedProvider}/${selectedModel}`
        },
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages((prev) => [...prev, initialAssistantMsg]);

      const start = Date.now();
      try {
        const { generateCompletion } = await import('../lib/api');
        const res = await generateCompletion({ provider: selectedProvider, model: selectedModel, prompt: currentPrompt, temperature });
        const latencyMs = Date.now() - start;

        setIsSubmitting(false);

        if (res.success && res.data) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                  ...msg,
                  loading: false,
                  output: res.data.output || 'No output received from provider.',
                  telemetry: {
                    ...msg.telemetry,
                    actualLatencyMs: res.latencyMs || latencyMs,
                    isCapabilityMismatch: res.data.isCapabilityMismatch || false,
                    isRateLimited: res.data.isRateLimited || false,
                    taskType: res.data.isCapabilityMismatch ? 'TEXT' : msg.telemetry?.taskType
                  }
                }
                : msg
            )
          );

          setMetrics((prev) => ({
            ...prev,
            provider: selectedProvider,
            model: selectedModel,
            latency: res.latencyMs || latencyMs
          }));
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                  ...msg,
                  loading: false,
                  isRateLimited: res.data?.isRateLimited || (res.error && res.error.includes('429')) || false,
                  error: res.error || 'Manual completion request failed'
                }
                : msg
            )
          );
        }
      } catch (err) {
        setIsSubmitting(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                ...msg,
                loading: false,
                error: err.message || 'Gateway network error'
              }
              : msg
          )
        );
      }
    }
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-2.5">
      {/* 1. Header & Platform Controls */}
      <header className="flex-none flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          {/* Sidebar Toggle Button */}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-xl bg-dark-surface hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-sky-400 transition-all shadow-md group shrink-0"
            title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            aria-label={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-5 h-5 text-gray-400 group-hover:text-sky-400 transition-colors" />
            ) : (
              <PanelLeftOpen className="w-5 h-5 text-sky-400 group-hover:text-sky-300 transition-colors" />
            )}
          </button>

          <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-sky-500/20">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2 font-sans">
              OmniBridge <span className="text-xs px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono font-normal">v1.0 Engine</span>
            </h1>
            <p className="text-[11px] text-gray-400 font-sans">
              Intelligent Multi-Provider AI Gateway & Intent Router
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Toggle Advanced Provider Controls */}
          <button
            onClick={() => setRoutingMode((prev) => (prev === 'auto' ? 'manual' : 'auto'))}
            className="text-xs px-2.5 py-1 rounded-lg bg-dark-surface border border-gray-800 text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1.5 font-sans"
            title="Toggle Advanced Provider Controls"
          >
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            <span>{routingMode === 'manual' ? 'Hide Controls' : 'Advanced Mode'}</span>
          </button>
        </div>
      </header>

      {/* 2. Control Bar (Preset Action Chips & Optional Provider Controls) */}
      <div className="flex-none space-y-2 pb-2 border-b border-gray-800/80">
        {/* Manual Provider Selector (shown only when Advanced Mode is enabled) */}
        {routingMode === 'manual' && (
          <ProviderSelector
            selectedProvider={selectedProvider}
            setSelectedProvider={setSelectedProvider}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            temperature={temperature}
            setTemperature={setTemperature}
            streaming={streaming}
            setStreaming={setStreaming}
          />
        )}

        {/* Action Preset Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          {PROMPT_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setPrompt(preset.prompt);
                setActivePresetMode(preset.taskType);
              }}
              className="shrink-0 text-xs px-3.5 py-1.5 rounded-lg bg-dark-surface/90 hover:bg-dark-surface border border-gray-800 text-gray-200 hover:border-gray-700 transition-all flex items-center gap-1.5 font-sans"
            >
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Dashboard Body: Collapsible Left Sidebar (Chat History) + Right Execution Canvas */}
      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden relative">

        {/* Left Sidebar Column (Chat History Panel) */}
        <div
          className={`h-full min-h-0 overflow-hidden transition-all duration-300 ease-in-out shrink-0 ${isSidebarOpen ? 'w-full lg:w-1/4 opacity-100' : 'w-0 opacity-0 pointer-events-none'
            }`}
        >
          <ChatHistoryPanel
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={handleSelectSession}
            onNewChat={handleNewChat}
            onDeleteSession={handleDeleteSession}
            onClearAllHistory={handleClearAllHistory}
          />
        </div>

        {/* Right Main Execution Area: AI Response Workspace Terminal */}
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden transition-all duration-300 ease-in-out">
          <div className="glass-panel rounded-xl border border-gray-800 flex flex-col h-full min-h-0 overflow-hidden">

            {/* Workspace Header Bar */}
            <div className="flex-none bg-dark-surface/80 px-4 py-2 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-sans text-gray-200 font-semibold flex items-center gap-1">
                  <span>AI Workspace</span>
                </span>
              </div>
              <button
                onClick={handleNewChat}
                className="text-xs px-2.5 py-1 rounded-lg bg-dark-base hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-700/60 transition-colors flex items-center gap-1.5 font-sans"
              >
                <Plus className="w-3.5 h-3.5 text-sky-400" />
                <span> New Chat</span>
              </button>
            </div>

            {/* Chat Message Stream */}
            <div className="flex-1 min-h-0 p-4 overflow-y-auto space-y-4 bg-dark-base/90">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  {/* Ultra-Minimal Centered OmniBridge Logo & Title */}
                  <div className="flex flex-col items-center space-y-3">
                    <div className="p-4 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 text-white shadow-xl shadow-sky-500/25 border border-sky-400/30">
                      <Network className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-white font-sans flex items-center justify-center gap-2">
                      OmniBridge <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">AI</span>
                    </h2>
                    <p className="text-sm text-gray-400 max-w-md font-sans flex items-center justify-center gap-1.5">
                      <span>What would you like to explore today?</span> 🚀
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="space-y-2">
                    {msg.sender === 'user' ? (
                      /* User Message Bubble */
                      <div className="flex justify-end">
                        <div className="bg-sky-600/20 border border-sky-500/30 text-sky-100 rounded-xl px-4 py-3 max-w-xl text-sm font-sans">
                          {msg.text}
                          <div className="text-[10px] font-sans text-sky-400/70 text-right mt-1">
                            {msg.timestamp}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Assistant Response Card */
                      <div className="bg-dark-surface/70 border border-gray-800 rounded-xl p-4 space-y-3">
                        {/* Render Output based on Task Type */}
                        {msg.loading ? (
                          <div className="flex items-center gap-2.5 text-xs font-sans text-sky-400 py-3">
                            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                            <span>
                              {msg.telemetry?.targetProvider === 'luma' || msg.telemetry?.taskType === 'VIDEO_GENERATION'
                                ? '🎬 Generating video...'
                                : msg.telemetry?.taskType === 'IMAGE_GENERATION'
                                  ? '🎨 Creating image...'
                                  : '🤖 Thinking...'}
                            </span>
                          </div>
                        ) : (msg.isRateLimited || msg.telemetry?.isRateLimited || (msg.error && (msg.error.includes('429') || msg.error.toLowerCase().includes('rate')))) ? (
                          <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-xl space-y-2 text-xs font-sans">
                            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                              <AlertCircle className="w-4 h-4 text-amber-400" />
                              <span>Service Temporarily Rate-Limited (HTTP 429)</span>
                            </div>
                            <p className="text-gray-300 text-xs">
                              All available AI provider endpoints are currently experiencing high request volumes or rate limits.
                            </p>
                            <p className="text-amber-300/80 text-[11px] font-mono">
                              💡 Tip: Wait a few seconds before resubmitting your prompt, or switch provider routing modes.
                            </p>
                          </div>
                        ) : msg.error ? (
                          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-mono">
                            ⚠️ {msg.error}
                          </div>
                        ) : (
                          <>
                            {msg.telemetry && <TelemetryBadge telemetry={msg.telemetry} />}
                            {!msg.telemetry?.isCapabilityMismatch && (msg.telemetry?.taskType === 'IMAGE_GENERATION' || msg.telemetry?.taskType === 'VIDEO_GENERATION') ? (
                              <MediaPreviewCard
                                taskType={msg.telemetry.taskType}
                                output={msg.output}
                                imageUrl={msg.imageUrl}
                                taskId={msg.taskId}
                                provider={msg.telemetry.targetProvider}
                                model={msg.telemetry.targetModel}
                              />
                            ) : (
                              <CodeMarkdownCard
                                rawOutput={msg.output}
                                taskId={msg.taskId}
                                language={msg.telemetry?.language}
                                outputType={msg.telemetry?.outputType}
                                taskType={msg.telemetry?.taskType}
                                telemetry={msg.telemetry}
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="flex-none p-3 bg-dark-surface/50 border-t border-gray-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="💬 Ask a question, 💻 write code, 🎨 create an image, or 🎬 generate a video..."
                  className="flex-1 bg-dark-base border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-sky-500 font-sans"
                />
                {isSubmitting ? (
                  <button
                    type="button"
                    onClick={handleStopExecution}
                    className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-400 font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm transition-all duration-200 shadow-lg shadow-red-600/10 animate-pulse shrink-0 font-sans"
                  >
                    <Square className="w-3.5 h-3.5 fill-red-400" />
                    <span> Stop</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!prompt.trim()}
                    className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm transition-all duration-200 shadow-lg shadow-sky-600/20 shrink-0 font-sans"
                  >
                    <Send className="w-4 h-4" />
                    <span>🚀 Send</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
