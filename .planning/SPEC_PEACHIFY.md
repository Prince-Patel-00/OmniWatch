# OmniWatch Peachify Direct Streaming Integration Contract (SPEC_PEACHIFY.md)

## 1. System Intent & Objectives
Integrate the **Peachify Direct Streaming Player** (`https://peachify.pro/` -> hosted embed player `https://peachify.top`) into OmniWatch to provide high-definition, instantaneous streaming embeds and launch links for any Movie, TV Series, or Anime using TMDB or IMDb IDs.

Key user-specified constraints:
1. **Dedicated Top Section**: Placed prominently at the top of the detail modal watch sources, strictly above the general mirror links.
2. **Distinct Green Theme**: Styled using an emerald/green aesthetic (`#10b981`, Tailwind `emerald-500`, `emerald-400`, `emerald-950/40`, emerald border glow, green accents) matching `?accent=10b981`.
3. **Multi-Format Support**: Movies (`/embed/movie/{id}`), TV Shows & Anime (`/embed/tv/{id}/{season}/{episode}`).
4. **Resilient ID Resolution**: Dynamically extract TMDB numeric ID or IMDb `tt...` ID from `providerMappings`, media IDs, or fallback mappings.
5. **Interactive Playback & Sync**:
   - One-click "Launch Stream" external tab option.
   - Inline responsive embed player with expand/collapse toggle.
   - Dynamic episode switching synchronized with `EpisodeGuide`.
   - PostMessage listener for `PLAYER_EVENT` and `MEDIA_DATA` watching events.

---

## 2. Peachify Protocol & API Schema

### Base Host
- Host: `https://peachify.top`
- Documentation & Portal: `https://peachify.pro/`

### Endpoints
- **Movie**: `https://peachify.top/embed/movie/{media_id}`
- **TV / Anime**: `https://peachify.top/embed/tv/{media_id}/{season}/{episode}`

### Identifiers
- **TMDB ID**: Numeric identifier (e.g. `76479`, `550`)
- **IMDb ID**: String starting with `tt` (e.g. `tt0944947`, `tt1190634`)

### Supported Query Parameters
- `accent`: Hex color without `#` -> default `10b981` (Emerald Green)
- `autoPlay`: Boolean string (`true` or `false`).
- `startAt` / `progress` / `t`: Timestamp in seconds to resume playback.
- `autoNext`: Auto-next seconds threshold (e.g., `30` or `true`).
- `showNextBtn`: Boolean toggle for next episode prompt button.
- `dub` / `audio`: Preferred audio track (e.g. `English`, `Japanese`).
- `sub` / `subtitle`: Preferred subtitle code (e.g. `English`, `en`).
- `server`: Specific provider override (`iron`, `spider`, `wolf`).

### PostMessage Interop Protocol
The embedded iframe emits events:
1. `PLAYER_EVENT`: `{ type: "PLAYER_EVENT", data: { event: "play"|"pause"|"ended"|"timeupdate", currentTime, duration, tmdbId, mediaType, season, episode } }`
2. `MEDIA_DATA`: `{ type: "MEDIA_DATA", data: { [tmdbId]: { id, type, title, progress: { watched, duration, percentage, season, episode } } } }`

---

## 3. UI/UX Design Contract

### Theme Palette (Green / Emerald)
- Container: `bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-lg shadow-emerald-950/30`
- Badges: `bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold`
- Primary CTA: `bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-md shadow-emerald-950/60`
- Accent Icons: `text-emerald-400`
- Inline Player: Responsive `aspect-video rounded-xl overflow-hidden border border-emerald-500/30 bg-black`

### Placement in `MediaDetailModal.jsx`
- Displayed under the `Streaming & Download Mirrors` tab (`activeTab === 'sources'`), as the first hero element above the search/filter pills and generic mirror links.
- Also available as a direct quick-play action button in the episode row within `EpisodeGuide.jsx`.

---

## 4. Architectural Components
1. `packages/shared/src/peachify.js`:
   - `resolvePeachifyId(media)`: extracts TMDB or IMDb ID.
   - `buildPeachifyUrl(media, options)`: constructs authenticated/themed player URL.
   - `isPeachifySupported(media)`: checks if item has valid TMDB or IMDb ID.
2. `apps/client/src/components/PeachifyPlayer.jsx`:
   - Dedicated Green-themed player card component.
   - Supports inline iframe rendering, full-screen toggle, season/episode switcher, direct external launch button, and progress synchronization.
3. `apps/client/src/components/MediaDetailModal.jsx`:
   - Mounts `PeachifyPlayer` at the top of the `sources` tab.
4. `apps/server/src/providers/TVMazeProvider.js`:
   - Enhance provider mappings to export `show.externals.imdb` as `{ provider: 'imdb', id: show.externals.imdb }`.
