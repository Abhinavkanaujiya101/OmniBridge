/**
 * OmniBridge WebSocket Event Stream Handler — Async Pipeline
 * ─────────────────────────────────────────────────────────────────────────────
 * Architecture:
 *
 *   HTTP Server (Express)
 *        │
 *        └── ws.Server (shared HTTP upgrade)
 *               │
 *    ┌──────────┴────────────────────────────────────────────┐
 *    │           WebSocket Connection Handler                 │
 *    │  ┌──────────────────────────────────────────────┐     │
 *    │  │   Action Dispatcher                          │     │
 *    │  │   ├── ping              → PONG               │     │
 *    │  │   ├── stream_prompt     → token-stream       │     │
 *    │  │   ├── submit_task       → async pipeline     │     │
 *    │  │   │    └── [QUEUED → PROCESSING → PARSING    │     │
 *    │  │   │             → COMPLETED / FAILED]        │     │
 *    │  │   ├── subscribe_task    → join task channel  │     │
 *    │  │   ├── unsubscribe_task  → leave task channel │     │
 *    │  │   ├── list_tasks        → registry snapshot  │     │
 *    │  │   └── get_task          → single task state  │     │
 *    │  └──────────────────────────────────────────────┘     │
 *    └───────────────────────────────────────────────────────┘
 *
 * Non-blocking guarantee:
 *   All long-running work (LLM calls, rendering) is dispatched via
 *   setImmediate → never inside await in the message handler itself.
 *   The message handler returns instantly; work runs in the background.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const WebSocket = require('ws');
const { parseStreamChunk, formatGatewayPacket } = require('../parsers/stream.parser');
const { parseRawOutput, extractCodeBlocks, extractJSON } = require('../parsers/output.parser');
const { routeIntent } = require('../services/intent.router');
const ProviderService = require('../services/provider.service');
const { registry } = require('./task.registry');

// ─── Supported Actions ────────────────────────────────────────────────────────

const ACTIONS = {
  PING: 'ping',
  STREAM_PROMPT: 'stream_prompt',     // Synchronous token stream
  SUBMIT_TASK: 'submit_task',         // Async background pipeline
  SUBSCRIBE_TASK: 'subscribe_task',   // Join a task's event channel
  UNSUBSCRIBE_TASK: 'unsubscribe_task',
  LIST_TASKS: 'list_tasks',
  GET_TASK: 'get_task'
};

// ─── Server Initializer ───────────────────────────────────────────────────────

/**
 * Attach a WebSocket.Server to an existing HTTP server.
 * Returns the wss instance (for external inspection/testing).
 *
 * @param {import('http').Server} server
 * @returns {WebSocket.Server}
 */
