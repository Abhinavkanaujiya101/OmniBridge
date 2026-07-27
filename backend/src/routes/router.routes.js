/**
 * OmniBridge Intent Router Routes
 * Mounts at: /api/v1/router
 */

'use strict';

const express = require('express');
const RouterController = require('../controllers/router.controller');

const router = express.Router();

// POST /api/v1/router/route        → Full classify + proxy pipeline
router.post('/route', RouterController.route);

// POST /api/v1/router/classify     → Intent classification only (no API call)
router.post('/classify', RouterController.classify);

// GET  /api/v1/router/matrix       → Inspect the full cost/performance matrix
router.get('/matrix', RouterController.getMatrix);

// POST /api/v1/router/dry-run      → Resolve route plan without executing call
router.post('/dry-run', RouterController.dryRun);

module.exports = router;
