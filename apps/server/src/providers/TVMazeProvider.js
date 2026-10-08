import { BaseProvider } from './BaseProvider.js';
import { getPlatformLogo, generateDefaultMirrors } from '@omniwatch/shared';

const TVMAZE_BASE_URL = 'https://api.tvmaze.com';

export class TVMazeProvider extends BaseProvider {
  constructor() {
    super('tvmaze', {
      series: true,
      episodes: true,
      watchProviders: true
    });
  }

  normalizeTVMazeShow(show, embedded = {}) {
    if (!show) return null;

    const isAnimation = show.type === 'Animation' || (show.genres && show.genres.includes('Anime'));
    const mediaType = isAnimation ? 'Anime' : 'Series';

    let status = 'Released';
    if (show.status === 'Running') status = 'Airing';
    else if (show.status === 'Ended') status = 'Completed';
    else if (show.status === 'In Development') status = 'Upcoming';

    const rating = show.rating?.average ? parseFloat(show.rating.average.toFixed(1)) : null;
    const releaseDate = show.premiered || null;
    const releaseYear = releaseDate ? parseInt(releaseDate.substring(0, 4), 10) : null;

    const posterUrl = show.image?.original || show.image?.medium || null;
    const backdropUrl = posterUrl;

    const cleanSynopsis = (show.summary || '')
      .replace(/<\/?[^>]+(>|$)/g, '')
      .replace(/&#039;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .trim();

    const networkName = show.webChannel?.name || show.network?.name || null;
    const networks = networkName ? [networkName] : [];

    // Cast
    const rawCast = embedded.cast || show._embedded?.cast || [];
    let cast = rawCast.slice(0, 8).map((c, idx) => ({
      character: c.character?.name,
      characterImage: c.character?.image?.medium,
      actor: c.person?.name,
      actorImage: c.person?.image?.medium,
      role: idx < 3 ? 'MAIN' : 'SUPPORTING'
    }));

    if (embedded.matchedPerson) {
      const actorName = embedded.matchedPerson.name;
      const charName = embedded.matchedPerson.character;
      const existingIdx = cast.findIndex(c => (c.actor || '').toLowerCase() === actorName.toLowerCase());
      if (existingIdx >= 0) {
        cast[existingIdx].role = 'MAIN';
        if (charName) cast[existingIdx].character = charName;
      } else {
        cast.unshift({
          character: charName || 'Lead',
          characterImage: null,
          actor: actorName,
          actorImage: embedded.matchedPerson.image || null,
          role: 'MAIN'
        });
      }
    }

    // Watch Providers from network / webChannel
    const watchProviders = [];
    if (networkName) {
      watchProviders.push({
        name: networkName,
        logoUrl: getPlatformLogo(networkName),
        region: 'Global',
        type: 'FLATRATE',
        webUrl: show.officialSite || null,
        priority: 1
      });
    }

    // Seasons & Episodes
    const rawEpisodes = embedded.episodes || show._embedded?.episodes || [];
    const seasonsMap = {};

    for (const ep of rawEpisodes) {
      const sNum = ep.season || 1;
      if (!seasonsMap[sNum]) {
        seasonsMap[sNum] = {
          seasonNumber: sNum,
          title: `Season ${sNum}`,
          episodeCount: 0,
          episodes: []
        };
      }

      seasonsMap[sNum].episodeCount++;
      seasonsMap[sNum].episodes.push({
        episodeNumber: ep.number || seasonsMap[sNum].episodes.length + 1,
        title: ep.name || `Episode ${ep.number}`,
        overview: (ep.summary || '').replace(/<\/?[^>]+(>|$)/g, '').trim(),
        airDate: ep.airdate || null,
        runtimeMinutes: ep.runtime || show.runtime || 45,
        stillUrl: ep.image?.original || ep.image?.medium || null,
        voteAverage: ep.rating?.average || null,
        links: [
          `https://7reels.cc/search?q=${encodeURIComponent(show.name)}`,
          `https://www.1flex.org/search?q=${encodeURIComponent(show.name)}`
        ]
      });
    }

    // Integrate explicit seasons list from TVMaze /shows/:id/seasons
    if (Array.isArray(embedded.seasons)) {
      for (const s of embedded.seasons) {
        if (!s || typeof s.number !== 'number') continue;
        if (!seasonsMap[s.number]) {
          seasonsMap[s.number] = {
            seasonNumber: s.number,
            title: s.name ? `Season ${s.number}: ${s.name}` : `Season ${s.number}`,
            episodeCount: s.episodeOrder || 0,
            episodes: []
          };
        } else if (s.name && !seasonsMap[s.number].title.includes(':')) {
          seasonsMap[s.number].title = `Season ${s.number}: ${s.name}`;
          if (s.episodeOrder && !seasonsMap[s.number].episodeCount) {
            seasonsMap[s.number].episodeCount = s.episodeOrder;
          }
        }
      }
    }

    const seasons = Object.values(seasonsMap).sort((a, b) => a.seasonNumber - b.seasonNumber);
    const totalEpisodes = rawEpisodes.length > 0 ? rawEpisodes.length : (
      seasons.reduce((acc, s) => acc + (s.episodeCount || 0), 0) || null
    );

    return {
      id: `omni_tv_${show.id}`,
      mediaType,
      title: show.name,
      originalTitle: show.name,
      romajiTitle: null,
      synopsis: cleanSynopsis,
      releaseDate,
      releaseYear,
      runtimeMinutes: show.averageRuntime || show.runtime || 45,
      status,
      rating,
      voteCount: show.weight || 0,
      popularityScore: show.weight || 0,
      posterUrl,
      backdropUrl,
      bannerUrl: backdropUrl,
      genres: show.genres && show.genres.length > 0 ? show.genres : ['Drama'],
      countryOfOrigin: show.network?.country?.code || 'US',
      studios: networks,
      networks,
      creators: [],
      cast,
      mainCharacters: (() => {
        const mains = cast.filter(c => c.role === 'MAIN');
        return (mains.length > 0 ? mains : cast).slice(0, 4).map(c => ({
          name: c.character || c.actor,
          image: c.characterImage || c.actorImage || null,
          role: c.role || 'MAIN',
          actor: c.actor || null
        }));
      })(),
      matchedPerson: embedded.matchedPerson || null,
      matchedCharacter: embedded.matchedPerson ? {
        name: embedded.matchedPerson.character || embedded.matchedPerson.name,
        actor: embedded.matchedPerson.name,
        image: embedded.matchedPerson.image || null,
        role: 'MAIN'
      } : null,
      totalSeasons: Math.max(
        seasons.length,
        Array.isArray(embedded.seasons) ? embedded.seasons.length : 0,
        1
      ),
      totalEpisodes,
      nextAiringEpisode: null,
      nextAiringAt: null,
      providerMappings: [
        {
          provider: 'tvmaze',
          id: show.id,
          url: show.url
        }
      ],
      seasons,
      trailers: [],
      watchProviders,
      sources: generateDefaultMirrors({
        title: show.name,
        mediaType,
        isMovie: false
      })
    };
  }

  async searchPeopleCredits(personQuery, { page = 1, limit = 20 } = {}) {
    if (!personQuery || !personQuery.trim()) return [];
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);

    try {
      const people = await this.fetchWithTimeout(
        `${TVMAZE_BASE_URL}/search/people?q=${encodeURIComponent(personQuery.trim())}`
      );
      if (!Array.isArray(people) || people.length === 0) return [];

      const qLower = personQuery.trim().toLowerCase();
      const topPerson = people.find(p => p.person?.name?.toLowerCase() === qLower) || people[0];
      if (!topPerson?.person?.id) return [];

      const credits = await this.fetchWithTimeout(
        `${TVMAZE_BASE_URL}/people/${topPerson.person.id}/castcredits?embed[]=show&embed[]=character`
      );
      if (!Array.isArray(credits) || credits.length === 0) return [];

      const personImage = topPerson.person.image?.medium || topPerson.person.image?.original || null;
      const matchedPerson = {
        name: topPerson.person.name,
        image: personImage,
        type: 'ACTOR'
      };

      const shows = [];
      const seenShowIds = new Set();

      for (const credit of credits) {
        const show = credit._embedded?.show;
        if (!show || seenShowIds.has(show.id)) continue;
        seenShowIds.add(show.id);

        const charName = credit._embedded?.character?.name;
        const normalized = this.normalizeTVMazeShow(show, {
          matchedPerson: {
            ...matchedPerson,
            character: charName
          }
        });
        if (normalized) shows.push(normalized);
      }

      const offset = (pageNum - 1) * limitNum;
      return shows.slice(offset, offset + limitNum);
    } catch (err) {
      console.warn('[TVMazeProvider] searchPeopleCredits error:', err.message);
      return [];
    }
  }

