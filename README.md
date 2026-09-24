# OmniBridge 🌉
> Intelligent Multi-Provider AI Orchestration & High-Speed API Gateway

OmniBridge is a high-performance AI orchestration gateway that bridges multiple LLM and generative model providers (**Groq Cloud**, **Google Gemini**, **OpenAI**, **Together AI**, and **Luma Dream Machine**) into a unified, low-latency streaming pipeline with PostgreSQL/Supabase persistence, dynamic intent routing, multi-format document export, and real-time telemetry.

---

## 🌟 Key Features

- **Sub-500ms Dynamic Routing**: Automatically classifies prompt intent (`TEXT`, `DOCUMENT_GENERATION`, `CODE`, `IMAGE_GENERATION`, `VIDEO_GENERATION`) and routes to the fastest, most cost-effective model.
- **Groq LPU Acceleration**: Leverages ultra-fast LPU inference (`qwen/qwen3.8-27b`, `openai/gpt-oss-20b`) for sub-second text completions and fast document synthesis.
- **Multi-Format Document Export**: Generates structured reports with instant export to **PDF (.pdf)**, **Word (.docx)**, **Markdown (.md)**, and **JSON**.
- **Real-Time Streaming**: Native WebSocket pipeline (`ws`) with non-blocking event-loop task processing (`setImmediate`).
- **Resilient Fallback Chains**: Automatic provider fallback on HTTP 429 rate limits, credit exhaustion, or upstream timeouts.
- **Interactive Telemetry Dashboard**: Dark glassmorphic Next.js 14 console displaying live token counters, model latency, and connection states.

---

## 🚀 Quick Start

### 📋 Prerequisites
- **Node.js**: `v18.18.0` or higher (`v20.x` or `v22.x` recommended) — [Download](https://nodejs.org/)
- **npm**: `v9.0.0` or higher
- **Git**
- **AI Provider Key**: At least one active API key (e.g. **Groq Cloud** for free high-speed LPU inference, **Google Gemini**, or **OpenAI**)

### 1. Clone & Configure Environment
```bash
git clone https://github.com/Abhinavkanaujiya101/OmniBridge.git
cd OmniBridge

# Copy centralized environment template
cp .env.example .env
```
Add your API keys to `.env` (the backend automatically resolves this root file).

### 2. Install Dependencies
```bash
# Installs root orchestrator, backend server, and frontend web dependencies
npm run install:all
```
*(Or install individually: `npm install`, `npm install --prefix backend`, `npm install --prefix frontend`)*.

### 3. Run Development Stack
```bash
# Runs Backend (Port 5000) and Frontend (Port 3000) concurrently
npm run dev
```

| Service | URL |
| :--- | :--- |
| **Frontend Console** | [http://localhost:3000](http://localhost:3000) |
| **Backend REST API** | [http://localhost:5000](http://localhost:5000) |
| **Health Check** | [http://localhost:5000/api/v1/gateway/health](http://localhost:5000/api/v1/gateway/health) |
| **WebSocket Stream** | `ws://localhost:5000` |

---

## 🎯 Routing Matrix & Models

| Task Type | Primary Model | Fallback Chain | Avg Latency |
| :--- | :--- | :--- | :--- |
| **TEXT** | `groq / qwen/qwen3.8-27b` | Gemini 3.6 Flash, GPT-4o-mini | ~300 – 500 ms |
| **CODE** | `groq / qwen/qwen3.8-27b` | Gemini 3.6 Flash, GPT-4o-mini | ~350 – 800 ms |
| **DOCUMENT_GENERATION** | `groq / qwen/qwen3.8-27b` | Gemini 3.6 Flash, GPT-4o-mini | ~2.0 – 2.8 s |
| **IMAGE_GENERATION** | `together / FLUX.1-schnell` | FLUX.1.1-pro, Stable Diffusion XL | ~4.0 – 7.0 s |
| **VIDEO_GENERATION** | `luma / dream-machine` | Luma Ray-1 | ~30 – 45 s |

---

## 📦 Technology Stack & Core Packages

OmniBridge isolates concerns across dedicated subprojects:

| Scope | Key Technologies & Packages | Purpose |
| :--- | :--- | :--- |
| **Root** | `concurrently` | Concurrent task runner for multi-process dev servers |
| **Backend** | `express`, `ws`, `socket.io` | High-throughput REST API & real-time WebSocket server |
| | `axios`, `dotenv`, `cors` | Upstream AI provider dispatch & multi-path configuration |
| | `pdfkit`, `@supabase/supabase-js`, `pg` | Document synthesis & PostgreSQL/Supabase persistence |
| | `lumaai`, `nodemon` | Luma Dream Machine SDK & hot-reloading development server |
| **Frontend** | `next` (14 App Router), `react`, `react-dom` | Server-rendered React web dashboard |
| | `tailwindcss`, `postcss`, `autoprefixer` | Dark-mode glassmorphic design system |
| | `jspdf`, `docx` | Client-side export for publication-ready PDF & Word files |
| | `lucide-react`, `socket.io-client` | Vector UI icons & WebSocket event transport |

---

## 📁 Repository Structure

```
OmniBridge/
├── backend/                  # Node.js / Express API & WebSocket Server
│   ├── src/
│   │   ├── config/           # Centralized environment loader & DB setup
│   │   ├── controllers/      # API Controllers (gateway, router, export)
│   │   ├── routes/           # REST endpoints (/gateway, /router, /export)
│   │   ├── services/         # Providers (Groq, Gemini, OpenAI, Together, Luma) & routing matrix
│   │   ├── parsers/          # Stream & document export parsers
│   │   └── websocket/        # Real-time WebSocket handler & async task registry
│   ├── package.json
│   └── server.js
│
├── frontend/                 # Next.js 14 App Router Dashboard
│   ├── src/
│   │   ├── app/              # Dashboard layout, pages, and CSS
│   │   ├── components/       # GatewayConsole, ProviderSelector, MetricsCard, TelemetryBadge
│   │   ├── hooks/            # useOmniWebSocket streaming hook
│   │   └── lib/              # API client & document exporters (PDF, DOCX)
│   ├── package.json
│   └── tailwind.config.js
│
├── .env.example              # Centralized environment variable template
├── package.json              # Monorepo runner
└── README.md
```

---

## 🔌 API & WebSocket Reference

### REST Endpoints
- `GET /api/v1/gateway/health` — Gateway status and version check
- `GET /api/v1/router/matrix` — Active routing matrix rules and model capabilities
- `POST /api/v1/router/classify` — Classify prompt intent without executing API call
- `POST /api/v1/router/route` — Dynamically route prompt and return completion with telemetry
- `POST /api/v1/gateway/completion` — Direct completion bypassing the router (manual provider mode)
- `GET /api/v1/export/pdf?taskId=<id>` — Export document as PDF
- `GET /api/v1/export/markdown?taskId=<id>` — Export document as Markdown (.md)
- `GET /api/v1/export/code?taskId=<id>&language=<lang>` — Export generated code file

### WebSocket Protocol (`ws://localhost:5000`)
- `{"action": "ping"}` → `{"type": "PONG"}`
- `{"action": "stream_prompt", "prompt": "..."}` → Real-time chunked token streaming
- `{"action": "submit_task", "prompt": "..."}` → Async background job with status events (`QUEUED` → `PROCESSING` → `COMPLETED`)
- `{"action": "list_tasks"}` → Snapshot of active tasks in registry

---

## 🛡️ License
MIT © OmniBridge Engineering Team
