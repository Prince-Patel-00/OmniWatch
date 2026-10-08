# OmniWatch 2.5 Rebuild Project

**Status:** IN_PLANNING  
**Current Milestone:** v2.5 OmniWatch Core Rebuild  
**Last Updated:** 2026-10-08

## Vision
Transform OmniWatch from a single-tenant local entertainment tracker into a multi-user, taste-driven entertainment platform with isolated watchlists, unified franchise navigation, automated dynamic mirrors, and personalized recommendations.

## Active Requirements
- **REQ-AUTH-01:** Multi-user authentication (email/password + JWT), seeding `makisanis106@gmail.com` with password `OutCast106`.
- **REQ-AUTH-02:** Multi-tenant schema migration across SQLite (`node:sqlite`) and Neon DB, migrating all 208 existing catalog items to `makisanis106@gmail.com`.
- **REQ-UI-01:** Complete removal of Hero Spotlight banner from Home.
- **REQ-UI-02:** Dedicated top-level "Want to Watch" section separated from the watched library.
- **REQ-UI-03:** Strict, predictable 24-item per page pagination with a modern pagination bar and zero duplicate items across pages.
- **REQ-FRAN-01:** Unified franchise linking connecting fragmented anime seasons (e.g. AOT S1, S2, Final Season) with direct chronology navigation.
- **REQ-FRAN-02:** Direct episode streaming links without duplicate placeholder banners.
- **REQ-MIRR-01:** Automated dynamic mirror registry with daily latency/health checks and candidate failover.
- **REQ-RECOM-01:** Taste profile analytics replacing raw counters with genre affinities, studio rankings, and era breakdowns.
- **REQ-RECOM-02:** "More Like This" recommendation engine triggered by 9-10 rated catalog titles, excluding already-cataloged media.

## Milestone Phases
- **Phase 1:** User Authentication & Isolated Catalogs (Multi-Tenant Schema & 208-record Migration)
- **Phase 2:** UI Cleanup, Navigation & Strict Modern Pagination
- **Phase 3:** Unified Season & Episode Architecture & Direct Episode Launchers
- **Phase 4:** Dynamic Mirror Registry Automation & Daily Resolver
- **Phase 5:** Taste Insights & "More Like This" Recommendation Engine

## Evolution
This document evolves at phase transitions and milestone boundaries.
