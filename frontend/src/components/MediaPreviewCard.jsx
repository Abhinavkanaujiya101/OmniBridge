'use client';

import React from 'react';
import { Film, Image as ImageIcon, Download, ExternalLink, RefreshCw, CheckCircle, Sparkles } from 'lucide-react';
import { getExportUrl, extractUrlFromText } from '../lib/api';

export default function MediaPreviewCard({
  taskType = 'IMAGE_GENERATION',
  output = '',
  imageUrl = null,
  taskId = null,
  status = 'COMPLETED',
  progress = 100,
  provider = 'Together AI',
  model = 'FLUX.1-schnell'
}) {
  const isVideo = taskType === 'VIDEO_GENERATION';
  const isPending = status === 'QUEUED' || status === 'PROCESSING' || status === 'PARSING';

  const safeOutput = typeof output === 'string' ? output : (output?.videoUrl || output?.imageUrl || output?.assets?.video || output?.url || '');
  const videoUrlProp = typeof imageUrl === 'string' ? imageUrl : (output?.videoUrl || output?.assets?.video || output?.imageUrl || null);
  const extractedUrl = videoUrlProp || (typeof output === 'string' ? extractUrlFromText(output) : null);

  return (
    <div className="glass-panel rounded-xl p-4 my-3 border border-gray-800 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
        <div className="flex items-center gap-2">
          {isVideo ? (
            <Film className="w-4 h-4 text-amber-400" />
          ) : (
            <ImageIcon className="w-4 h-4 text-purple-400" />
          )}
          <span className="text-xs font-semibold text-gray-200 font-mono">
            {isVideo ? 'Generative Video Render' : 'Synthesized Image Artifact'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-dark-base border border-gray-700 text-gray-300">
            {provider} / {model}
          </span>
        </div>
      </div>

      {/* Media Preview Container */}
      <div className="relative rounded-lg overflow-hidden bg-dark-base border border-gray-800 min-h-[220px] flex items-center justify-center">
        {isPending ? (
          <div className="p-8 text-center space-y-3">
            <div className="relative inline-flex">
              <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
              <Sparkles className="w-4 h-4 text-amber-400 absolute -top-1 -right-1" />
            </div>
            <div>
              <p className="text-xs font-mono text-gray-200 font-semibold uppercase">
                {status}... ({progress}%)
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                {isVideo
                  ? 'Rendering video keyframes on Luma AI GPU cluster...'
                  : 'Synthesizing high-res image via FLUX model...'}
              </p>
            </div>

            {/* Progress bar */}
            <div className="w-48 mx-auto h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-purple-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : extractedUrl ? (
          isVideo ? (
            <video
              src={extractedUrl}
              controls
              autoPlay
              loop
              muted
              className="w-full h-auto max-h-[400px] object-contain rounded"
            />
          ) : (
            <img
              src={extractedUrl}
              alt="Generated AI Artifact"
              className="w-full h-auto max-h-[400px] object-contain rounded"
            />
          )
        ) : (
          /* Placeholder representation if media URL is raw task response */
          <div className="p-6 text-center space-y-2">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-xs font-mono text-gray-300 font-semibold">
              Render Task Submitted Successfully
            </p>
            <p className="text-[11px] text-gray-400 font-mono max-w-md mx-auto break-all bg-dark-surface p-2 rounded border border-gray-800">
              {output || 'Task completed with response payload.'}
            </p>
          </div>
        )}
      </div>

      {/* Download & Export Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-800 text-xs">
        <div className="flex items-center gap-2 text-gray-400 font-mono text-[11px]">
          <span>Task ID: {taskId ? taskId.slice(0, 12) : 'N/A'}</span>
        </div>

        <div className="flex items-center gap-2">
          {extractedUrl && (
            <a
              href={extractedUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-colors shadow-lg shadow-sky-600/20"
            >
              <Download className="w-3.5 h-3.5" /> Download Media
            </a>
          )}

          {taskId && (
            <a
              href={getExportUrl('pdf', taskId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-surface border border-gray-700 text-gray-200 hover:bg-gray-800 text-xs transition-colors font-mono"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Export PDF Summary
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
