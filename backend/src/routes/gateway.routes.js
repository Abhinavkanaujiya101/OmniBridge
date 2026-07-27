const express = require('express');
const GatewayController = require('../controllers/gateway.controller');

const router = express.Router();

// Gateway endpoints
router.get('/health', GatewayController.healthCheck);
router.get('/providers', GatewayController.getProviders);
router.post('/completion', GatewayController.processCompletion);

module.exports = router;
