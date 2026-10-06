/**
 * BaseProvider - Abstract Provider Adapter with resilient fetch, timeout, and retry
 */
export class BaseProvider {
  constructor(name, capabilities = {}) {
    this.name = name;
    this.capabilities = {
      movies: false,
      series: false,
      anime: false,
      episodes: false,
      trailers: false,
      watchProviders: false,
      ...capabilities
    };
  }

  async fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`[${this.name}] HTTP ${response.status}: ${response.statusText} for ${url}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`[${this.name}] Request timed out after ${timeoutMs}ms for ${url}`);
      }
      throw err;
    }
  }

  // Subclasses override these methods
  async search(query, options = {}) {
    return [];
  }

  async getTrending(options = {}) {
    return [];
  }

  async getUpcoming(options = {}) {
    return [];
  }

  async getDetail(externalId) {
    return null;
  }

  async getEpisodes(externalId) {
    return [];
  }

  async getWatchProviders(externalId, region = 'US') {
    return [];
  }

  async getTrailers(externalId) {
    return [];
  }
}
