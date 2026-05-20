# Roblox Thumbnail Engine 🎮

> Production-grade collection, deduplication, processing, and analytics of Roblox avatar thumbnails. Build ML-ready datasets in minutes.

[![CI](https://github.com/YOUR_ORG/roblox-thumbnail-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_ORG/roblox-thumbnail-tool/actions/workflows/ci.yml)
[![Deploy](https://github.com/YOUR_ORG/roblox-thumbnail-tool/actions/workflows/deploy.yml/badge.svg)](https://github.com/YOUR_ORG/roblox-thumbnail-tool/actions/workflows/deploy.yml)

---

## ✨ Features

| Feature | Details |
|---|---|
| **Multi-strategy collection** | User ID ranges, game search, popular games |
| **Image pipeline** | Download → validate → resize → pHash → dedup → store |
| **Perceptual deduplication** | Average hash (16×16 grayscale), configurable threshold |
| **Cloud storage** | Local FS / Supabase Storage / Vercel Blob |
| **Analytics dashboard** | Recharts area + pie charts, 7/14/30d views |
| **Scheduled collection** | GitHub Actions cron every 30 min |
| **Export API** | JSON / CSV dataset exports with filter support |
| **Rate limiting** | Upstash Redis sliding window per IP |
| **TypeScript strict** | End-to-end typed, Zod-validated API schemas |

---

## 🏗️ Architecture

```
GitHub Actions (cron/manual)
        ↓  POST /api/cron/collect
Next.js API Routes (Vercel serverless)
        ↓  Prisma ORM
PostgreSQL (Supabase/Neon/Railway)
        ↓  pHash stored
Upstash Redis (queue + locks + rate limit)
        ↓  image buffers
Cloud Storage (Supabase / Vercel Blob / local)
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL (local or [Supabase](https://supabase.com))
- Redis (local or [Upstash](https://upstash.com) — free tier)

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_ORG/roblox-thumbnail-tool.git
cd roblox-thumbnail-tool
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Fill in your DATABASE_URL, UPSTASH_REDIS_REST_URL, etc.
```

Required variables:
```env
# Database (PostgreSQL)
POSTGRES_PRISMA_URL=postgresql://USER:PASS@HOST:5432/DB
POSTGRES_URL_NON_POOLING=postgresql://USER:PASS@HOST:5432/DB

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://REGION.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Storage (default: local)
STORAGE_PROVIDER=local   # 'local' | 'supabase' | 'vercel-blob'

# Security
CRON_SECRET=openssl-rand-base64-32-output
```

### 3. Initialize Database

```bash
npm run db:migrate
npm run db:generate
npm run db:seed    # Optional: seed with sample data
```

### 4. Start Dev Server

```bash
npm run dev
# → http://localhost:3000
```

---

## 📦 Deployment (Vercel)

### Automatic via GitHub Actions

1. Connect your GitHub repo to [Vercel](https://vercel.com)
2. Add secrets in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `VERCEL_TOKEN` | Vercel CLI token |
| `DATABASE_URL` | PostgreSQL connection string |
| `POSTGRES_PRISMA_URL` | Pooled Prisma connection |
| `POSTGRES_URL_NON_POOLING` | Direct connection for migrations |
| `UPSTASH_REDIS_REST_URL` | Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash token |
| `CRON_SECRET` | Secret for `/api/cron/*` endpoints |
| `APP_SECRET` | Optional API key guard |
| `APP_URL` | Your deployed URL (for cron trigger) |

3. Push to `main` — the deploy workflow fires automatically.

### Scheduled Collection

Set up `.github/workflows/collect.yml` (already configured). Add `APP_URL` and `CRON_SECRET` to GitHub Secrets, and the collection worker runs every 30 minutes.

---

## 🧪 Testing

```bash
npm run test          # Interactive watch mode
npm run test:run      # CI one-shot run
npm run test:coverage # Coverage report in ./coverage/
```

---

## 🔌 API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/thumbnails` | Paginated thumbnails with filters |
| `POST` | `/api/thumbnails` | Quick collect for specific userIds |
| `GET` | `/api/thumbnails/:id` | Single thumbnail detail |
| `DELETE` | `/api/thumbnails/:id` | Delete thumbnail record |
| `GET` | `/api/collections` | List all collection jobs |
| `POST` | `/api/collections` | Create a collection job |
| `GET` | `/api/collections/:id/status` | Job status + retry/cancel |
| `POST` | `/api/collections/:id/status` | Cancel or retry a job |
| `GET` | `/api/analytics/dashboard` | Aggregate stats |
| `GET` | `/api/analytics/timeseries` | Daily trend data |
| `POST` | `/api/export` | Queue a dataset export |
| `GET` | `/api/export/:id/status` | Export job status |
| `POST` | `/api/cron/collect` | Worker trigger (requires CRON_SECRET) |
| `POST` | `/api/cron/cleanup` | Cleanup expired exports (requires CRON_SECRET) |
| `GET` | `/api/health` | System health check |

**Collection Strategies:**

```json
// User range
{ "strategy": "user-range", "startUserId": 1, "endUserId": 1000, "sizes": ["420x420"] }

// Game search
{ "strategy": "game-search", "keyword": "adopt me", "limit": 50 }

// Popular games
{ "strategy": "popular-games", "limit": 100 }
```

---

## 🗄️ Database Schema

```
Thumbnail     — core image records with pHash, cloud URL, dedup flag
User          — Roblox user metadata
Game          — Roblox game + thumbnail index
CollectionJob — job tracking with checkpointing for resume
DLQEntry      — dead-letter queue for failed items
DatasetExport — export job records
CollectionStat — daily aggregate metrics
```

---

## ⚙️ Environment Variables Reference

See [`.env.example`](.env.example) for the full list with descriptions.

Key flags:
| Variable | Default | Description |
|---|---|---|
| `STORAGE_PROVIDER` | `local` | `local` / `supabase` / `vercel-blob` |
| `ENABLE_DEDUPLICATION` | `true` | Toggle pHash dedup |
| `PHASH_SIMILARITY_THRESHOLD` | `90` | % similarity to mark as duplicate |
| `ROBLOX_RATE_LIMIT_MIN_TIME` | `100` | ms between Roblox API requests |
| `DISABLE_STORAGE_UPLOAD` | — | Set to `true` to skip cloud upload |

---

## 📄 License

MIT — use freely, attribute kindly.
