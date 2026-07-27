/**
 * OmniBridge Output Parser & In-Memory File Stream Generator
 * ─────────────────────────────────────────────────────────────────────────────
 * Parses raw LLM text output (JSON blobs, Markdown documents, fenced code blocks)
 * and transforms them into downloadable file streams — PDF or raw code files —
 * entirely in memory using Node.js stream primitives and PDFKit.
 *
 * Design principles:
 *   • Zero local disk writes — all transformation is stream-based (Buffer/Readable)
 *   • Streaming-first — each generator returns a { stream, mimeType, filename }
 *     object that callers can pipe directly to the HTTP response
 *   • Pure server-side — no client-side rendering required
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { Readable, PassThrough } = require('stream');
const PDFDocument = require('pdfkit');

// ─── MIME & extension maps ────────────────────────────────────────────────────

const LANGUAGE_MIME = {
  javascript: { mime: 'application/javascript',  ext: 'js'   },
  js:         { mime: 'application/javascript',  ext: 'js'   },
  typescript: { mime: 'application/typescript',  ext: 'ts'   },
  ts:         { mime: 'application/typescript',  ext: 'ts'   },
  python:     { mime: 'text/x-python',           ext: 'py'   },
  py:         { mime: 'text/x-python',           ext: 'py'   },
  rust:       { mime: 'text/x-rustsrc',          ext: 'rs'   },
  go:         { mime: 'text/x-go',               ext: 'go'   },
  java:       { mime: 'text/x-java-source',      ext: 'java' },
  cpp:        { mime: 'text/x-c++src',           ext: 'cpp'  },
  c:          { mime: 'text/x-csrc',             ext: 'c'    },
  bash:       { mime: 'application/x-sh',        ext: 'sh'   },
  sh:         { mime: 'application/x-sh',        ext: 'sh'   },
  sql:        { mime: 'application/sql',         ext: 'sql'  },
  json:       { mime: 'application/json',        ext: 'json' },
  yaml:       { mime: 'application/yaml',        ext: 'yaml' },
  yml:        { mime: 'application/yaml',        ext: 'yml'  },
  html:       { mime: 'text/html',               ext: 'html' },
  css:        { mime: 'text/css',                ext: 'css'  },
  dockerfile: { mime: 'text/plain',              ext: 'Dockerfile' },
  markdown:   { mime: 'text/markdown',           ext: 'md'   },
  md:         { mime: 'text/markdown',           ext: 'md'   }
};

// ─── 1. LLM Output Structure Parser ──────────────────────────────────────────

/**
 * Parse a raw LLM output string into a structured document object.
 *
 * @param {string} rawOutput
 * @returns {{
 *   type: 'json'|'markdown'|'code'|'text',
 *   language: string|null,
 *   content: any,           // parsed value for JSON; raw string otherwise
 *   rawText: string,
 *   codeBlocks: Array<{language: string, code: string}>,
 *   sections: Array<{level: number, heading: string, body: string}>,
 *   jsonBlocks: Array<any>
 * }}
 */
function parseRawOutput(rawOutput) {
  if (typeof rawOutput !== 'string') rawOutput = JSON.stringify(rawOutput, null, 2);
  const text = rawOutput.trim();

  const result = {
    type: 'text',
    language: null,
    content: text,
    rawText: text,
    codeBlocks: [],
    sections: [],
    jsonBlocks: []
  };

  // ── Extract all fenced code blocks ````language\n…\n```` ─────────────────
  const codeBlockRe = /```(\w*)\n?([\s\S]*?)```/g;
  let match;
  while ((match = codeBlockRe.exec(text)) !== null) {
    const lang = (match[1] || 'text').toLowerCase();
    const code = match[2].trim();
    result.codeBlocks.push({ language: lang, code });

    if (lang === 'json') {
      try { result.jsonBlocks.push(JSON.parse(code)); } catch (_) {}
    }
  }

  // ── Classify primary type ──────────────────────────────────────────────────
  // Pure JSON
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      result.content = JSON.parse(text);
      result.type = 'json';
      result.language = 'json';
      return result;
    } catch (_) {}
  }

  // Contains fenced code blocks
  if (result.codeBlocks.length > 0) {
    const firstCode = result.codeBlocks[0];
    result.type = 'code';
    result.language = firstCode.language || 'text';
    result.content = firstCode.code;
  }

  // Markdown — heuristic: at least 2 headings or substantial formatting
  const headingRe = /^#{1,6}\s+(.+)$/gm;
  const headings = [...text.matchAll(headingRe)];

  if (headings.length >= 1) {
    if (result.type !== 'code') result.type = 'markdown';
    // Build section tree
    result.sections = _buildSections(text);
  }

  return result;
}

