# Roblox Thumbnail Tool — Deployment Guide

This guide covers deploying the dataset tool for production use. The application consists of a Node.js backend, a React frontend, a PostgreSQL database, and a Redis queue.

## 1. Prerequisites
- Docker & Docker Compose
- Cloud Storage Account (Supabase or Cloudinary) for dataset storage
- Optional: Managed PostgreSQL & Redis (e.g., Supabase, Upstash, or Railway)

## 2. Docker Compose (Self-Hosted)
The simplest way to deploy the entire stack is via the provided `docker-compose.yml`.

1. Copy `.env.example` to `.env` and fill in all variables:
   - Generate a strong `APP_SECRET`.
   - Set `STORAGE_PROVIDER` to `local`, `supabase`, or `cloudinary`.
   - Provide storage API keys.
2. Run the stack:
   ```bash
   docker-compose up -d --build
   ```
3. Access the dashboard at `http://localhost:5173` (or your domain).

## 3. Managed Platform Deployment (Railway / Render)

For high availability, decouple the services:

### Database (Supabase)
1. Create a new Supabase project.
2. Get the PostgreSQL connection string.
3. Update `DATABASE_URL` in your `.env`.
4. Run Prisma migrations: `npm run db:migrate:deploy`

### Redis (Upstash / Railway)
1. Provision a Redis instance.
2. Set `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD`.

### Backend (Railway)
1. Connect your GitHub repository to Railway.
2. Set the root directory to `packages/backend` or use the root `Dockerfile`.
3. Provide all `.env` variables in the Railway dashboard.
4. Expose the port (default: 3001).

### Frontend (Vercel / Netlify / Cloudflare Pages)
1. Connect your repository.
2. Set root directory to `packages/frontend`.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Note: Configure rewrites/proxies so `/api/*` routes to your backend URL.

## 4. Storage Setup

### Supabase Storage
1. Create a public bucket in Supabase (e.g., `thumbnails`).
2. Add bucket policies allowing public read access.
3. Provide the Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`) to the backend to bypass RLS for uploads.

### Cloudinary
1. Create an account and grab your Cloud Name, API Key, and API Secret.
2. Note: Free tier limits bandwidth; monitor usage via the dashboard.

## 5. Security Checklist
- [ ] Change `APP_SECRET` before production.
- [ ] Ensure Redis is not publicly exposed without a strong password.
- [ ] Implement CORS headers (`CORS_ORIGINS`) to only allow your frontend domain.
- [ ] Setup SSL/TLS (Let's Encrypt) if self-hosting via a reverse proxy like Nginx or Traefik.
- [ ] Regularly monitor `/api-docs` (Swagger) and restrict access if deploying a private internal tool.
