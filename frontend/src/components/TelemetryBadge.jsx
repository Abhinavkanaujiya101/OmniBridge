'use client';

import React from 'react';
import { Cpu } from 'lucide-react';

const TASK_TYPE_STYLES = {
  TEXT: { bg: 'bg-sky-500/10 text-sky-400 border-sky-500/20', label: 'Text Processing' },
  DOCUMENT_GENERATION: { bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', label: 'Document Generation' },
  CODE: { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Code Generation' },
  IMAGE_GENERATION: { bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20', label: 'Image Synthesis' },
  VIDEO_GENERATION: { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Generative Video' }
};

export default function TelemetryBadge({ telemetry = {} }) {
  const {
    taskType = 'TEXT',
    targetModel = 'qwen/qwen3.8-27b',
    targetProvider = 'groq'
  } = telemetry;

  const style = TASK_TYPE_STYLES[taskType] || TASK_TYPE_STYLES.TEXT;

  return (
    <div className="bg-dark-surface/90 border border-gray-800 rounded-xl p-3 my-2 text-xs space-y-2">
      {/* Top Header Row */}
      <div className="flex items-center justify-between border-b border-gray-800/80 pb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${style.bg}`}>
            {taskType}
          </span>
        </div>
      </div>

      {/* Grid Badges */}
      <div className="grid grid-cols-1 gap-2 font-mono">
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
      </div>
    </div>
  );
}

