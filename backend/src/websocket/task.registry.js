/**
 * OmniBridge Async Task Registry
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the full lifecycle of long-running background tasks (image rendering,
 * video generation, LLM completions) without blocking the HTTP event loop.
 *
 * Lifecycle states:
 *   QUEUED → PROCESSING → PARSING → COMPLETED
 *                       ↘ FAILED  (at any stage)
 *
 * Each task has a subscriber list of WebSocket clients who receive real-time
 * status broadcast events as the task progresses.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { EventEmitter } = require('events');
const { randomUUID } = require('crypto');

/** @typedef {'QUEUED'|'PROCESSING'|'PARSING'|'COMPLETED'|'FAILED'} TaskStatus */

/**
 * @typedef {Object} TaskRecord
 * @property {string}       id
 * @property {TaskStatus}   status
 * @property {string}       taskType        - Classified intent type (TEXT, CODE, IMAGE_GENERATION…)
 * @property {string}       provider
 * @property {string}       model
 * @property {string}       prompt
 * @property {number}       createdAt       - Unix ms timestamp
 * @property {number|null}  startedAt
 * @property {number|null}  completedAt
 * @property {any}          result          - Final output payload
 * @property {string|null}  error
 * @property {number}       progress        - 0–100
 * @property {Set<WebSocket>} subscribers   - Live WS connections watching this task
 */

