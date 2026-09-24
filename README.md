# OmniBridge 🌉
> Intelligent Multi-Provider AI Orchestration and High-Speed API Gateway

OmniBridge is a high-performance, real-time AI orchestration gateway designed to bridge multi-provider LLM and generative model APIs (**Groq Cloud**, **Google Gemini**, **OpenAI**, **Together AI**, and **Luma Dream Machine**) into a unified, low-latency streaming pipeline with PostgreSQL/Supabase persistence, dynamic intent routing, multi-format document export, and telemetry dashboarding.

---

## 🌟 Key Features

- **Dynamic Intent-Driven Routing**: Automatically classifies prompt intent (`TEXT`, `DOCUMENT_GENERATION`, `CODE`, `IMAGE_GENERATION`, `VIDEO_GENERATION`) and routes to the fastest, most cost-effective model in sub-500ms.
- **Ultra-Fast Inference**: Integrated with Groq LPU hardware (`qwen/qwen3.8-27b`, `openai/gpt-oss-20b`) for sub-second text completions and fast document synthesis.
- **Multi-Format Document Generation & Export**: Generate structured documents and export directly to **PDF (.pdf)**, **Word (.docx)**, **Markdown (.md)**, or **JSON**.
- **Real-Time Streaming**: High-throughput WebSocket server (`ws`) with non-blocking event-loop task processing (`setImmediate`).
- **Resilient Fallback Chains**: Seamless automatic fallbacks across providers with exponential backoff on HTTP 429 rate limits and fail-fast network protection.
- **Live Telemetry & Dashboard**: Interactive Next.js 14 console tracking token count, model latency, active connection status, and model capabilities.

---

## 📁 Repository Architecture

```
OmniBridge/
├── backend/                  # Node.js / Express Gateway API & WebSocket Streaming Server
│   ├── src/
│   │   ├── config/           # Centralized environment loader & DB setup
│   │   ├── controllers/      # API Controllers (gateway, router, export)
│   │   ├── routes/           # REST endpoints (/api/v1/gateway, /api/v1/router, /api/v1/export)
│   │   ├── services/         # Providers (Groq, Gemini, OpenAI, Together, Luma) & routing matrix
│   │   ├── parsers/          # Multi-provider stream & document export parsers
│   │   └── websocket/        # Real-time WebSocket connection & async task registry
│   ├── package.json
│   └── server.js
│
├── frontend/                 # Next.js 14 App Router Console
│   ├── src/
│   │   ├── app/              # Dashboard pages & global styles
│   │   ├── components/       # GatewayConsole, ProviderSelector, MetricsCard, TelemetryBadge
│   │   ├── hooks/            # useOmniWebSocket streaming hook
│   │   └── lib/              # Axios client & client-side document exporters
│   ├── package.json
│   └── tailwind.config.js
│
├── .env.example              # Centralized environment template
├── package.json              # Monorepo task runner
└── README.md
```

---

## 🚀 Quick Start

### 1. Environment Setup
Copy the centralized `.env.example` template into `.env` and add your API keys:
```bash
cp .env.example .env
```
*(The backend automatically loads this root `.env` file directly).*

### 2. Install Dependencies
```bash
# Install root, backend, and frontend packages
npm run install:all
```

### 3. Run Development Stack
```bash
# Run both Backend (Port 5000) and Frontend (Port 3000) concurrently
npm run dev
```

- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Health Check**: [http://localhost:5000/api/v1/gateway/health](http://localhost:5000/api/v1/gateway/health)
- **WebSocket Endpoint**: `ws://localhost:5000`

---

## 🎯 Routing Matrix & Supported Providers

| Task Type | Primary Route | Fallback Providers | Typical Latency |
| :--- | :--- | :--- | :--- |
| **TEXT** | `groq / qwen/qwen3.8-27b` | Gemini 3.6 Flash, GPT-4o-mini | ~300 – 500 ms |
| **CODE** | `groq / qwen/qwen3.8-27b` | Gemini 3.6 Flash, GPT-4o-mini | ~350 – 800 ms |
| **DOCUMENT_GENERATION** | `groq / qwen/qwen3.8-27b` | Gemini 3.6 Flash, GPT-4o-mini | ~2.0 – 2.8 s |
| **IMAGE_GENERATION** | `together / FLUX.1-schnell` | FLUX.1.1-pro, Stable Diffusion XL | ~4.0 – 7.0 s |
| **VIDEO_GENERATION** | `luma / dream-machine` | Luma Ray-1 | ~30 – 45 s |

---

## 🔌 API Reference

### REST Endpoints
- `GET /api/v1/gateway/health` — System status and version health check
- `GET /api/v1/router/matrix` — Current active routing matrix and model capabilities
- `POST /api/v1/router/classify` — Classify prompt intent without executing
- `POST /api/v1/router/route` — Dynamically route prompt and return completion with telemetry
- `POST /api/v1/gateway/completion` — Direct manual completion with selected provider
- `GET /api/v1/export/pdf?taskId=<id>` — Export document as publication-ready PDF
- `GET /api/v1/export/markdown?taskId=<id>` — Export document as Markdown file
- `GET /api/v1/export/code?taskId=<id>&language=<lang>` — Export generated code file

### WebSocket Protocol (`ws://localhost:5000`)
- `{"action": "ping"}` → `{"type": "PONG"}`
- `{"action": "stream_prompt", "prompt": "..."}` → Real-time chunked token streaming
- `{"action": "submit_task", "prompt": "..."}` → Async background job with status events (`QUEUED` → `PROCESSING` → `COMPLETED`)
- `{"action": "list_tasks"}` → Snapshot of active tasks in registry

---

## 🛡️ License
MIT © OmniBridge Engineering Team
