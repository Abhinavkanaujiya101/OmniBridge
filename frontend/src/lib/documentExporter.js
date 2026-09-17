import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';

/**
 * Safely extracts raw string content from input parameter.
 */
function sanitizeText(rawOutput) {
  if (!rawOutput) return '';
  if (typeof rawOutput === 'string') return rawOutput;
  if (typeof rawOutput === 'object') {
    if (rawOutput.output && typeof rawOutput.output === 'string') return rawOutput.output;
    try {
      return JSON.stringify(rawOutput, null, 2);
    } catch (e) {
      return String(rawOutput);
    }
  }
  return String(rawOutput);
}

/**
 * Strips raw Markdown syntax tokens from inline text runs.
 */
function stripMarkdownInline(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>\s+/, '')
    .replace(/^[\-\*\+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/^(---|===|\*\*\*|___|====+|----+)$/, '')
    .trim();
}

/**
 * Parses raw markdown text into structured content block nodes.
 */
function parseMarkdownToBlocks(rawText) {
  const text = sanitizeText(rawText);
  const lines = text.split('\n');
  const blocks = [];
  let inCodeBlock = false;
  let codeBuffer = [];
  let codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({ type: 'code', language: codeLang, code: codeBuffer.join('\n') });
        codeBuffer = [];
        codeLang = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = trimmed.replace(/^```/, '').trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    if (!trimmed) {
      continue;
    }

    // Horizontal Rule / Divider (Strict regex matching lines of -, =, *, _)
    if (/^(---|===|\*\*\*|___|====+|----+)$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      continue;
    }

    // Headings
    if (/^#{1,6}\s+/.test(trimmed)) {
      const match = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const headingText = match[2].replace(/(\*\*|__|`)/g, '').replace(/^Executive Report:\s*/i, '').trim();
        blocks.push({ type: 'heading', level, text: headingText });
        continue;
      }
    }

    // Callouts / Blockquotes
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '').replace(/(\*\*|__|`)/g, '').trim();
      blocks.push({ type: 'callout', text: quoteText });
      continue;
    }

    // Unordered List
    if (/^[\-\*\+]\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^[\-\*\+]\s+/, '').replace(/(\*\*|__|`)/g, '').trim();
      blocks.push({ type: 'list', ordered: false, text: itemText });
      continue;
    }

    // Ordered List
    if (/^\d+\.\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^\d+\.\s+/, '').replace(/(\*\*|__|`)/g, '').trim();
      blocks.push({ type: 'list', ordered: true, text: itemText });
      continue;
    }

    // Regular Paragraph
    const cleanPara = stripMarkdownInline(trimmed);
    if (cleanPara) {
      blocks.push({ type: 'paragraph', text: cleanPara });
    }
  }

  return blocks;
}

/**
 * Dynamically extracts a clean document title from blocks or user prompt.
 */
function extractDynamicTitle(blocks, meta = {}) {
  // Option 1: First heading in blocks (H1 or H2)
  for (const block of blocks) {
    if (block.type === 'heading' && (block.level === 1 || block.level === 2)) {
      const cleaned = block.text.replace(/^Executive Report:\s*/i, '').trim();
      if (cleaned && !/^(Executive Summary|Overview|Summary|Table of Contents|Introduction)$/i.test(cleaned)) {
        return cleaned;
      }
    }
  }

  // Option 2: Extract from user prompt if available
  const prompt = meta.userPrompt || meta.promptTitle || meta.title || '';
  if (prompt) {
    let cleanPrompt = prompt
      .replace(/^(create|write|generate|make|draft|prepare)\s+(a\s+)?(pdf|doc|document|word\s+file|report)?\s*(on|about|for)?\s*/i, '')
      .replace(/(\*\*|__|`)/g, '')
      .trim();

    if (cleanPrompt) {
      // Capitalize title words
      cleanPrompt = cleanPrompt
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      
      if (cleanPrompt.length < 5) cleanPrompt += ' Analysis';
      return cleanPrompt;
    }
  }

  // Option 3: Fallback Title
  return 'Executive Report';
}

/**
 * Helper to trigger browser file download from Blob.
 */
