/**
 * OmniBridge Export Routes
 * Mounted at: /api/v1/export
 */

'use strict';

const express = require('express');
const ExportController = require('../controllers/export.controller');

const router = express.Router();

// GET /api/v1/export/status?taskId=<id>     → Check task completion & export availability
router.get('/status',   ExportController.exportStatus);

// GET /api/v1/export/pdf?taskId=<id>        → Stream PDF download (in-memory, no disk write)
router.get('/pdf',      ExportController.exportPDF);

// GET /api/v1/export/code?taskId=<id>&language=<lang>&blockIndex=<n>  → Stream code file
router.get('/code',     ExportController.exportCode);

// GET /api/v1/export/markdown?taskId=<id>   → Stream .md file
router.get('/markdown', ExportController.exportMarkdown);

// GET /api/v1/export/json?taskId=<id>       → Full structured JSON payload
router.get('/json',     ExportController.exportJSON);

module.exports = router;
