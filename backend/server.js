const http = require('http');
const express = require('express');
const cors = require('cors');
const config = require('./src/config/env');
const gatewayRoutes = require('./src/routes/gateway.routes');
const routerRoutes = require('./src/routes/router.routes');
const exportRoutes = require('./src/routes/export.routes');
const { initWebSocketServer } = require('./src/websocket/stream.handler');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API V1 Routes
app.use('/api/v1/gateway', gatewayRoutes);
app.use('/api/v1/router', routerRoutes);
app.use('/api/v1/export', exportRoutes);

// Root fallback
app.get('/', (req, res) => {
  res.json({
    name: 'OmniBridge AI Gateway Server',
    status: 'operational',
    routes: {
      gateway: '/api/v1/gateway/health',
      intentRouter: '/api/v1/router/matrix',
      classify: 'POST /api/v1/router/classify',
      route: 'POST /api/v1/router/route',
      dryRun: 'POST /api/v1/router/dry-run',
      exportStatus: 'GET /api/v1/export/status?taskId=<id>',
      exportPDF: 'GET /api/v1/export/pdf?taskId=<id>',
      exportCode: 'GET /api/v1/export/code?taskId=<id>&language=<lang>',
      exportMarkdown: 'GET /api/v1/export/markdown?taskId=<id>',
      exportJSON: 'GET /api/v1/export/json?taskId=<id>'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[ServerError]', err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message
  });
});

// Initialize WebSocket Server attached to HTTP Server
initWebSocketServer(server);

// Start HTTP & WS Server
server.listen(config.port, () => {
  console.log(`
  ======================================================
  🌉 OmniBridge API Gateway & WebSocket Server Started
  ======================================================
  HTTP Server   : http://localhost:${config.port}
  Health Check  : http://localhost:${config.port}/api/v1/gateway/health
  Intent Router : http://localhost:${config.port}/api/v1/router/matrix
  Export API    : http://localhost:${config.port}/api/v1/export/status
  WS Endpoint   : ws://localhost:${config.port}
  Environment   : ${config.env}
  ======================================================
  `);
});
