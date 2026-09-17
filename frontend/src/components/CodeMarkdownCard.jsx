'use client';

import React, { useState } from 'react';
import { Copy, Check, FileText, Code2, Download, FileCode, ExternalLink, ChevronDown, File, Sparkles } from 'lucide-react';
import { getExportUrl } from '../lib/api';
import { exportToPdf, exportToWord, exportToMarkdown, exportToTxt } from '../lib/documentExporter';

export default function CodeMarkdownCard({
  rawOutput = '',
  taskId = null,
  language = null,
  codeBlocks = [],
  outputType = 'text',
  exports = [],
  taskType = 'TEXT',
  telemetry = {}
}) {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null);

  const handleCopy = (text, idx) => {
    try {
      navigator.clipboard.writeText(text || '');
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  // Safe text extraction guaranteed not to throw runtime errors
  const safeText = typeof rawOutput === 'string'
    ? rawOutput
    : (rawOutput && typeof rawOutput === 'object' && rawOutput.output)
    ? rawOutput.output
    : (rawOutput ? String(rawOutput) : '');

  // Helper to extract code block list if not passed explicitly
  const blocks = codeBlocks.length > 0 ? codeBlocks : extractBlocksFromText(safeText);

  // Metadata object for export files
  const meta = {
    title: telemetry?.promptTitle || null,
    userPrompt: telemetry?.userPrompt || '',
    model: telemetry?.targetModel || 'AI Model',
    provider: telemetry?.targetProvider || 'AI Gateway',
    taskType: taskType || telemetry?.taskType || 'TEXT',
    timestamp: new Date().toLocaleString()
  };

  const handleClientExport = async (format) => {
    try {
      setExportingFormat(format);
      if (format === 'pdf') {
        exportToPdf(safeText, meta);
      } else if (format === 'word') {
        await exportToWord(safeText, meta);
      } else if (format === 'md') {
        exportToMarkdown(safeText, meta);
      } else if (format === 'txt') {
        exportToTxt(safeText, meta);
      }
    } catch (err) {
      console.error(`Export failed for format ${format}:`, err);
    } finally {
      setExportingFormat(null);
      setIsExportMenuOpen(false);
    }
  };

  const isDocumentTask =
    taskType === 'DOCUMENT_GENERATION' ||
    telemetry?.taskType === 'DOCUMENT_GENERATION' ||
    telemetry?.presetMode === 'DOCUMENT_GENERATION';

  return (
    <div className="space-y-4 my-2">
      {/* 1. Multi-Format "Export As" Action Bar rendered ONLY when intent/preset is DOCUMENT_GENERATION */}
      {isDocumentTask && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-dark-surface/80 border border-gray-800 rounded-xl p-2.5 text-xs shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-mono text-[11px] flex items-center gap-1.5 font-semibold">
              <Download className="w-3.5 h-3.5 text-sky-400" /> Export As:
            </span>

            {/* PDF Export Button */}
            <button
              onClick={() => handleClientExport('pdf')}
              disabled={exportingFormat === 'pdf'}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 font-mono transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              title="Download PDF Document (.pdf)"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span>PDF (.pdf)</span>
            </button>

            {/* Word Export Button */}
            <button
              onClick={() => handleClientExport('word')}
              disabled={exportingFormat === 'word'}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 font-mono transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              title="Download Native Word Document (.docx)"
            >
              <File className="w-3.5 h-3.5 text-indigo-400" />
              <span>Word (.docx)</span>
            </button>

            {/* Markdown Export Button */}
            <button
              onClick={() => handleClientExport('md')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 font-mono transition-all hover:scale-[1.02] active:scale-95"
              title="Download Clean Markdown File (.md)"
            >
              <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
              <span>Markdown (.md)</span>
            </button>

            {/* Plain Text Export Button */}
            <button
              onClick={() => handleClientExport('txt')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-500/10 hover:bg-gray-500/20 text-gray-300 border border-gray-500/20 font-mono transition-all hover:scale-[1.02] active:scale-95"
              title="Download Raw Plain Text (.txt)"
            >
              <FileCode className="w-3.5 h-3.5 text-gray-400" />
              <span>Text (.txt)</span>
            </button>
          </div>

          {/* Code Block direct exports if code is present */}
          {blocks.length > 0 && taskId && (
            <div className="flex items-center gap-1.5">
              {blocks.map((block, i) => (
                <a
                  key={i}
                  href={getExportUrl('code', taskId, { blockIndex: i, language: block.language })}
                  download
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-mono text-[10px] transition-colors"
                >
                  <Code2 className="w-3 h-3" /> .{block.language || 'txt'}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Render Code Blocks or Markdown Prose Content */}
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
          {getSurroundingText(safeText).trim() && (
            <div className="bg-dark-surface/40 p-4 rounded-xl border border-gray-800/80 shadow-md">
              <MarkdownProseRenderer content={getSurroundingText(safeText)} />
            </div>
          )}
        </div>
      ) : (
        /* Regular Prose / Markdown Text */
        <div className="bg-dark-surface/40 p-4.5 rounded-xl border border-gray-800/80 shadow-md">
          <MarkdownProseRenderer content={safeText} />
        </div>
      )}

      {/* 3. Automatic Prominent Primary Buttons for Document Generation Responses */}
      {isDocumentTask && (
        <div className="p-3 bg-gradient-to-r from-sky-950/40 via-indigo-950/30 to-purple-950/20 border border-sky-500/30 rounded-xl flex flex-wrap items-center justify-between gap-3 mt-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400 animate-pulse" />
            <span className="text-xs font-sans text-sky-200 font-medium">
              Document Synthesis Ready for Multi-Format Export:
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleClientExport('pdf')}
              disabled={exportingFormat === 'pdf'}
              className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs font-sans flex items-center gap-1.5 shadow-lg shadow-sky-600/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{exportingFormat === 'pdf' ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={() => handleClientExport('word')}
              disabled={exportingFormat === 'word'}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs font-sans flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              <File className="w-3.5 h-3.5" />
              <span>{exportingFormat === 'word' ? 'Generating Word...' : 'Download Word'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Rich Markdown Prose Renderer with custom hierarchy, typography, & icons
 */
function MarkdownProseRenderer({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let inList = false;
  let listItems = [];
  let listType = 'unordered'; // 'unordered' | 'ordered'

  const flushList = (key) => {
    if (listItems.length > 0) {
      if (listType === 'ordered') {
        elements.push(
          <ol key={`ol-${key}`} className="space-y-2 my-3 pl-4 list-decimal text-gray-300 marker:text-sky-400 marker:font-bold">
            {listItems.map((item, idx) => (
              <li key={idx} className="leading-relaxed pl-1">
                {formatInlineMarkdown(item)}
              </li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${key}`} className="space-y-2 my-3 pl-1">
            {listItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 leading-relaxed text-gray-300">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400 mt-2 shrink-0 shadow-sm shadow-sky-400/60" />
                <span className="flex-1">{formatInlineMarkdown(item)}</span>
              </li>
            ))}
          </ul>
        );
      }
      listItems = [];
      inList = false;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Check for lists
    const isUnordered = /^[\-\*\+]\s+/.test(trimmed);
    const isOrdered = /^\d+\.\s+/.test(trimmed);

    if (isUnordered || isOrdered) {
      const currentListType = isOrdered ? 'ordered' : 'unordered';
      if (inList && listType !== currentListType) {
        flushList(idx);
      }
      inList = true;
      listType = currentListType;
      const text = isOrdered ? trimmed.replace(/^\d+\.\s+/, '') : trimmed.replace(/^[\-\*\+]\s+/, '');
      listItems.push(text);
      return;
    } else if (inList) {
      flushList(idx);
    }

    if (!trimmed) {
      return;
    }

    // Check for headers
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={idx} className="text-xl font-bold text-sky-300 border-b border-sky-500/25 pb-2 mt-5 mb-3 flex items-center gap-2 font-sans tracking-tight">
          {formatInlineMarkdown(trimmed.replace(/^#\s+/, ''))}
        </h1>
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={idx} className="text-lg font-bold text-sky-400 mt-4 mb-2 flex items-center gap-2 font-sans tracking-tight">
          {formatInlineMarkdown(trimmed.replace(/^##\s+/, ''))}
        </h2>
      );
    } else if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={idx} className="text-base font-semibold text-indigo-300 mt-3.5 mb-1.5 font-sans">
          {formatInlineMarkdown(trimmed.replace(/^###\s+/, ''))}
        </h3>
      );
    } else if (trimmed.startsWith('#### ')) {
      elements.push(
        <h4 key={idx} className="text-sm font-semibold text-gray-200 mt-3 mb-1 font-sans">
          {formatInlineMarkdown(trimmed.replace(/^####\s+/, ''))}
        </h4>
      );
    } else if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote key={idx} className="border-l-4 border-sky-500 bg-sky-950/20 text-sky-200/90 pl-3.5 py-2 my-3 rounded-r-lg text-xs italic font-sans shadow-inner">
          {formatInlineMarkdown(trimmed.replace(/^>\s+/, ''))}
        </blockquote>
      );
    } else if (/^(---|\*\*\*|___)$/.test(trimmed)) {
      elements.push(<hr key={idx} className="border-t border-gray-800/90 my-4" />);
    } else {
      elements.push(
        <p key={idx} className="text-sm text-gray-300 leading-relaxed font-sans mb-2.5">
          {formatInlineMarkdown(trimmed)}
        </p>
      );
    }
  });

  if (inList) {
    flushList('final');
  }

  return <div className="space-y-1">{elements}</div>;
}

/**
 * Format inline markdown tokens (bold **text**, inline code `code`, italic *text*)
 */
function formatInlineMarkdown(text) {
  if (!text) return '';
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_)/g);

  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 font-mono text-xs mx-0.5">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-bold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return (
        <em key={i} className="italic text-gray-200">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
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
  return text
    .replace(/```\w*\n?[\s\S]*?```/g, '')
    .replace(/\*This code was generated by.*?\*/gi, '')
    .replace(/# OmniBridge Gateway.*?\n/gi, '')
    .trim();
}
