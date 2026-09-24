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

## 📦 Dependencies & Technology Stack

OmniBridge is structured as an isolated multi-package repository. Each subproject maintains its own focused dependency tree:

### 1. Root Workspace Orchestrator
| Package | Version | Purpose |
| :--- | :--- | :--- |
| [`concurrently`](https://www.npmjs.com/package/concurrently) | `^8.2.2` | Runs both backend and frontend development servers concurrently in a single terminal via `npm run dev` |

---

### 2. Backend Gateway & Streaming Server (`backend/package.json`)
| Package | Version | Category | Purpose |
| :--- | :--- | :--- | :--- |
| [`express`](https://www.npmjs.com/package/express) | `^4.19.2` | Core Server | Fast, unopinionated REST API web framework |
| [`ws`](https://www.npmjs.com/package/ws) | `^8.18.0` | Streaming | Ultra-fast native WebSocket server for low-latency token streaming |
| [`socket.io`](https://www.npmjs.com/package/socket.io) | `^4.7.5` | Streaming | Event-driven bidirectional communication layer |
| [`axios`](https://www.npmjs.com/package/axios) | `^1.7.2` | HTTP Client | Promise-based client for upstream AI provider dispatch (Groq, Gemini, OpenAI) |
| [`dotenv`](https://www.npmjs.com/package/dotenv) | `^16.4.5` | Config | Multi-path environment variable loader |
| [`cors`](https://www.npmjs.com/package/cors) | `^2.8.5` | Security | Express middleware for Cross-Origin Resource Sharing |
| [`pdfkit`](https://www.npmjs.com/package/pdfkit) | `^0.15.2` | Export | Server-side publication-ready PDF document rendering |
| [`@supabase/supabase-js`](https://www.npmjs.com/package/@supabase/supabase-js) | `^2.45.0` | Database | Supabase client for session storage and telemetry persistence |
| [`pg`](https://www.npmjs.com/package/pg) | `^8.12.0` | Database | Native PostgreSQL client driver |
| [`lumaai`](https://www.npmjs.com/package/lumaai) | `^1.19.1` | Generative AI | Official Luma Dream Machine text-to-video API SDK |
| [`nodemon`](https://www.npmjs.com/package/nodemon) *(dev)* | `^3.1.4` | Tooling | Development server with auto-restart on code changes |

---

### 3. Frontend Web Console (`frontend/package.json`)
| Package | Version | Category | Purpose |
| :--- | :--- | :--- | :--- |
| [`next`](https://www.npmjs.com/package/next) | `^14.2.4` | Framework | React production framework with App Router & server rendering |
| [`react`](https://www.npmjs.com/package/react) | `^18.3.1` | UI Library | Core declarative user interface library |
| [`react-dom`](https://www.npmjs.com/package/react-dom) | `^18.3.1` | UI Library | DOM renderer for React |
| [`tailwindcss`](https://www.npmjs.com/package/tailwindcss) | `^3.4.4` | Styling | Utility-first CSS framework powering the dark glassmorphic UI |
| [`postcss`](https://www.npmjs.com/package/postcss) & [`autoprefixer`](https://www.npmjs.com/package/autoprefixer) | Latest | Styling | CSS transformation and vendor prefix automation |
| [`lucide-react`](https://www.npmjs.com/package/lucide-react) | `^0.400.0` | Icons | Clean, lightweight SVG icon system |
| [`jspdf`](https://www.npmjs.com/package/jspdf) | `^4.2.1` | Export | Client-side instant PDF document generation and download |
| [`docx`](https://www.npmjs.com/package/docx) | `^9.7.1` | Export | Client-side Microsoft Word (.docx) file synthesis |
| [`socket.io-client`](https://www.npmjs.com/package/socket.io-client) | `^4.7.5` | Streaming | Real-time WebSocket connection to the streaming backend |
| [`tailwind-merge`](https://www.npmjs.com/package/tailwind-merge) & [`clsx`](https://www.npmjs.com/package/clsx) | Latest | Styling | Conditional class name merging without Tailwind conflicts |

---

## 🚀 Quick Start

### 📋 Prerequisites & System Requirements
Before running OmniBridge, ensure your development environment meets the following requirements:
- **Node.js**: `v18.18.0` or higher (`v20.x` or `v22.x` recommended) — [Download Node.js](https://nodejs.org/)
- **npm**: `v9.0.0` or higher (bundled with Node.js)
- **Git**: Installed and available in your terminal
- **Operating System**: Windows, macOS, or Linux
- **AI Provider API Key**: At least one active API key (e.g. **Groq Cloud** for free high-speed LPU inference, **Google Gemini**, or **OpenAI**)

---

### 1. Clone & Environment Setup
Clone the repository, copy the centralized environment template into `.env`, and populate your API credentials:
```bash
git clone https://github.com/Abhinavkanaujiya101/OmniBridge.git
cd OmniBridge

# Copy centralized environment template
cp .env.example .env
```
*(The backend automatically loads this root `.env` file directly).*

---

### 2. Install Project Dependencies

OmniBridge uses an isolated subproject architecture. Run the root installer script to install all dependencies across the entire project at once:

```bash
# Installs root orchestrator, backend server, and frontend web dependencies
npm run install:all
```

#### What gets installed:
- **Root (`./node_modules`)**: Installs `concurrently` to orchestrate multiple server processes in a single terminal.
- **Backend (`./backend/node_modules`)**: Installs `express`, `ws`, `socket.io`, `axios`, `dotenv`, `cors`, `pdfkit`, `@supabase/supabase-js`, `pg`, `lumaai`, and `nodemon`.
- **Frontend (`./frontend/node_modules`)**: Installs `next`, `react`, `react-dom`, `tailwindcss`, `lucide-react`, `jspdf`, `docx`, `socket.io-client`, and `tailwind-merge`.

> **💡 Alternative (Manual Individual Installation):**
> ```bash
> npm install                      # 1. Install root orchestrator
> npm install --prefix backend     # 2. Install backend Express & WebSocket server
> npm install --prefix frontend    # 3. Install frontend Next.js 14 console
> ```

---

### 3. Run Development Stack
Launch both the backend API/WebSocket server and the Next.js frontend concurrently:
```bash
npm run dev
```

#### Service URLs:
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
