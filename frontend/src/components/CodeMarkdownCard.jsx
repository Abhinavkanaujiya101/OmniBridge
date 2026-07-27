'use client';

import React, { useState } from 'react';
import { Copy, Check, FileText, Code2, Download, FileCode, ExternalLink } from 'lucide-react';
import { getExportUrl } from '../lib/api';

export default function CodeMarkdownCard({
  rawOutput = '',
  taskId = null,
  language = null,
  codeBlocks = [],
  outputType = 'text',
  exports = []
}) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Helper to extract code block list if not passed explicitly
  const blocks = codeBlocks.length > 0 ? codeBlocks : extractBlocksFromText(rawOutput);

  return (
    <div className="space-y-4 my-2">
      {/* Download / Export Toolbar if taskId exists */}
      {taskId && (
        <div className="flex flex-wrap items-center gap-2 bg-dark-surface/60 border border-gray-800 rounded-lg p-2 text-xs">
          <span className="text-gray-400 font-mono text-[11px] flex items-center gap-1">
            <Download className="w-3.5 h-3.5 text-sky-400" /> Export Options:
          </span>

          <a
            href={getExportUrl('pdf', taskId)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 font-mono transition-colors"
          >
            <FileText className="w-3.5 h-3.5" /> PDF
          </a>

          {blocks.map((block, i) => (
            <a
              key={i}
              href={getExportUrl('code', taskId, { language: block.language, blockIndex: i })}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-mono transition-colors"
            >
              <FileCode className="w-3.5 h-3.5" /> .{block.language || 'txt'}
            </a>
          ))}

          <a
            href={getExportUrl('markdown', taskId)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 font-mono transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Markdown
          </a>
        </div>
      )}

      {/* Render Code Blocks with Copy Controls */}
      {blocks.length > 0 ? (
        <div className="space-y-4">
          {blocks.map((block, idx) => (
            <div key={idx} className="rounded-xl overflow-hidden border border-gray-800 bg-dark-base shadow-xl">
              {/* Code Header */}
              <div className="bg-dark-surface px-4 py-2 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs text-sky-400">
                  <Code2 className="w-4 h-4" />
                  <span className="font-semibold uppercase">{block.language || 'code'}</span>
                </div>

                <button
                  onClick={() => handleCopy(block.code, idx)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 bg-dark-base border border-gray-700/80 px-2.5 py-1 rounded transition-colors"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-mono">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Code Content */}
              <pre className="p-4 font-mono text-xs text-gray-200 overflow-x-auto overflow-y-auto max-h-[380px] leading-relaxed bg-[#06090E]">
                <code>{block.code}</code>
              </pre>
            </div>
          ))}

          {/* Render remaining text if any */}
          {getSurroundingText(rawOutput).trim() && (
            <div className="text-sm text-gray-300 leading-relaxed font-sans bg-dark-surface/30 p-4 rounded-xl border border-gray-800/60 whitespace-pre-wrap">
              {getSurroundingText(rawOutput)}
            </div>
          )}
        </div>
      ) : (
        /* Regular Prose / Markdown Text */
        <div className="text-sm text-gray-200 leading-relaxed font-sans bg-dark-surface/40 p-4 rounded-xl border border-gray-800/80 whitespace-pre-wrap">
          {rawOutput}
        </div>
      )}
    </div>
  );
}

// Helper regex parser for inline block extraction
function extractBlocksFromText(text) {
  if (!text) return [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  const blocks = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim()
    });
  }
  return blocks;
}

function getSurroundingText(text) {
  if (!text) return '';
  return text.replace(/```\w*\n?[\s\S]*?```/g, '').trim();
}
