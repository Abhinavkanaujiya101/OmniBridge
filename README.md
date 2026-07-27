# OmniBridge 🌉
> Intelligent AI Orchestration and API Gateway Platform

OmniBridge is a high-performance, real-time AI orchestration gateway designed to bridge multi-provider LLM and generative model APIs (Google Gemini, OpenAI, Together AI, Runway ML) into a unified, low-latency streaming pipeline with PostgreSQL/Supabase persistence and dynamic telemetry dashboarding.

---

## 🌟 Key Features

- **Unified Gateway Routing**: Single API interface to route requests dynamically across Gemini, OpenAI, Together AI, and Runway.
- **Real-Time Streaming**: High-throughput WebSocket server (`ws`/`socket.io`) for real-time model response token streaming.
- **Server Stream Parsing**: Native parsing scripts that format multi-vendor SSE/chunked streams into a standardized JSON packet layout.
- **Telemetry & Metrics**: Interactive Next.js console tracking token count, model latency, and active connection status.
- **Supabase / Postgres Ready**: Data integration ready for storing request logs, cost tracking, and session histories.

---

## 📁 Repository Architecture

```
OmniBridge/
├── backend/                  # Node.js / Express Gateway API & WebSocket Streaming Server
│   ├── src/
│   │   ├── config/           # Environment loader & DB client setup
│   │   ├── controllers/      # API Controllers
│   │   ├── routes/           # REST endpoints (/api/v1/gateway, /api/v1/providers)
│   │   ├── services/         # AI Provider wrappers (Gemini, OpenAI, Together, Runway)
│   │   ├── parsers/          # Server parsing scripts for multi-provider stream data
│   │   └── websocket/        # Real-time WebSocket connection manager
│   ├── .env.example
│   ├── package.json
│   └── server.js
│
├── frontend/                 # Next.js 14 App Router Console
│   ├── src/
│   │   ├── app/              # Dashboard pages & CSS
│   │   ├── components/       # GatewayConsole, ProviderSelector, MetricsCard
│   │   └── lib/              # Axios client & WebSocket helpers
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
Copy `.env.example` and populate your API credentials:
```bash
cp .env.example .env
cp .env.example backend/.env
```

### 2. Install Dependencies
```bash
# Install root, backend, and frontend packages
npm run install:all
```

### 3. Run Development Servers
```bash
# Run both Backend (Port 5000) and Frontend (Port 3000) concurrently
npm run dev
```

---

## 🔐 Supported Providers & APIs

| Provider | Supported Models / Tasks | Streaming Support |
| :--- | :--- | :--- |
| **Google Gemini** | Gemini 1.5 Pro, Flash | SSE / WebSockets |
| **OpenAI** | GPT-4o, GPT-4o-mini | Chunked Stream |
| **Together AI** | Llama-3-70B, Mixtral | Token Streaming |
| **Runway ML** | Gen-2, Gen-3 Video Tasks | Job Webhook / Socket |

---

## 🛡️ License
MIT © OmniBridge Team