/**
 * Extract all code blocks from a raw LLM output.
 * Returns an array sorted by language and de-duplicated.
 *
 * @param {string} rawOutput
 * @returns {Array<{language: string, code: string}>}
 */
function extractCodeBlocks(rawOutput) {
  const parsed = parseRawOutput(rawOutput);
  return parsed.codeBlocks;
}

/**
 * Try to extract structured JSON from raw LLM output, even if embedded in prose.
 * Attempts multiple strategies: full parse → first JSON block → regex extraction.
 *
 * @param {string} rawOutput
 * @returns {any|null} Parsed JSON value, or null if none found
 */
function extractJSON(rawOutput) {
  const text = (rawOutput || '').trim();

  // Strategy 1: full text is valid JSON
  try { return JSON.parse(text); } catch (_) {}

  // Strategy 2: JSON in fenced code block
  const fencedMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fencedMatch) {
    try { return JSON.parse(fencedMatch[1].trim()); } catch (_) {}
  }

  // Strategy 3: extract first {...} block
  const braceMatch = text.match(/\{[\s\S]*?\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch (_) {}
  }

  // Strategy 4: extract first [...] block
  const bracketMatch = text.match(/\[[\s\S]*?\]/);
  if (bracketMatch) {
    try { return JSON.parse(bracketMatch[0]); } catch (_) {}
  }

  return null;
}

// ─── 2. In-Memory PDF Generator ──────────────────────────────────────────────

/**
 * Transform parsed LLM output into a PDF stream — entirely in memory via PDFKit.
 * No file is written to disk at any point.
 *
 * @param {string} rawOutput        - Raw LLM output text
 * @param {{ title?: string, author?: string, taskType?: string, provider?: string }} [meta]
 * @returns {{ stream: PassThrough, mimeType: string, filename: string }}
 */
function generatePDFStream(rawOutput, meta = {}) {
  const {
    title = 'OmniBridge Output',
    author = 'OmniBridge AI Gateway',
    taskType = 'TEXT',
    provider = 'AI'
  } = meta;

  const parsed = parseRawOutput(rawOutput);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `omnibridge_${taskType.toLowerCase()}_${timestamp}.pdf`;

  // Create an in-memory passthrough stream — PDFKit pipes into it
  const passthrough = new PassThrough();

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 56, bottom: 56, left: 64, right: 64 },
    info: {
      Title: title,
      Author: author,
      Subject: `OmniBridge AI Output — ${taskType}`,
      Keywords: `AI, ${taskType}, ${provider}`,
      CreationDate: new Date()
    },
    bufferPages: false
  });

  doc.pipe(passthrough);

  // ── Cover/header band ────────────────────────────────────────────────────
  doc
    .rect(0, 0, doc.page.width, 80)
    .fill('#0f172a');

  doc
    .fillColor('#38bdf8')
    .fontSize(22)
    .font('Helvetica-Bold')
    .text('OmniBridge', 64, 22);

  doc
    .fillColor('#94a3b8')
    .fontSize(10)
    .font('Helvetica')
    .text(`AI Orchestration Gateway  •  ${provider.toUpperCase()}  •  ${taskType}`, 64, 50);

  doc.moveDown(4);

  // ── Document title ───────────────────────────────────────────────────────
  doc
    .fillColor('#0f172a')
    .fontSize(18)
    .font('Helvetica-Bold')
    .text(title, { align: 'left' });

  doc
    .fillColor('#64748b')
    .fontSize(9)
    .font('Helvetica')
    .text(`Generated: ${new Date().toUTCString()}`, { align: 'left' });

  doc
    .moveTo(64, doc.y + 6)
    .lineTo(doc.page.width - 64, doc.y + 6)
    .strokeColor('#e2e8f0')
    .lineWidth(1)
    .stroke();

  doc.moveDown(1.5);

  // ── Render body based on parsed type ─────────────────────────────────────
  switch (parsed.type) {
    case 'json':
      _pdfAddJSON(doc, parsed.content);
      break;

    case 'code':
      if (parsed.sections.length > 0) _pdfAddMarkdownSections(doc, parsed.sections);
      if (parsed.codeBlocks.length > 0) {
        for (const block of parsed.codeBlocks) {
          _pdfAddCodeBlock(doc, block.code, block.language);
        }
      }
      break;

    case 'markdown':
      if (parsed.sections.length > 0) {
        _pdfAddMarkdownSections(doc, parsed.sections);
      } else {
        _pdfAddBodyText(doc, parsed.rawText);
      }
      if (parsed.codeBlocks.length > 0) {
        for (const block of parsed.codeBlocks) {
          _pdfAddCodeBlock(doc, block.code, block.language);
        }
      }
      break;

    default:
      _pdfAddBodyText(doc, parsed.rawText);
      break;
  }

  // ── Footer on each page ───────────────────────────────────────────────────
  const totalPages = doc.bufferedPageRange ? doc.bufferedPageRange().count : 1;
  doc
    .fontSize(8)
    .fillColor('#94a3b8')
    .text(
      `OmniBridge AI Gateway  •  ${new Date().getFullYear()}  •  Confidential`,
      64,
      doc.page.height - 40,
      { align: 'center', width: doc.page.width - 128 }
    );

  doc.end();

  return { stream: passthrough, mimeType: 'application/pdf', filename };
}

