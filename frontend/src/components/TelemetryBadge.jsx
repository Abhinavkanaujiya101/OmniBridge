'use client';

import React from 'react';
import { Cpu, Zap, DollarSign, Target, CheckCircle2, Award } from 'lucide-react';

const TASK_TYPE_STYLES = {
  TEXT: { bg: 'bg-sky-500/10 text-sky-400 border-sky-500/20', label: 'Text Processing' },
  MATH: { bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', label: 'Mathematical Reasoning' },
  CODE: { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Code Generation' },
  IMAGE_GENERATION: { bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20', label: 'Image Synthesis' },
  VIDEO_GENERATION: { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Generative Video' }
};

export default function TelemetryBadge({ telemetry = {} }) {
  const {
    taskType = 'TEXT',
    targetModel = 'gemini-1.5-flash',
    targetProvider = 'gemini',
    confidence = 0.95,
    classificationMethod = 'keyword',
    estimatedLatency = 800,
    actualLatencyMs = 0,
    costTier = 'low',
    capability = ''
  } = telemetry;

  const style = TASK_TYPE_STYLES[taskType] || TASK_TYPE_STYLES.TEXT;
  const confPercent = Math.round((confidence || 0.9) * 100);

  return (
    <div className="bg-dark-surface/90 border border-gray-800 rounded-xl p-3.5 my-3 text-xs space-y-2.5">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${style.bg}`}>
            {taskType}
          </span>
          <span className="text-gray-400 font-mono text-[11px]">
            Intent Classifier ({classificationMethod})
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-sky-500/10 text-sky-400 px-2.5 py-1 rounded-md border border-sky-500/20 font-mono">
          <Target className="w-3.5 h-3.5" />
          <span>{confPercent}% Match</span>
        </div>
      </div>

      {/* Grid Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
        {/* Model Selection */}
        <div className="bg-dark-base/80 p-2 rounded-lg border border-white/5 flex flex-col justify-center">
          <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
            <Cpu className="w-3 h-3 text-sky-400" /> Auto Model
          </span>
          <span className="text-gray-200 font-semibold truncate text-[11px] mt-0.5" title={targetModel}>
            {targetModel}
          </span>
          <span className="text-[9px] text-gray-400 uppercase tracking-wide">
            Provider: {targetProvider}
          </span>
        </div>

        {/* Latency Telemetry */}
        <div className="bg-dark-base/80 p-2 rounded-lg border border-white/5 flex flex-col justify-center">
          <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" /> Latency
          </span>
          <span className="text-amber-400 font-semibold text-[11px] mt-0.5">
            {actualLatencyMs ? `${actualLatencyMs} ms` : `~${estimatedLatency} ms`}
          </span>
          <span className="text-[9px] text-gray-400 uppercase tracking-wide">
            {actualLatencyMs ? 'Measured TTFT' : 'Estimated p50'}
          </span>
        </div>

        {/* Cost Efficiency */}
        <div className="bg-dark-base/80 p-2 rounded-lg border border-white/5 flex flex-col justify-center">
          <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-emerald-400" /> Cost Tier
          </span>
          <span className="text-emerald-400 font-semibold uppercase text-[11px] mt-0.5">
            {costTier}
          </span>
          <span className="text-[9px] text-gray-400 uppercase tracking-wide">
            Optimal Efficiency
          </span>
        </div>

        {/* Capability Reason */}
        <div className="bg-dark-base/80 p-2 rounded-lg border border-white/5 flex flex-col justify-center col-span-1 sm:col-span-1">
          <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
            <Award className="w-3 h-3 text-purple-400" /> Policy Rule
          </span>
          <span className="text-purple-300 truncate text-[10px] mt-0.5" title={capability || 'Rule matrix match'}>
            {capability ? capability.slice(0, 28) + '...' : 'Router matrix matched'}
          </span>
        </div>
      </div>
    </div>
  );
}
