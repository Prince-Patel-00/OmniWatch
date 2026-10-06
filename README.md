# 🎬 OmniWatch Hub 2.0

> **Personal Entertainment Hub & Lifelong Watch Tracker**  
> Explore live Anime, Movies, and TV/Web Series with verified official streaming availability, trailers, and durable SQLite watch tracking.

---

## ✨ Features

### 1. 🌍 Global Discovery Engine
- **Universal Multi-Provider Search**: Fast, debounced search across **Anime**, **Movies**, and **TV Series** powered by live public APIs (**AniList GraphQL**, **TVMaze**, **Kitsu**, and **TMDB**).
- **Entity Deduplication & Canonical Mapping**: Automatically merges duplicate results from different APIs into a single canonical entry based on title similarity, original Japanese titles, and release year.
- **Next Episode Airing Countdowns**: Live, minute-accurate countdowns for currently airing anime and series (`Next Ep in 2d 14h`).
- **Official Watch Availability**: Displays verified, legal streaming availability (Subscription, Digital Rent, Purchase, and Free-with-ads) with a regional country selector (US, GB, IN, CA, JP, AU, etc.). Zero pirated scrapers or broken links.
- **Official YouTube Trailers**: Privacy-enhanced embedded trailer player (`youtube-nocookie.com`) with fallback to external YouTube links.

### 2. 📚 My Catalog (Personal Vault)
- **Lifelong Persistence**: Backed by a transactional **SQLite database with WAL mode** (`apps/server/data/omniwatch.db`). Your personal collection survives page reloads, browser restarts, and server reboots.
- **Granular Watch Statuses**:
  - `Want to Watch`
  - `Watching`
  - `Completed`
  - `On Hold`
  - `Dropped`
  - `Rewatching`
- **Persistent Episode Checkmarks**: Check off episodes one by one in the interactive episode guide or click **"+1 Ep"** directly on any card. Progress is permanently saved to SQLite.
- **Batch Season Completion**: Mark an entire season completed with a single click.
- **Granular Ratings & Private Notes**: 1 to 10 star personal ratings and markdown notes for reviews and thoughts.
- **Favorites & Custom Filtering**: Filter your catalog by status, media type, rating, or favorites.
- **One-Click Backup & Restore**: Export a timestamped JSON backup snapshot or restore a previously saved watchlist with conflict resolution.

### 3. 📊 Analytics & Insights Dashboard
- Track total watched hours (calculated from logged runtimes).
- Total episodes checked off.
- Catalog status breakdown and completion rates.
- Media format distribution (Anime vs. Movies vs. Series).

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React 18 / 19, Vite, Tailwind CSS, Lucide Icons.
- **Backend**: Node.js 22 LTS, Express, ES Modules.
- **Database**: SQLite via Node 22 native `node:sqlite` in WAL (Write-Ahead Logging) mode.
- **Provider Adapters**:
  - `AniListProvider`: Live anime trending, airing countdowns, native Japanese titles, and studio credits.
  - `TVMazeProvider`: Western TV series, seasons, and episode stills.
  - `KitsuProvider`: Anime search and YouTube trailer video keys.
  - `TMDBProvider`: (Optional) Movies, Western TV shows, and JustWatch watch providers.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration (Optional)
The application works immediately out of the box with **AniList**, **TVMaze**, and **Kitsu** without any API keys.

To also enable **TMDB Movies** and **JustWatch streaming availability**:
1. Copy the example environment file:
   ```bash
   cp apps/server/.env.example apps/server/.env
   ```
2. Get a free API key at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).
3. Set your key in `apps/server/.env`:
   ```ini
   TMDB_API_KEY=your_tmdb_api_key_here
   DEFAULT_STREAMING_REGION=US
   ```

### 3. Run Locally in Development Mode
```bash
npm run dev
```
- Frontend UI: `http://localhost:5170` (or `http://localhost:5173`)
- Backend API: `http://localhost:5000`

---

## 🧪 Testing & Verification

Run the automated test suite covering SQLite persistence, multi-provider normalization, entity deduplication, and REST API routes:
```bash
npm test
```

Build the frontend bundle for production:
```bash
npm run build
```

---

## 📁 Repository Structure

```
OmniWatch/
├── package.json              # Monorepo root with workspaces
├── apps/
│   ├── client/               # React 18/19 SPA with Tailwind CSS
│   │   ├── src/
│   │   │   ├── components/   # UI components (Hero, Cards, DetailModal, EpisodeGuide)
│   │   │   ├── services/     # Typed client API service
│   │   │   └── App.jsx       # Dual workspace state (Global vs Catalog vs Stats)
│   │   └── vite.config.js
│   └── server/               # Express REST Server
│       ├── src/
│       │   ├── db.js         # SQLite WAL relational storage layer
│       │   ├── index.js      # Server entry point
│       │   ├── routes/       # /api/global, /api/catalog, /api/system
│       │   └── providers/    # AniList, TVMaze, Kitsu, TMDB, and Orchestrator
│       └── data/             # omniwatch.db (SQLite database files)
├── packages/
│   └── shared/               # Shared constants, types, and title normalizers
└── tests/                    # Automated integration & unit test suites
```