function initWebSocketServer(server) {
  const wss = new WebSocket.Server({ server, path: undefined /* accept all paths */ });

  console.log('[WS] OmniBridge async WebSocket pipeline attached to HTTP server.');

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    const connectedAt = Date.now();
    console.log(`[WS] Client connected: ${clientIp}`);

    // ── Greeting ────────────────────────────────────────────────────────────
    send(ws, {
      type: 'CONNECTED',
      message: 'Connected to OmniBridge WebSocket Pipeline',
      supportedActions: Object.values(ACTIONS),
      timestamp: new Date().toISOString()
    });

    // ── Message handler ──────────────────────────────────────────────────────
    ws.on('message', (raw) => {
      let payload;
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        return send(ws, {
          type: 'ERROR',
          code: 'INVALID_JSON',
          message: 'Message must be valid JSON.'
        });
      }

      const { action, requestId } = payload;

      // Attach requestId to all replies for client-side correlation
      const reply = (data) => send(ws, { ...data, requestId: requestId || null });

      // Dispatch — all handlers are non-blocking
      switch (action) {

        case ACTIONS.PING:
          reply({ type: 'PONG', timestamp: new Date().toISOString() });
          break;

        case ACTIONS.STREAM_PROMPT:
          // Kick off in next tick — non-blocking
          setImmediate(() => handleStreamPrompt(ws, payload, reply));
          break;

        case ACTIONS.SUBMIT_TASK:
          setImmediate(() => handleSubmitTask(ws, payload, reply));
          break;

        case ACTIONS.SUBSCRIBE_TASK: {
          const { taskId } = payload;
          if (!taskId) return reply({ type: 'ERROR', code: 'MISSING_FIELD', message: 'taskId is required.' });
          const ok = registry.subscribe(taskId, ws);
          if (!ok) reply({ type: 'ERROR', code: 'TASK_NOT_FOUND', message: `Task ${taskId} not found.` });
          else reply({ type: 'SUBSCRIBED', taskId });
          break;
        }

        case ACTIONS.UNSUBSCRIBE_TASK: {
          const { taskId } = payload;
          if (!taskId) return reply({ type: 'ERROR', code: 'MISSING_FIELD', message: 'taskId is required.' });
          const rec = registry.getTask(taskId);
          if (rec) rec.subscribers.delete(ws);
          reply({ type: 'UNSUBSCRIBED', taskId: taskId || null });
          break;
        }

        case ACTIONS.LIST_TASKS: {
          const { status, limit } = payload;
          const tasks = registry.listTasks({ status, limit });
          reply({ type: 'TASK_LIST', tasks, count: tasks.length });
          break;
        }

        case ACTIONS.GET_TASK: {
          const { taskId } = payload;
          if (!taskId) return reply({ type: 'ERROR', code: 'MISSING_FIELD', message: 'taskId is required.' });
          const task = registry.getTask(taskId);
          if (!task) return reply({ type: 'ERROR', code: 'TASK_NOT_FOUND', message: `Task ${taskId} not found.` });
          const { subscribers, ...safe } = task;
          reply({ type: 'TASK_STATE', task: safe });
          break;
        }

        default:
          reply({
            type: 'ERROR',
            code: 'UNKNOWN_ACTION',
            message: `Unknown action "${action}". Supported: ${Object.values(ACTIONS).join(', ')}`
          });
      }
    });

    // ── Cleanup on disconnect ────────────────────────────────────────────────
    ws.on('close', (code, reason) => {
      registry.unsubscribeAll(ws);
      const sessionMs = Date.now() - connectedAt;
      console.log(`[WS] Client disconnected: ${clientIp} (session: ${sessionMs}ms, code: ${code})`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Socket error from ${clientIp}:`, err.message);
    });
  });

  return wss;
}

// ─── Action: stream_prompt ────────────────────────────────────────────────────

/**
 * Classic synchronous token stream — simulates real-time typing for text/code/math tasks.
 * Intended for short, interactive prompt-response cycles.
 */
async function handleStreamPrompt(ws, payload, reply) {
  const { provider = 'gemini', model, prompt, temperature = 0.7, useRouter = false } = payload;

  if (!prompt || !prompt.trim()) {
    return reply({ type: 'ERROR', code: 'MISSING_FIELD', message: 'prompt is required.' });
  }

  reply({
    type: 'STREAM_START',
    provider,
    model: model || 'auto',
    timestamp: new Date().toISOString()
  });

  try {
    let result;

    if (useRouter) {
      // Use the intent router for automatic provider selection
      const routed = await routeIntent({ prompt, temperature });
      result = { output: routed.output, usage: routed.usage, provider: routed.targetProvider, model: routed.targetModel };
    } else {
      result = await ProviderService.generateCompletion({ provider, model, prompt, temperature });
    }

    const outputText = result.output || '';

    // ── Parse the output in parallel with streaming ─────────────────────────
    const parsed = parseRawOutput(outputText);

    // Stream tokens with fluid chunk delays
    const chunkSize = 8;
    for (let i = 0; i < outputText.length; i += chunkSize) {
      if (ws.readyState !== WebSocket.OPEN) break;
      const token = outputText.slice(i, i + chunkSize);
      send(ws, {
        type: 'TOKEN',
        provider: result.provider || provider,
        token,
        index: Math.floor(i / chunkSize)
      });
      await delay(18);
    }

    reply({
      type: 'STREAM_END',
      provider: result.provider || provider,
      model: result.model || model,
      usage: result.usage || null,
      outputType: parsed.type,
      language: parsed.language,
      codeBlockCount: parsed.codeBlocks.length,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    reply({
      type: 'ERROR',
      code: 'STREAM_FAILED',
      message: err.message || 'Streaming request failed.',
      timestamp: new Date().toISOString()
    });
  }
}

// ─── Action: submit_task ─────────────────────────────────────────────────────

/**
 * Async background task pipeline for long-running jobs.
 * Works for any task type. Long-running jobs (IMAGE, VIDEO) are fully
 * non-blocking — the HTTP event loop is never held.
 *
 * Lifecycle broadcast sequence:
 *   QUEUED → (subscribed WS clients) → PROCESSING → PARSING → COMPLETED | FAILED
 */
async function handleSubmitTask(ws, payload, reply) {
  const {
    prompt,
    temperature = 0.7,
    preferHighQuality = false,
    outputFormat = 'json'   // 'json' | 'pdf' | 'code' | 'markdown'
  } = payload;

  if (!prompt || !prompt.trim()) {
    return reply({ type: 'ERROR', code: 'MISSING_FIELD', message: 'prompt is required for submit_task.' });
  }

  // ── Step 1: Classify intent synchronously (zero latency) ──────────────────
  const { classifyIntent } = require('../services/intent.classifier');
  const { resolveRoute } = require('../services/routing.matrix');

  const cls = classifyIntent(prompt);
  const route = resolveRoute(cls.taskType, { preferHighQuality });
  const primary = route.primary;

  // ── Step 2: Enqueue task in registry ───────────────────────────────────────
  const task = registry.enqueue({
    taskType: cls.taskType,
    provider: primary?.provider || 'gemini',
    model: primary?.model || 'gemini-1.5-flash',
    prompt,
    meta: { outputFormat, confidence: cls.confidence, classificationMethod: cls.method }
  });

  // Auto-subscribe the requesting client to this task
  registry.subscribe(task.id, ws);

  // Immediately acknowledge to the requesting client
  reply({
    type: 'TASK_ACCEPTED',
    taskId: task.id,
    taskType: cls.taskType,
    provider: primary?.provider,
    model: primary?.model,
    estimatedLatencyMs: primary?.estimatedLatencyMs,
    confidence: cls.confidence,
    message: `Task ${task.id} queued. You are subscribed to live status updates.`
  });

  // ── Step 3: Execute in background (non-blocking via setImmediate) ──────────
  setImmediate(async () => {
    try {
      // PROCESSING: start provider call
      registry.markProcessing(task.id, { message: `Calling ${task.provider}/${task.model}…`, progress: 10 });

      // Simulate incremental progress for long tasks (IMAGE/VIDEO)
      const isLong = ['IMAGE_GENERATION', 'VIDEO_GENERATION'].includes(cls.taskType);
      let progressTimer = null;
      if (isLong) {
        let prog = 15;
        progressTimer = setInterval(() => {
          prog = Math.min(prog + 8, 70);
          registry.updateProgress(task.id, prog, 'Provider processing request…');
        }, 4000);
      }

      const routed = await routeIntent({ prompt, temperature, preferHighQuality });

      if (progressTimer) clearInterval(progressTimer);

      if (!routed.success) {
        return registry.markFailed(task.id, routed.error || 'Provider returned failure', routed.errorCode);
      }

      // PARSING: transform raw output
      registry.markParsing(task.id, { message: 'Parsing and structuring output…', progress: 80 });
      await delay(60); // Give subscribers a render beat

      const rawOutput = routed.output || '';
      const parsed = parseRawOutput(rawOutput);
      const codeBlocks = extractCodeBlocks(rawOutput);
      const jsonPayload = extractJSON(rawOutput);

      registry.updateProgress(task.id, 92, 'Finalizing output…');
      await delay(40);

      // COMPLETED: emit structured result
      registry.markCompleted(task.id, {
        output: rawOutput,
        outputType: parsed.type,
        language: parsed.language,
        codeBlocks: codeBlocks.map(b => ({ language: b.language, byteLength: b.code.length })),
        jsonPayload,
        sectionCount: parsed.sections.length,
        taskType: routed.taskType,
        targetModel: routed.targetModel,
        targetProvider: routed.targetProvider,
        estimatedLatency: routed.estimatedLatency,
        actualLatencyMs: routed.actualLatencyMs,
        usage: routed.usage || null,
        fallbacksAttempted: routed.fallbacksAttempted || [],
        // Export hints for the client to call /api/v1/export/*
        exports: buildExportHints(task.id, routed.taskType, parsed)
      });

    } catch (err) {
      console.error(`[WS Pipeline] Task ${task.id} threw:`, err);
      registry.markFailed(task.id, err.message || 'Unexpected pipeline error', 'PIPELINE_ERROR');
    }
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build export hint objects the frontend can use to construct download URLs.
 */
function buildExportHints(taskId, taskType, parsed) {
  const hints = [];

  hints.push({
    format: 'pdf',
    label: 'Download as PDF',
    url: `/api/v1/export/pdf?taskId=${taskId}`,
    mimeType: 'application/pdf'
  });

  if (parsed.codeBlocks.length > 0) {
    for (const [i, block] of parsed.codeBlocks.entries()) {
      const lang = block.language || 'txt';
      hints.push({
        format: 'code',
        language: lang,
        label: `Download ${lang.toUpperCase()} file`,
        url: `/api/v1/export/code?taskId=${taskId}&language=${lang}&blockIndex=${i}`,
        mimeType: `text/x-${lang}`
      });
    }
  }

  if (parsed.type === 'markdown' || parsed.sections.length > 0) {
    hints.push({
      format: 'markdown',
      label: 'Download as Markdown',
      url: `/api/v1/export/markdown?taskId=${taskId}`,
      mimeType: 'text/markdown'
    });
  }

  return hints;
}

function send(ws, data) {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(formatGatewayPacket(data));
    }
  } catch (_) {}
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { initWebSocketServer };