class TaskRegistry extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, TaskRecord>} */
    this._tasks = new Map();

    // Auto-purge completed/failed tasks older than 30 minutes
    this._purgeInterval = setInterval(() => this._purgeExpired(), 10 * 60 * 1000);
  }

  // ─── Task Lifecycle ─────────────────────────────────────────────────────────

  /**
   * Create and enqueue a new background task.
   * @param {{ taskType, provider, model, prompt, meta? }} opts
   * @returns {TaskRecord}
   */
  enqueue({ taskType, provider, model, prompt, meta = {} }) {
    const id = randomUUID();
    const now = Date.now();

    /** @type {TaskRecord} */
    const record = {
      id,
      status: 'QUEUED',
      taskType,
      provider,
      model,
      prompt,
      meta,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
      progress: 0,
      subscribers: new Set()
    };

    this._tasks.set(id, record);
    this._broadcast(record, 'QUEUED', { message: 'Task queued and awaiting execution.' });
    this.emit('task:queued', record);

    console.log(`[TaskRegistry] Queued task ${id} (${taskType}/${provider})`);
    return record;
  }

  /**
   * Mark task as PROCESSING (execution started).
   */
  markProcessing(id, { message = 'Executing provider request…', progress = 5 } = {}) {
    const record = this._get(id);
    record.status = 'PROCESSING';
    record.startedAt = Date.now();
    record.progress = progress;
    this._broadcast(record, 'PROCESSING', { message, progress });
    this.emit('task:processing', record);
  }

  /**
   * Push an incremental progress update without changing status.
   */
  updateProgress(id, progress, message = '') {
    const record = this._get(id);
    record.progress = Math.min(Math.max(progress, 0), 99);
    this._broadcast(record, record.status, { message, progress: record.progress });
  }

  /**
   * Mark task as PARSING (raw output received, transformation in progress).
   */
  markParsing(id, { message = 'Parsing and transforming output…', progress = 75 } = {}) {
    const record = this._get(id);
    record.status = 'PARSING';
    record.progress = progress;
    this._broadcast(record, 'PARSING', { message, progress });
    this.emit('task:parsing', record);
  }

  /**
   * Mark task as COMPLETED with final result payload.
   */
  markCompleted(id, result) {
    const record = this._get(id);
    record.status = 'COMPLETED';
    record.result = result;
    record.completedAt = Date.now();
    record.progress = 100;

    const durationMs = record.startedAt ? record.completedAt - record.startedAt : null;

    this._broadcast(record, 'COMPLETED', {
      message: 'Task completed successfully.',
      result,
      progress: 100,
      durationMs
    });

    this.emit('task:completed', record);
    console.log(`[TaskRegistry] Completed task ${id} in ${durationMs ?? '?'}ms`);
  }

  /**
   * Mark task as FAILED with error details.
   */
  markFailed(id, error, errorCode = 'TASK_ERROR') {
    const record = this._get(id);
    record.status = 'FAILED';
    record.error = typeof error === 'string' ? error : error?.message || 'Unknown error';
    record.completedAt = Date.now();

    this._broadcast(record, 'FAILED', {
      message: `Task failed: ${record.error}`,
      error: record.error,
      errorCode
    });

    this.emit('task:failed', record);
    console.error(`[TaskRegistry] Task ${id} FAILED: ${record.error}`);
  }

  // ─── Subscriber Management ──────────────────────────────────────────────────

  /**
   * Subscribe a WebSocket connection to updates for a specific task.
   * Immediately sends the current task state to the new subscriber.
   * @param {string} taskId
   * @param {import('ws').WebSocket} ws
   */
  subscribe(taskId, ws) {
    const record = this._tasks.get(taskId);
    if (!record) {
      _sendWs(ws, _frame({
        type: 'ERROR',
        message: `No task found with ID: ${taskId}`,
        taskId
      }));
      return false;
    }

    record.subscribers.add(ws);

    // Send current snapshot immediately
    _sendWs(ws, _frame({
      type: 'TASK_SNAPSHOT',
      taskId: record.id,
      status: record.status,
      taskType: record.taskType,
      provider: record.provider,
      model: record.model,
      progress: record.progress,
      createdAt: record.createdAt,
      result: record.status === 'COMPLETED' ? record.result : undefined,
      error: record.error || undefined
    }));

    // Auto-remove subscriber on WS close
    ws.once('close', () => {
      record.subscribers.delete(ws);
    });

    console.log(`[TaskRegistry] WS subscribed to task ${taskId} (${record.subscribers.size} subs)`);
    return true;
  }

  /**
   * Unsubscribe a WebSocket from all tasks it's watching.
   */
  unsubscribeAll(ws) {
    for (const record of this._tasks.values()) {
      record.subscribers.delete(ws);
    }
  }

  // ─── Query ──────────────────────────────────────────────────────────────────

  getTask(id) {
    return this._tasks.get(id) || null;
  }

  listTasks({ status, limit = 50 } = {}) {
    const entries = [...this._tasks.values()];
    const filtered = status ? entries.filter(t => t.status === status) : entries;
    return filtered
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map(this._serialize);
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  _get(id) {
    const record = this._tasks.get(id);
    if (!record) throw new Error(`Task ${id} not found in registry`);
    return record;
  }

  /**
   * Broadcast a status event to all subscribers of a task.
   */
  _broadcast(record, eventType, extra = {}) {
    if (!record.subscribers || record.subscribers.size === 0) return;

    const packet = _frame({
      type: 'TASK_EVENT',
      event: eventType,
      taskId: record.id,
      taskType: record.taskType,
      provider: record.provider,
      model: record.model,
      status: record.status,
      ...extra
    });

    for (const ws of record.subscribers) {
      _sendWs(ws, packet);
    }
  }

  _serialize(record) {
    const { subscribers, ...rest } = record;
    return { ...rest, subscriberCount: subscribers.size };
  }

  _purgeExpired() {
    const THIRTY_MIN = 30 * 60 * 1000;
    const now = Date.now();
    let purged = 0;
    for (const [id, record] of this._tasks.entries()) {
      const isTerminal = record.status === 'COMPLETED' || record.status === 'FAILED';
      if (isTerminal && record.completedAt && now - record.completedAt > THIRTY_MIN) {
        this._tasks.delete(id);
        purged++;
      }
    }
    if (purged > 0) {
      console.log(`[TaskRegistry] Purged ${purged} expired task(s).`);
    }
  }

  destroy() {
    clearInterval(this._purgeInterval);
  }
}

// ─── Internal helpers (module-scoped) ────────────────────────────────────────

function _frame(payload) {
  return JSON.stringify({
    gateway: 'OmniBridge',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    ...payload
  });
}

function _sendWs(ws, data) {
  try {
    if (ws && ws.readyState === 1 /* OPEN */) {
      ws.send(data);
    }
  } catch (e) {
    // Client disconnected mid-send — silently swallow
  }
}

// Export a singleton so the registry is shared across all modules
const registry = new TaskRegistry();

module.exports = { registry, TaskRegistry };
