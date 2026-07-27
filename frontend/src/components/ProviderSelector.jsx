'use client';

import React from 'react';
import { Sliders, Sparkles, Layers } from 'lucide-react';

const PROVIDER_OPTIONS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro'],
    badge: 'Fast & Multimodal',
    color: 'from-blue-500/20 to-sky-500/20 border-sky-500/30'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o'],
    badge: 'Reasoning Leader',
    color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30'
  },
  {
    id: 'together',
    name: 'Together AI',
    models: ['meta-llama/Llama-3-70b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
    badge: 'Open Source Cluster',
    color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30'
  },
  {
    id: 'runway',
    name: 'Runway ML',
    models: ['gen-2', 'gen-3-alpha'],
    badge: 'Generative Video',
    color: 'from-amber-500/20 to-orange-500/20 border-amber-500/30'
  }
];

export default function ProviderSelector({
  selectedProvider,
  setSelectedProvider,
  selectedModel,
  setSelectedModel,
  temperature,
  setTemperature,
  streaming,
  setStreaming
}) {
  const currentObj = PROVIDER_OPTIONS.find(p => p.id === selectedProvider) || PROVIDER_OPTIONS[0];

  return (
    <div className="glass-panel rounded-xl p-5 mb-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
            Gateway Orchestrator & Model Routing
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Streaming Mode</span>
          <button
            onClick={() => setStreaming(!streaming)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              streaming ? 'bg-sky-500' : 'bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                streaming ? 'translate-x-4.5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Provider Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {PROVIDER_OPTIONS.map((provider) => {
          const isSelected = selectedProvider === provider.id;
          return (
            <button
              key={provider.id}
              onClick={() => {
                setSelectedProvider(provider.id);
                setSelectedModel(provider.models[0]);
              }}
              className={`text-left p-3.5 rounded-lg border transition-all duration-200 relative overflow-hidden ${
                isSelected
                  ? `bg-gradient-to-br ${provider.color} text-white shadow-lg`
                  : 'bg-dark-surface/40 border-gray-800 hover:border-gray-700 text-gray-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm">{provider.name}</span>
                {isSelected && <Sparkles className="w-3.5 h-3.5 text-sky-400" />}
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-gray-900/60 border border-white/10 text-gray-300">
                {provider.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Model & Parameters Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-gray-800/60">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5 font-medium flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-gray-400" /> Model Variant
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full bg-dark-base border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-sky-500"
          >
            {currentObj.models.map((mod) => (
              <option key={mod} value={mod}>
                {mod}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1.5 font-medium">
            <span>Temperature (Sampling Creativity)</span>
            <span className="font-mono text-sky-400">{temperature}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
        </div>
      </div>
    </div>
  );
}