  async search(query, { character = null, searchMode = 'all', page = 1, limit = 20 } = {}) {
    const cleanQ = (query || character || '').trim();
    if (!cleanQ) return [];
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);

    const isCharacterSearch = Boolean(character) || searchMode === 'character';

    if (isCharacterSearch) {
      const personHits = await this.searchPeopleCredits(character || cleanQ, { page: pageNum, limit: limitNum });
      if (personHits.length > 0) return personHits;
    }

    try {
      const [showsRes, personHits] = await Promise.all([
        this.fetchWithTimeout(`${TVMAZE_BASE_URL}/search/shows?q=${encodeURIComponent(cleanQ)}`).catch(() => []),
        this.searchPeopleCredits(cleanQ, { page: pageNum, limit: limitNum }).catch(() => [])
      ]);

      const titleShows = (showsRes || []).map(r => this.normalizeTVMazeShow(r.show)).filter(Boolean);
      const combined = [...personHits, ...titleShows];
      const seen = new Set();
      const deduped = combined.filter(s => {
        if (!s || seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

      const offset = (pageNum - 1) * limitNum;
      return deduped.slice(offset, offset + limitNum);
    } catch (err) {
      console.error('[TVMazeProvider] search error:', err.message);
      return [];
    }
  }

  async getTrending({ page = 1, limit = 20 } = {}) {
    try {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 20);
      // TVMaze schedules for today / high weight shows
      const shows = await this.fetchWithTimeout(`${TVMAZE_BASE_URL}/shows?page=0`);
      // Sort by weight descending
      const sorted = (shows || []).sort((a, b) => (b.weight || 0) - (a.weight || 0));
      const offset = (pageNum - 1) * limitNum;
      const paged = sorted.slice(offset, offset + limitNum);
      return paged.map(s => this.normalizeTVMazeShow(s)).filter(Boolean);
    } catch (err) {
      console.error('[TVMazeProvider] getTrending error:', err.message);
      return [];
    }
  }

  async getDetail(externalId) {
    const id = String(externalId).replace(/^omni_tv_/, '');
    if (!id) return null;

    try {
      const [show, seasonsData] = await Promise.all([
        this.fetchWithTimeout(`${TVMAZE_BASE_URL}/shows/${id}?embed[]=episodes&embed[]=cast`),
        this.fetchWithTimeout(`${TVMAZE_BASE_URL}/shows/${id}/seasons`).catch(() => [])
      ]);
      const embedded = {
        ...(show?._embedded || {}),
        seasons: Array.isArray(seasonsData) ? seasonsData : []
      };
      return this.normalizeTVMazeShow(show, embedded);
    } catch (err) {
      console.error('[TVMazeProvider] getDetail error:', err.message);
      return null;
    }
  }
}
