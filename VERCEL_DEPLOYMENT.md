# OmniWatch — Vercel Production Deployment Guide

This guide provides end-to-end instructions for hosting **OmniWatch** on **Vercel** with **Neon Serverless PostgreSQL** and automated GitHub CI/CD deployments.

---

## Architecture Overview

OmniWatch runs on Vercel as a hybrid full-stack application:
- **Frontend SPA:** Built with React + Vite (`apps/client`), compiled to `apps/client/dist` and distributed globally via Vercel Edge Network.
- **Serverless API:** Powered by Express (`apps/server`), wrapped via `api/index.js` and executed as a Vercel Serverless Function servicing `/api/(.*)`.
- **Database:** Neon Serverless PostgreSQL with connection pooling (`@neondatabase/serverless`), ensuring zero local disk dependencies and resilience across serverless cold starts.
- **Scheduled Tasks:** Automated mirror health checks triggered every 6 hours via Vercel Cron Jobs (`/api/mirrors/check`).

---

## Pre-Requisites

1. **GitHub Repository:** Push your code to your GitHub repo (e.g., `https://github.com/Prince-Patel-00/OmniWatch`).
2. **Neon PostgreSQL Database:**
   - Sign up or log into [Neon Console](https://console.neon.tech).
   - Create a project (or use your existing branch).
   - Copy your **Pooled Connection String** (`postgresql://...-pooler....neon.tech/neondb?sslmode=require`).
3. **TMDB API Key:**
   - Free API Key from [The Movie Database](https://www.themoviedb.org/settings/api).

---

## Step-by-Step Vercel Setup

### Step 1: Import Project in Vercel Dashboard
1. Log into [vercel.com](https://vercel.com) and navigate to your Dashboard.
2. Click **Add New...** → **Project**.
3. Under **Import Git Repository**, select **`Prince-Patel-00/OmniWatch`** and click **Import**.

### Step 2: Configure Project Settings
In the **Configure Project** screen:
- **Project Name:** `omniwatch` (or your preferred name).
- **Framework Preset:** Select **Vite** (or leave Default, as `vercel.json` configures this).
- **Root Directory:** Leave as `./` (the root of the repository).
- **Build and Output Settings:** Leave default (these are automatically controlled by `vercel.json`):
  - *Build Command:* `npm run build --workspace=apps/client`
  - *Output Directory:* `apps/client/dist`
  - *Install Command:* `npm install`

### Step 3: Configure Environment Variables
Expand the **Environment Variables** section and add the following keys:

| Variable Name | Required | Example / Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | `postgresql://neondb_owner:***@ep-***-pooler.region.aws.neon.tech/neondb?sslmode=require` (Pooled connection) |
| `DATABASE_URL_UNPOOLED` | Optional | Direct unpooled connection string for migrations |
| `TMDB_API_KEY` | **Yes** | Your 32-character TMDB v3 API Key |
| `JWT_SECRET` | **Yes** | Random 32+ character string for token signing (e.g. generated via `openssl rand -hex 32`) |
| `NODE_ENV` | **Yes** | `production` |
| `DEFAULT_STREAMING_REGION` | No | `US` (or your preferred country code) |

> 💡 **Tip:** Select all environments (Production, Preview, Development) for these variables.

### Step 4: Click Deploy
1. Click **Deploy**.
2. Vercel will install workspace dependencies, compile the Vite React client, package the serverless function, and deploy your site in ~1 minute.

---

## Post-Deployment Smoke Verification

Once your deployment is live at `https://<your-project>.vercel.app`:

### 1. Test Health & Database Connectivity
Open in your browser:
```
https://<your-project>.vercel.app/api/health
```
**Expected Response:**
```json
{
  "status": "ok",
  "service": "OmniWatch Unified Hub API",
  "version": "2.0.0",
  "environment": "production",
  "database": {
    "engine": "Neon Serverless PostgreSQL",
    "status": "connected",
    "latencyMs": 85,
    "error": null
  },
  "timestamp": "..."
}
```

### 2. Verify Frontend & Catalog
1. Open the root URL `https://<your-project>.vercel.app`.
2. Verify trending movies, anime, and TV series render with posters and metadata.
3. Click **Sign In** and log in with your primary credentials:
   - **Email:** `makisanis106@gmail.com`
   - **Password:** `OutCast106`
4. Confirm your catalog and watchlist load seamlessly.

### 3. Verify Vercel Cron Jobs
1. In your Vercel Dashboard, go to your project → **Settings** → **Cron Jobs**.
2. Confirm the scheduled job is active:
   - **Path:** `/api/mirrors/check`
   - **Schedule:** `0 4 * * *` (Daily at 04:00 UTC)

---

## Local Development vs Production

| Feature | Local (`npm run dev`) | Production (Vercel) |
|---|---|---|
| **Database** | SQLite (`node:sqlite` WAL) or Neon | Neon Serverless PostgreSQL |
| **API Server** | Node Express daemon on port 5000 | Vercel Serverless Function (`api/index.js`) |
| **Client** | Vite HMR Dev Server on port 5170 | Vercel Global Edge CDN |
| **API Path** | Proxied `/api` → `localhost:5000` | Rewritten `/api/(.*)` → `/api` serverless handler |
| **Mirror Checks**| Background timer (every 12h) | Vercel Cron (every 6h) |

---

## Troubleshooting

- **500 on database queries:** Verify `DATABASE_URL` in Vercel Settings has `sslmode=require` and points to the pooled Neon endpoint (`-pooler`).
- **TMDB poster/media missing:** Ensure `TMDB_API_KEY` is added to Vercel Environment Variables.
- **Redirection / 404 on page refresh:** Handled automatically by `vercel.json` rewrites (`/(.*)` -> `/index.html`).
