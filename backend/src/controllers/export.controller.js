/**
 * OmniBridge Export Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * Serves completed task output as downloadable file streams.
 * All transforms happen in-memory — no disk writes.
 *
 * Endpoints (mounted at /api/v1/export):
 *   GET /pdf       ?taskId=<id>               → PDF download
 *   GET /code      ?taskId=<id>&language=<l>&blockIndex=<n>  → code file
 *   GET /markdown  ?taskId=<id>               → .md file
 *   GET /json      ?taskId=<id>               → application/json download
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const {
  generatePDFStream,
  generateCodeFileStream,
  generateMarkdownFileStream,
  parseRawOutput
} = require('../parsers/output.parser');
const { registry } = require('../websocket/task.registry');

class ExportController {

  /**
   * GET /api/v1/export/pdf?taskId=<id>&title=<optional>
   */
  static async exportPDF(req, res) {
    const { taskId, title } = req.query;

    const { task, output, error } = _resolveTaskOutput(taskId, res);
    if (error) return;

    try {
      const { stream, mimeType, filename } = generatePDFStream(output, {
        title: title || `OmniBridge — ${task.taskType}`,
        author: 'OmniBridge AI Gateway',
        taskType: task.taskType,
        provider: task.result?.targetProvider || task.provider
      });

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Task-Id', taskId);
      res.setHeader('X-Task-Type', task.taskType);

      stream.pipe(res);
      stream.on('error', (err) => {
        console.error('[ExportController] PDF stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'PDF generation failed.' });
        }
      });

    } catch (err) {
      console.error('[ExportController] PDF generation error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/export/code?taskId=<id>&language=<lang>&blockIndex=<n>&filename=<optional>
   */
  static async exportCode(req, res) {
    const { taskId, language, blockIndex = '0', filename } = req.query;

    const { task, output, error } = _resolveTaskOutput(taskId, res);
    if (error) return;

    try {
      const parsed = parseRawOutput(output);
      const idx = parseInt(blockIndex, 10) || 0;

      // Select the specific code block by index if available
      let targetOutput = output;
      let targetLanguage = language;

      if (parsed.codeBlocks.length > 0) {
        const block = parsed.codeBlocks[idx] || parsed.codeBlocks[0];
        targetOutput = block.code;
        targetLanguage = language || block.language;
      }

      const { stream, mimeType, filename: generatedFilename, byteLength } = generateCodeFileStream(
        targetOutput,
        { language: targetLanguage, filename }
      );

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${generatedFilename}"`);
      res.setHeader('Content-Length', byteLength);
      res.setHeader('X-Task-Id', taskId);
      res.setHeader('X-Code-Language', targetLanguage || 'unknown');

      stream.pipe(res);

    } catch (err) {
      console.error('[ExportController] Code export error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/export/markdown?taskId=<id>&filename=<optional>
   */
  static async exportMarkdown(req, res) {
    const { taskId, filename } = req.query;

    const { task, output, error } = _resolveTaskOutput(taskId, res);
    if (error) return;

    try {
      const { stream, mimeType, filename: generatedFilename } = generateMarkdownFileStream(output, { filename });

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${generatedFilename}"`);
      res.setHeader('X-Task-Id', taskId);

      stream.pipe(res);

    } catch (err) {
      console.error('[ExportController] Markdown export error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/export/json?taskId=<id>
   */
  static async exportJSON(req, res) {
    const { taskId } = req.query;

    const { task, output, error } = _resolveTaskOutput(taskId, res);
    if (error) return;

    try {
      const parsed = parseRawOutput(output);

      const payload = {
        taskId,
        taskType: task.taskType,
        provider: task.result?.targetProvider || task.provider,
        model: task.result?.targetModel || task.model,
        outputType: parsed.type,
        language: parsed.language,
        rawOutput: output,
        jsonPayload: parsed.content,
        codeBlocks: parsed.codeBlocks,
        sections: parsed.sections,
        usage: task.result?.usage || null,
        actualLatencyMs: task.result?.actualLatencyMs || null,
        exports: task.result?.exports || []
      };

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `omnibridge_${task.taskType.toLowerCase()}_${timestamp}.json`;

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Task-Id', taskId);

      res.json(payload);

    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/export/status?taskId=<id>
   * Returns current export availability for a task (non-streaming).
   */
  static async exportStatus(req, res) {
    const { taskId } = req.query;
    if (!taskId) return res.status(400).json({ success: false, error: 'taskId is required.' });

    const task = registry.getTask(taskId);
    if (!task) return res.status(404).json({ success: false, error: `Task ${taskId} not found.` });

    return res.json({
      success: true,
      taskId,
      status: task.status,
      taskType: task.taskType,
      provider: task.provider,
      model: task.model,
      progress: task.progress,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
      exportsAvailable: task.status === 'COMPLETED',
      exports: task.status === 'COMPLETED' ? (task.result?.exports || []) : [],
      error: task.error || null
    });
  }
}

// ─── Internal helper ──────────────────────────────────────────────────────────

function _resolveTaskOutput(taskId, res) {
  if (!taskId) {
    res.status(400).json({ success: false, error: 'taskId query parameter is required.' });
    return { error: true };
  }

  const task = registry.getTask(taskId);
  if (!task) {
    res.status(404).json({ success: false, error: `Task ${taskId} not found.` });
    return { error: true };
  }

  if (task.status !== 'COMPLETED') {
    res.status(409).json({
      success: false,
      error: `Task is not yet complete (current status: ${task.status}).`,
      status: task.status,
      progress: task.progress
    });
    return { error: true };
  }

  const output = task.result?.output;
  if (!output) {
    res.status(422).json({
      success: false,
      error: 'Task completed but produced no output to export.'
    });
    return { error: true };
  }

  return { task, output, error: false };
}

module.exports = ExportController;