// ─── 3. In-Memory Code File Stream Generator ─────────────────────────────────

/**
 * Extract a code block from raw LLM output and return it as a readable byte stream.
 * No file is written to disk.
 *
 * @param {string} rawOutput        - Raw LLM output containing code
 * @param {{ language?: string, filename?: string, taskType?: string }} [opts]
 * @returns {{ stream: Readable, mimeType: string, filename: string, language: string, code: string }}
 */
function generateCodeFileStream(rawOutput, opts = {}) {
  const parsed = parseRawOutput(rawOutput);

  // Determine language — from opts, parsed output, or fallback 'text'
  let language = (opts.language || parsed.language || 'text').toLowerCase();
  const langInfo = LANGUAGE_MIME[language] || { mime: 'text/plain', ext: 'txt' };

  // Get the code content
  let code;
  if (parsed.codeBlocks.length > 0) {
    // Find matching language block or take first
    const matching = parsed.codeBlocks.find(b => b.language === language);
    code = (matching || parsed.codeBlocks[0]).code;
    if (!opts.language) language = (matching || parsed.codeBlocks[0]).language;
  } else {
    // No fenced code block — treat raw output as code
    code = parsed.rawText;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = opts.filename || `omnibridge_${timestamp}.${langInfo.ext}`;

  // Create a pure in-memory Readable from the code string buffer
  const stream = Readable.from([Buffer.from(code, 'utf-8')]);

  return {
    stream,
    mimeType: langInfo.mime,
    filename,
    language,
    code,
    byteLength: Buffer.byteLength(code, 'utf-8')
  };
}

/**
 * Stream raw markdown content as a downloadable `.md` file.
 *
 * @param {string} rawOutput
 * @param {{ filename?: string }} [opts]
 * @returns {{ stream: Readable, mimeType: string, filename: string }}
 */
function generateMarkdownFileStream(rawOutput, opts = {}) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = opts.filename || `omnibridge_${timestamp}.md`;
  const content = typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput, null, 2);

  return {
    stream: Readable.from([Buffer.from(content, 'utf-8')]),
    mimeType: 'text/markdown',
    filename
  };
}

// ─── 4. Markdown → Section tree ──────────────────────────────────────────────

function _buildSections(text) {
  const lines = text.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (current) sections.push(current);
      current = {
        level: headingMatch[1].length,
        heading: headingMatch[2].trim(),
        body: ''
      };
    } else if (current) {
      current.body += line + '\n';
    }
  }

  if (current) sections.push(current);
  return sections;
}

