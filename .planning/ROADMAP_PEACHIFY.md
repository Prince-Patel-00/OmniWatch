# OmniWatch Peachify Direct Streaming Roadmap (ROADMAP_PEACHIFY.md)

## Phase 1: Shared Peachify Core Resolver & URL Builder
- **Goal**: Author isomorphic helper functions in `@omniwatch/shared` to resolve media IDs and generate green-themed Peachify URLs.
- **Tasks**:
  1. Create `packages/shared/src/peachify.js`.
  2. Implement `resolvePeachifyId(media)` supporting TMDB numeric IDs and IMDb `tt...` IDs.
  3. Implement `buildPeachifyUrl(media, options)` with defaults `accent='10b981'`, `autoPlay=false`, `autoNext=30`.
  4. Export from `packages/shared/src/index.js` and `packages/shared/src/constants.js`.
- **Verification**: Dedicated unit tests verifying Movie, TV, and Anime URL generation.

## Phase 2: Provider External ID Enrichment (TVMaze & Upstream)
- **Goal**: Guarantee that TVMaze shows include their IMDb external IDs so Peachify can stream non-TMDB TV entries.
- **Tasks**:
  1. Update `apps/server/src/providers/TVMazeProvider.js` to push `show.externals.imdb` into `providerMappings`.
- **Verification**: TVMaze normalization test verifying `providerMappings` contains `{ provider: 'imdb', id: 'tt...' }`.

## Phase 3: Green-Themed UI Component (`PeachifyPlayer.jsx`)
- **Goal**: Author dedicated UI component with emerald theme, inline iframe playback, expand/collapse state, external launch link, and episode selector integration.
- **Tasks**:
  1. Create `apps/client/src/components/PeachifyPlayer.jsx`.
  2. Design Emerald Green card header with badge: `⚡ Peachify Direct Stream (1080p HD)`.
  3. Include controls:
     - "▶️ Play Now" (expands inline 16:9 iframe player).
     - "↗️ Open Full Player" (opens direct link in new browser tab).
     - Season & Episode select pickers for episodic series/anime.
     - "Collapse Player" toggle.
  4. Implement `window.addEventListener('message')` listener for `PLAYER_EVENT` and `MEDIA_DATA`, persisting progress to `localStorage`.
- **Verification**: Client builds cleanly with `npm run build`.

## Phase 4: Integration in Media Detail Modal & Episode Guide
- **Goal**: Mount `PeachifyPlayer` at the top of the detail page watch sources, strictly above mirror links.
- **Tasks**:
  1. Update `apps/client/src/components/MediaDetailModal.jsx` to render `PeachifyPlayer` at the top of the `sources` tab.
  2. Provide episode-switch callback so clicking an episode in the Episode Guide updates the active Peachify stream.
- **Verification**: MediaDetailModal renders Peachify section at the top of the sources tab without interfering with existing mirror links.

## Phase 5: Verification & Ralph Loop Test Gates
- **Goal**: Run automated tests across all 15 suites and verify 100% pass rate.
- **Tasks**:
  1. Create `tests/peachify_streaming.test.js`.
  2. Run `npm test` and iterate until 0 errors.
  3. Run `npm run build` in `apps/client` to verify zero frontend compilation warnings or errors.

## Phase 6: CodeRabbit 4-Pillar Review
- **Goal**: Comprehensive 4-pillar audit (Bugs, Security, Performance, Code Quality) with severity badges and clean sign-off.
