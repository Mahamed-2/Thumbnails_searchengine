# 🎮 Roblox Thumbnail Dataset Tool

> Production-grade, fault-tolerant system for collecting, validating, deduplicating, processing, storing, and visualizing Roblox player & game thumbnails.

[![CI](https://github.com/your-org/roblox-thumbnail-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/roblox-thumbnail-tool/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](LICENSE)

---

## 📋 Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│              React Dashboard (Vite + Tailwind)               │
└───────────────────────────┬──────────────────────────────────┘
                            │ REST API / SSE
┌───────────────────────────▼──────────────────────────────────┐
│           Express API Gateway (Node.js + TypeScript)         │
│  ├── Rate Limiting (express-rate-limit)                      │
│  ├── Auth Middleware                                         │
│  └── Routes: /thumbnails /jobs /stats /export               │
└───────────────────────────┬──────────────────────────────────┘
                            │ BullMQ Jobs
┌───────────────────────────▼──────────────────────────────────┐
│           Redis Task Queue (BullMQ)                          │
│  ├── thumbnail-collection queue                              │
│  ├── Dead-Letter Queue (DLQ)                                 │
│  └── Circuit Breaker (opossum)                               │
└──────────┬────────────────┬─────────────────────────────────┘
           │                │
┌──────────▼─────┐  ┌───────▼───────────────────────────────┐
│ Roblox API     │  │        Processing Pipeline              │
│ Adapter        │  │  ① Download → ② Validate → ③ pHash   │
│ (Rate Limited) │  │  ④ Resize → ⑤ Optimize → ⑥ Store     │
└────────────────┘  └───────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│              Unified Storage Adapter                         │
│  ├── Local FS (default)                                      │
│  ├── Supabase Storage (1 GB free)                            │
│  └── Cloudinary (25 GB free)                                 │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│              Database (Prisma ORM)                           │
│  ├── SQLite (development)                                    │
│  └── PostgreSQL / Supabase (production)                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 20
- Docker & Docker Compose
- Redis (or use Docker Compose)

### 1. Clone & Setup

```bash
git clone <repo-url>
cd roblox-thumbnail-tool

# Copy and configure environment
cp .env.example .env
# Edit .env — at minimum set APP_SECRET (min 32 chars)
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start with Docker (Recommended)

```bash
# Starts Redis + Backend + Frontend
npm run docker:up

# View logs
npm run docker:logs

# With Prometheus + Grafana monitoring
docker-compose --profile monitoring up -d
```

### 4. Local Development (No Docker)

```bash
# Requires Redis running locally
npm run dev
```

### 5. Database Setup

```bash
# Generate Prisma client
npm run db:generate --workspace=packages/backend

# Run migrations (creates SQLite DB in dev)
npm run db:migrate --workspace=packages/backend
```

### 6. Access the Tools

| Service    | URL                           |
|------------|-------------------------------|
| Frontend   | http://localhost:5173         |
| API        | http://localhost:3001         |
| Health     | http://localhost:3001/health  |
| Metrics    | http://localhost:9090/metrics |
| Grafana    | http://localhost:3000         |

---

## 📁 Project Structure

```
roblox-thumbnail-tool/
├── .github/workflows/          # GitHub Actions CI/CD
├── monitoring/                 # Prometheus + Grafana config
├── packages/
│   ├── backend/
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Database schema
│   │   ├── src/
│   │   │   ├── config/         # Env validation (Zod)
│   │   │   ├── api/            # Roblox + fallback API adapters [Phase 2]
│   │   │   ├── queue/          # Redis + BullMQ config
│   │   │   ├── workers/        # Background job workers [Phase 3]
│   │   │   ├── pipeline/       # Image processing pipeline [Phase 4]
│   │   │   ├── storage/        # Unified storage adapter [Phase 5]
│   │   │   ├── database/       # Prisma client + queries
│   │   │   ├── observability/  # Logger + Prometheus metrics
│   │   │   ├── middleware/     # Error handler, request ID
│   │   │   ├── routes/         # Express route handlers
│   │   │   ├── app.ts          # Express factory
│   │   │   └── index.ts        # Bootstrap entry point
│   │   ├── tests/              # Jest tests [Phase 7]
│   │   ├── Dockerfile
│   │   ├── jest.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/
│       ├── src/
│       │   ├── components/     # Shared UI components
│       │   ├── pages/          # Route page components
│       │   ├── hooks/          # Custom React hooks
│       │   ├── stores/         # Zustand state stores
│       │   ├── api/            # API client functions
│       │   ├── types/          # TypeScript types
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   └── index.css       # Design system
│       ├── Dockerfile
│       ├── vite.config.ts
│       └── package.json
├── .env.example
├── .eslintrc.cjs
├── .gitignore
├── .prettierrc.json
├── docker-compose.yml
├── package.json                # Monorepo root
└── README.md
```

---

## 🔌 Roblox API Endpoints Used

| Endpoint                               | Purpose                    | Auth     |
|----------------------------------------|----------------------------|----------|
| `thumbnails.roblox.com/v1/users/avatar` | Full body thumbnails       | None     |
| `thumbnails.roblox.com/v1/users/avatar-headshot` | Headshots         | None     |
| `thumbnails.roblox.com/v1/users/avatar-bust` | Bust thumbnails        | None     |
| `thumbnails.roblox.com/v1/games/icons` | Game icons                 | None     |
| `games.roblox.com/v1/games/list`       | Game search & popular list | None     |
| `users.roblox.com/v1/users`            | User info                  | None     |

> ⚠️ **Rate Limit**: ~100 req/min is safe. Always respect `X-RateLimit-*` headers.

---

## 🛡️ Resilience Patterns

| Pattern          | Implementation         | Purpose                              |
|------------------|------------------------|--------------------------------------|
| Circuit Breaker  | `opossum`              | Stop hammering Roblox during outages |
| Exponential Backoff | BullMQ backoff config | Avoid thundering herd on retries  |
| Idempotency      | Job ID = `userId:size:cropType` | Prevent duplicates          |
| DLQ              | Failed jobs → dlq_entries | Manual inspection + replay       |
| Checkpointing    | Redis + DB checkpoint column | Resume after crash             |
| Graceful Shutdown | SIGTERM → drain → close | Zero data loss                   |

---

## 🔑 Environment Variables

See [`.env.example`](.env.example) for the complete reference. Key variables:

| Variable           | Required | Description                            |
|--------------------|----------|----------------------------------------|
| `APP_SECRET`       | ✅       | Min 32-char secret (use `openssl rand -base64 32`) |
| `DATABASE_URL`     | ✅       | SQLite path or PostgreSQL URL          |
| `REDIS_HOST`       | ✅       | Redis hostname                         |
| `STORAGE_PROVIDER` | ✅       | `local` \| `supabase` \| `cloudinary` |
| `SUPABASE_URL`     | optional | Required if STORAGE_PROVIDER=supabase  |
| `CLOUDINARY_*`     | optional | Required if STORAGE_PROVIDER=cloudinary|

---

## 📊 Execution Phases

| Phase | Status | Description |
|-------|--------|-------------|
| **1** | ✅ **COMPLETE** | Project scaffolding, config, Docker, database schema |
| **2** | ⏳ Pending | Roblox API adapters, rate limiting, retry logic |
| **3** | ⏳ Pending | BullMQ queue system, workers, circuit breakers, DLQ |
| **4** | ⏳ Pending | Image processing pipeline (pHash dedup, Sharp) |
| **5** | ⏳ Pending | Storage adapter (local/Supabase/Cloudinary) |
| **6** | ⏳ Pending | React dashboard with real-time progress |
| **7** | ⏳ Pending | Tests, CI/CD, observability |
| **8** | ⏳ Pending | OpenAPI docs, deployment guide |

---

## ⚖️ Legal & Compliance

- ✅ Uses **official Roblox APIs only** — no scraping, no ToS violations
- ✅ Respects rate limits (~100 req/min)
- ✅ No authentication bypass
- ✅ User data handled per privacy policy
- ⚠️ Review Roblox ToS before commercial use

---

## 🧪 Testing

```bash
# Run all tests
npm run test

# Backend tests with coverage
npm run test:coverage --workspace=packages/backend

# Frontend tests
npm run test --workspace=packages/frontend
```

---

## 📄 License

MIT — See [LICENSE](LICENSE)