function downloadFile(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 1. Export as 100% White-Labeled PDF (.pdf) with Executive 0.75" Margins
 */
export function exportToPdf(rawOutput, meta = {}) {
  const blocks = parseMarkdownToBlocks(rawOutput);
  const dynamicTitle = extractDynamicTitle(blocks, meta);

  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 54; // Standard 0.75-inch margins (54 pt)
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPageBreak = (neededHeight) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Render Centered Dynamic Document Title (24pt Bold)
  checkPageBreak(50);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(15, 23, 42); // slate-900
  const titleLines = doc.splitTextToSize(dynamicTitle, contentWidth);
  
  titleLines.forEach((line) => {
    doc.text(line, pageWidth / 2, y, { align: 'center' });
    y += 28;
  });
  
  y += 8;

  // Divider under title
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  // Determine if first block was the title heading to prevent duplicate title rendering
  let startIndex = 0;
  if (blocks.length > 0 && blocks[0].type === 'heading' && (blocks[0].level === 1 || blocks[0].level === 2)) {
    const headingText = blocks[0].text.replace(/^Executive Report:\s*/i, '').trim();
    if (headingText.toLowerCase() === dynamicTitle.toLowerCase() || dynamicTitle.toLowerCase().includes(headingText.toLowerCase())) {
      startIndex = 1;
    }
  }

  // Render Content Blocks
  for (let i = startIndex; i < blocks.length; i++) {
    const block = blocks[i];

    switch (block.type) {
      case 'heading': {
        if (block.level === 1) {
          checkPageBreak(36);
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(18);
          doc.setTextColor(30, 41, 59); // slate-800
          const lines = doc.splitTextToSize(block.text, contentWidth);
          doc.text(lines, margin, y);
          y += lines.length * 20 + 8;
        } else if (block.level === 2) {
          checkPageBreak(30);
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(14);
          doc.setTextColor(51, 65, 85); // slate-700
          const lines = doc.splitTextToSize(block.text, contentWidth);
          doc.text(lines, margin, y);
          y += lines.length * 16 + 6;
        } else {
          checkPageBreak(24);
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(71, 85, 105); // slate-600
          const lines = doc.splitTextToSize(block.text, contentWidth);
          doc.text(lines, margin, y);
          y += lines.length * 14 + 4;
        }
        break;
      }

      case 'hr': {
        checkPageBreak(20);
        y += 4;
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.setLineWidth(1);
        doc.line(margin, y, pageWidth - margin, y);
        y += 16;
        break;
      }

      case 'callout': {
        checkPageBreak(30);
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        const lines = doc.splitTextToSize(block.text, contentWidth - 24);
        const blockHeight = lines.length * 13 + 12;

        // Draw left accent border
        doc.setDrawColor(59, 130, 246); // blue-500
        doc.setLineWidth(3);
        doc.line(margin + 4, y, margin + 4, y + blockHeight - 4);

        doc.text(lines, margin + 16, y + 10);
        y += blockHeight + 8;
        break;
      }

      case 'list': {
        checkPageBreak(18);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(30, 41, 59);
        const prefix = '• ';
        const lines = doc.splitTextToSize(prefix + block.text, contentWidth - 16);
        doc.text(lines, margin + 12, y);
        y += lines.length * 13.5 + 4;
        break;
      }

      case 'code': {
        checkPageBreak(40);
        doc.setFont('Courier', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        const codeLines = doc.splitTextToSize(block.code, contentWidth - 16);
        const codeHeight = codeLines.length * 11 + 12;

        // Light background box
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.rect(margin, y, contentWidth, codeHeight, 'DF');

        doc.text(codeLines, margin + 8, y + 10);
        y += codeHeight + 10;
        break;
      }

      case 'paragraph':
      default: {
        checkPageBreak(20);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(30, 41, 59);
        const lines = doc.splitTextToSize(block.text, contentWidth);
        doc.text(lines, margin, y);
        y += lines.length * 14 + 8;
        break;
      }
    }
  }

  // ── Clean Page Numbering Footer (ONLY Page X of Y, zero platform branding) ──
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Page ${p} of ${pageCount}`, pageWidth / 2, pageHeight - 30, { align: 'center' });
  }

  const cleanFileTitle = (dynamicTitle || 'document').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 35);
  doc.save(`${cleanFileTitle}_${Date.now()}.pdf`);
}

/**
 * 2. Export as 100% White-Labeled Native Word Document (.docx)
 */
export async function exportToWord(rawOutput, meta = {}) {
  const blocks = parseMarkdownToBlocks(rawOutput);
  const dynamicTitle = extractDynamicTitle(blocks, meta);

  const docParagraphs = [];

  // Render Centered Dynamic Title (24pt Bold)
  docParagraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: dynamicTitle,
          bold: true,
          size: 48, // 24pt
          color: '0F172A'
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 240 }
    })
  );

  let startIndex = 0;
  if (blocks.length > 0 && blocks[0].type === 'heading' && (blocks[0].level === 1 || blocks[0].level === 2)) {
    const headingText = blocks[0].text.replace(/^Executive Report:\s*/i, '').trim();
    if (headingText.toLowerCase() === dynamicTitle.toLowerCase() || dynamicTitle.toLowerCase().includes(headingText.toLowerCase())) {
      startIndex = 1;
    }
  }

  // Process Blocks into DOCX elements
  for (let i = startIndex; i < blocks.length; i++) {
    const block = blocks[i];

    switch (block.type) {
      case 'heading': {
        const level = block.level === 1 ? HeadingLevel.HEADING_1 : block.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
        const fontSize = block.level === 1 ? 36 : block.level === 2 ? 28 : 24;
        const color = block.level === 1 ? '1E293B' : block.level === 2 ? '334155' : '475569';

        docParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: block.text,
                bold: true,
                size: fontSize,
                color
              })
            ],
            heading: level,
            spacing: { before: 240, after: 120 }
          })
        );
        break;
      }

      case 'hr': {
        docParagraphs.push(
          new Paragraph({
            border: {
              bottom: { color: 'CBD5E1', space: 1, value: BorderStyle.SINGLE, size: 6 }
            },
            spacing: { before: 120, after: 120 }
          })
        );
        break;
      }

      case 'callout': {
        docParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: block.text,
                italics: true,
                color: '334155',
                size: 21
              })
            ],
            border: {
              left: { color: '3B82F6', space: 12, value: BorderStyle.SINGLE, size: 24 }
            },
            indent: { left: 240 },
            spacing: { before: 120, after: 120 }
          })
        );
        break;
      }

      case 'list': {
        docParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: block.text,
                size: 21,
                color: '1E293B'
              })
            ],
            bullet: { level: 0 },
            spacing: { after: 80 }
          })
        );
        break;
      }

      case 'code': {
        const codeLines = block.code.split('\n');
        codeLines.forEach((cline) => {
          docParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: cline,
                  font: 'Courier New',
                  size: 18,
                  color: '0F172A'
                })
              ],
              indent: { left: 240 },
              spacing: { after: 40 }
            })
          );
        });
        break;
      }

      case 'paragraph':
      default: {
        docParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: block.text,
                size: 21, // 10.5pt
                color: '1E293B'
              })
            ],
            spacing: { after: 140 }
          })
        );
        break;
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1080, // 0.75 inch (1080 dxa)
              bottom: 1080,
              left: 1080,
              right: 1080
            }
          }
        },
        children: docParagraphs
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const cleanFileTitle = (dynamicTitle || 'document').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 35);
  downloadFile(blob, `${cleanFileTitle}_${Date.now()}.docx`);
}

/**
 * 3. Export as Clean White-Labeled Markdown (.md)
 */
export function exportToMarkdown(rawOutput, meta = {}) {
  const text = sanitizeText(rawOutput);
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const blocks = parseMarkdownToBlocks(text);
  const dynamicTitle = extractDynamicTitle(blocks, meta);
  const cleanTitle = dynamicTitle.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 35);
  downloadFile(blob, `${cleanTitle}_${Date.now()}.md`);
}

/**
 * 4. Export as Clean Plain Text (.txt)
 */
export function exportToTxt(rawOutput, meta = {}) {
  const text = sanitizeText(rawOutput);
  const cleanText = text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^>\s+/gm, '')
    .replace(/^(---|===|\*\*\*|___|====+|----+)$/gm, '')
    .trim();

  const blob = new Blob([cleanText], { type: 'text/plain;charset=utf-8' });
  const blocks = parseMarkdownToBlocks(text);
  const dynamicTitle = extractDynamicTitle(blocks, meta);
  const cleanTitle = dynamicTitle.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 35);
  downloadFile(blob, `${cleanTitle}_${Date.now()}.txt`);
}
