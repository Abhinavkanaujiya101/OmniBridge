'use client';

import React from 'react';
import { Sliders, Sparkles, Layers, Thermometer, Radio } from 'lucide-react';

const PROVIDER_OPTIONS = [
  {
    id: 'gemini',
    name: '✨ Gemini',
    fullName: 'Google Gemini',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro'],
    badge: 'Fast',
    activeClass: 'bg-sky-600/30 border-sky-500/50 text-sky-200'
  },
  {
    id: 'openai',
    name: '🧠 OpenAI',
    fullName: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o'],
    badge: 'GPT-4o',
    activeClass: 'bg-emerald-600/30 border-emerald-500/50 text-emerald-200'
  },
  {
    id: 'together',
    name: '🦙 Together',
    fullName: 'Together AI',
    models: ['meta-llama/Llama-3-70b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
    badge: 'Llama-3',
    activeClass: 'bg-purple-600/30 border-purple-500/50 text-purple-200'
  },
  {
    id: 'luma',
    name: '🎬 Luma',
    fullName: 'Luma Dream Machine',
    models: ['dream-machine', 'ray-1', 'ray-2'],
    badge: 'Video',
    activeClass: 'bg-amber-600/30 border-amber-500/50 text-amber-200'
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
  const currentObj = PROVIDER_OPTIONS.find((p) => p.id === selectedProvider) || PROVIDER_OPTIONS[0];

  return (
    <div className="glass-panel rounded-xl p-2.5 border border-gray-800/90 flex flex-wrap items-center justify-between gap-3 text-xs">
      {/* 1. Compact Provider Selector Tabs */}
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400 font-mono text-[11px] font-semibold flex items-center gap-1 mr-1">
          <Sliders className="w-3.5 h-3.5 text-sky-400" /> 🎛️ Provider:
        </span>
        <div className="bg-dark-base p-1 rounded-lg border border-gray-800/80 flex items-center gap-1">
          {PROVIDER_OPTIONS.map((provider) => {
            const isSelected = selectedProvider === provider.id;
            return (
              <button
                key={provider.id}
                onClick={() => {
                  setSelectedProvider(provider.id);
                  setSelectedModel(provider.models[0]);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 font-mono border ${
                  isSelected
                    ? provider.activeClass
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                <span>{provider.name}</span>
                {isSelected && <Sparkles className="w-3 h-3 text-sky-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Model Variant Dropdown & Temp Slider & Streaming Toggle in single row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Model Variant */}
        <div className="flex items-center gap-1.5 font-mono">
          <span className="text-gray-400 text-[11px]">🤖 Model:</span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-dark-base border border-gray-800 rounded-md px-2.5 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-sky-500"
          >
            {currentObj.models.map((mod) => (
              <option key={mod} value={mod}>
                {mod}
              </option>
            ))}
          </select>
        </div>

        {/* Temperature Slider */}
        <div className="flex items-center gap-2 font-mono">
          <span className="text-gray-400 text-[11px] flex items-center gap-1">
            <Thermometer className="w-3 h-3 text-amber-400" /> 🌡️ Temp:
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-20 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
          <span className="text-sky-400 text-[11px] font-bold min-w-[24px]">{temperature}</span>
        </div>

        {/* Streaming Mode Toggle */}
        <div className="flex items-center gap-2 font-mono">
          <span className="text-gray-400 text-[11px]">⚡ Stream:</span>
          <button
            onClick={() => setStreaming(!streaming)}
            className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors ${
              streaming ? 'bg-sky-500' : 'bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                streaming ? 'translate-x-4' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
