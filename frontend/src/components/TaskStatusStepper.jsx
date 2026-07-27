'use client';

import React from 'react';
import { Clock, Cpu, FileCheck, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

const STAGES = [
  { id: 'QUEUED', label: 'Queued', icon: Clock },
  { id: 'PROCESSING', label: 'Processing', icon: Cpu },
  { id: 'PARSING', label: 'Parsing', icon: FileCheck },
  { id: 'COMPLETED', label: 'Completed', icon: CheckCircle2 }
];

export default function TaskStatusStepper({ status = 'QUEUED', progress = 5, message = '' }) {
  const isFailed = status === 'FAILED';
  
  const getStageIndex = (st) => {
    switch (st) {
      case 'QUEUED': return 0;
      case 'PROCESSING': return 1;
      case 'PARSING': return 2;
      case 'COMPLETED': return 3;
      case 'FAILED': return -1;
      default: return 0;
    }
  };

  const currentIndex = getStageIndex(status);

  return (
    <div className="bg-dark-surface/60 border border-gray-800 rounded-xl p-3.5 my-3">
      {/* Progress Bar Top */}
      <div className="flex items-center justify-between text-xs font-mono mb-2">
        <span className="text-gray-300 font-semibold flex items-center gap-1.5">
          {!isFailed && status !== 'COMPLETED' && (
            <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
          )}
          {isFailed ? (
            <span className="text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> TASK FAILED
            </span>
          ) : (
            `Task Pipeline State: ${status}`
          )}
        </span>
        <span className="text-sky-400 font-semibold">{progress}%</span>
      </div>

      {/* Stepper Node Icons */}
      <div className="grid grid-cols-4 gap-2 relative my-3">
        {/* Connecting track line */}
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-800 -translate-y-1/2 z-0" />
        <div
          className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-sky-500 to-emerald-500 -translate-y-1/2 z-0 transition-all duration-500"
          style={{ width: `${Math.max(progress, 2)}%` }}
        />

        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isPassed = !isFailed && currentIndex >= idx;
          const isCurrent = !isFailed && currentIndex === idx;

          return (
            <div key={stage.id} className="relative z-10 flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-between justify-center border transition-all duration-300 ${
                  isCurrent
                    ? 'bg-sky-500 border-sky-400 text-white shadow-lg shadow-sky-500/40 ring-4 ring-sky-500/20'
                    : isPassed
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : 'bg-dark-base border-gray-800 text-gray-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5 mx-auto" />
              </div>
              <span
                className={`text-[10px] font-mono mt-1.5 font-medium ${
                  isCurrent ? 'text-sky-400 font-semibold' : isPassed ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Live Message Subtitle */}
      {message && (
        <p className="text-[11px] font-mono text-gray-400 bg-dark-base/60 p-2 rounded border border-gray-800/60 mt-1">
          {message}
        </p>
      )}
    </div>
  );
}