// ─── 5. PDF helpers (private) ─────────────────────────────────────────────────

function _pdfAddMarkdownSections(doc, sections) {
  const HEADING_STYLES = {
    1: { size: 18, font: 'Helvetica-Bold', color: '#0f172a', gap: 1.2 },
    2: { size: 14, font: 'Helvetica-Bold', color: '#1e3a5f', gap: 1.0 },
    3: { size: 12, font: 'Helvetica-Bold', color: '#334155', gap: 0.8 },
    4: { size: 11, font: 'Helvetica-Bold', color: '#475569', gap: 0.6 },
    5: { size: 10, font: 'Helvetica',      color: '#64748b', gap: 0.4 },
    6: { size: 9,  font: 'Helvetica',      color: '#94a3b8', gap: 0.3 }
  };

  for (const section of sections) {
    const style = HEADING_STYLES[section.level] || HEADING_STYLES[3];

    doc
      .fillColor(style.color)
      .fontSize(style.size)
      .font(style.font)
      .text(section.heading)
      .moveDown(style.gap);

    const bodyLines = section.body.trim().split('\n');
    for (const line of bodyLines) {
      const stripped = line.trim();
      if (!stripped) { doc.moveDown(0.3); continue; }

      // Bullet list items
      if (stripped.startsWith('- ') || stripped.startsWith('* ') || stripped.startsWith('+ ')) {
        doc
          .fillColor('#334155')
          .fontSize(10)
          .font('Helvetica')
          .text('  • ' + stripped.slice(2), { indent: 10 });
      }
      // Numbered list items
      else if (/^\d+\.\s/.test(stripped)) {
        doc
          .fillColor('#334155')
          .fontSize(10)
          .font('Helvetica')
          .text('  ' + stripped, { indent: 10 });
      }
      // Bold spans **text**
      else {
        const cleaned = stripped.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
        doc
          .fillColor('#1e293b')
          .fontSize(10)
          .font('Helvetica')
          .text(cleaned, { lineGap: 2 });
      }
    }
    doc.moveDown(0.8);
  }
}

function _pdfAddBodyText(doc, text) {
  const paragraphs = text.split(/\n{2,}/);
  for (const para of paragraphs) {
    const cleaned = para
      .replace(/```[\s\S]*?```/g, '[code block — see code file export]')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .trim();

    if (!cleaned) continue;

    doc
      .fillColor('#1e293b')
      .fontSize(10)
      .font('Helvetica')
      .text(cleaned, { lineGap: 3 })
      .moveDown(0.6);
  }
}

function _pdfAddCodeBlock(doc, code, language = '') {
  // Code block label
  doc
    .fillColor('#38bdf8')
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(`[ ${language.toUpperCase() || 'CODE'} ]`)
    .moveDown(0.3);

  // Dark background rect
  const boxX = 64;
  const boxY = doc.y;
  const boxWidth = doc.page.width - 128;
  const lineCount = code.split('\n').length;
  const boxHeight = Math.min(lineCount * 12 + 16, 300);

  doc
    .rect(boxX, boxY, boxWidth, boxHeight)
    .fill('#0f172a');

  // Code text inside box
  doc
    .fillColor('#e2e8f0')
    .fontSize(8)
    .font('Courier')
    .text(code.length > 2000 ? code.slice(0, 2000) + '\n… [truncated]' : code, boxX + 10, boxY + 8, {
      width: boxWidth - 20,
      lineGap: 2
    });

  doc.moveDown(1.5);
}

function _pdfAddJSON(doc, jsonObj) {
  const pretty = JSON.stringify(jsonObj, null, 2);

  doc
    .fillColor('#38bdf8')
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('Structured JSON Output')
    .moveDown(0.5);

  _pdfAddCodeBlock(doc, pretty, 'json');
}

// ─── Public API ───────────────────────────────────────────────────────────────

module.exports = {
  parseRawOutput,
  extractCodeBlocks,
  extractJSON,
  generatePDFStream,
  generateCodeFileStream,
  generateMarkdownFileStream,
  LANGUAGE_MIME
};
