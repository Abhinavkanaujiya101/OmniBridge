'use client';

import React from 'react';
import { Activity, Zap, Cpu, Server } from 'lucide-react';

export default function MetricsCard({ metrics = {}, className = '' }) {
  const items = [
    {
      title: 'Gateway Status',
      value: metrics.status || 'OPERATIONAL',
      subtext: 'WebSocket & REST active',
      icon: Server,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10'
    },
    {
      title: 'Active Provider',
      value: metrics.provider || 'Gemini 1.5',
      subtext: metrics.model || 'gemini-1.5-flash',
      icon: Cpu,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10'
    },
    {
      title: 'Stream Latency',
      value: metrics.latency ? `${metrics.latency} ms` : '24 ms',
      subtext: 'Real-time TTFT',
      icon: Zap,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10'
    },
    {
      title: 'Token Throughput',
      value: metrics.tokens ? `${metrics.tokens} tokens` : '142 t/s',
      subtext: 'Stream parsed chunks',
      icon: Activity,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10'
    }
  ];

  const defaultGridClass = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6';

  return (
    <div className={className || defaultGridClass}>
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div key={idx} className="glass-card rounded-xl p-5 hover:border-gray-700 transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {item.title}
              </span>
              <div className={`p-2 rounded-lg ${item.bg}`}>
                <Icon className={`w-4 h-4 ${item.color}`} />
              </div>
            </div>
            <div className="text-xl font-bold text-gray-100 font-mono">
              {item.value}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {item.subtext}
            </div>
          </div>
        );
      })}
    </div>
  );
}
