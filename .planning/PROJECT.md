# OmniWatch Project

**Status:** ACTIVE  
**Current Milestone:** v2.6 Vercel Cloud Deployment & Serverless Production  
**Last Updated:** 2026-10-09

## Vision
Deploy OmniWatch seamlessly to Vercel as a production-grade cloud application with automated GitHub CI/CD, Neon Serverless PostgreSQL persistence, unified Vite SPA delivery, serverless Express API routing, and automated mirror health checks.

## Milestone History
- **v2.5 OmniWatch Core Rebuild:** User authentication, multi-tenant catalogs, UI cleanup, dedicated Watchlist view, and modern pagination (Verified & Complete).
- **v2.6 Vercel Cloud Deployment & Serverless Production (Current):** End-to-end cloud deployment on Vercel with Neon Serverless Postgres and GitHub automated deployments.

## Active Requirements (v2.6)
- **REQ-VERCEL-01:** Serverless Database & Runtime Hardening: Safeguard Express API against ephemeral filesystem limitations and decouple `node:sqlite` so Vercel Serverless Functions running against Neon PostgreSQL boot cleanly without native module failures.
- **REQ-VERCEL-02:** Monorepo Vercel Configuration & Rewrites: Audit and optimize `vercel.json` routing rules for `/api/(.*)` Express serverless execution, SPA fallback (`/index.html`), static caching, and cron jobs (`/api/mirrors/check`).
- **REQ-VERCEL-03:** Cloud Database Auto-Provisioning & Pooling: Verify Neon Serverless PostgreSQL auto-migration, connection pooling, and multi-user data integrity under serverless cold-starts.
- **REQ-VERCEL-04:** Cloud Health & Diagnostics Endpoint: Expose `/api/health` providing database ping, active driver (Neon vs SQLite), and serverless execution metrics.
- **REQ-VERCEL-05:** Production Build Verification & GitHub Deployment Guide: Ensure production bundle optimization, zero-error `npm run build`, and complete step-by-step documentation for environment variables and GitHub Vercel deployment.

## Milestone Phases
- **Phase 1:** Serverless Database & Runtime Hardening (Neon Postgres & SQLite Decoupling)
- **Phase 2:** Vercel Routing, Monorepo Build Scripts & Rewrites Optimization
- **Phase 3:** Cloud Health Check, Security & Environment Secrets
- **Phase 4:** Production Smoke Verification & GitHub-to-Vercel Deployment Guide

## Evolution
This document evolves at phase transitions and milestone boundaries.
