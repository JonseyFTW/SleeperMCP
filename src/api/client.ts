import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { CacheService } from '../cache/service';

export class SleeperAPIClient {
  private client: AxiosInstance;
  private cache: CacheService;

  constructor() {
    this.client = axios.create({
      baseURL: config.SLEEPER_API_BASE_URL,
      timeout: config.SLEEPER_API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MCP-Sleeper-Server/1.0.0',
      },
    });

    this.cache = new CacheService();

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (request) => {
        logger.debug('Sleeper API request:', {
          method: request.method,
          url: request.url,
          params: request.params,
        });
        return request;
      },
      (error) => {
        logger.error('Sleeper API request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Sleeper API response:', {
          status: response.status,
          url: response.config.url,
          data: response.data,
        });
        return response;
      },
      (error: AxiosError) => {
        logger.error('Sleeper API response error:', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  // User endpoints
  async getUserByUsername(username: string) {
    const cacheKey = `user:username:${username}`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get(`/user/${username}`).then(res => res.data),
      config.CACHE_TTL.USER
    );
  }

  async getUserById(userId: string) {
    const cacheKey = `user:id:${userId}`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get(`/user/${userId}`).then(res => res.data),
      config.CACHE_TTL.USER
    );
  }

  // League endpoints
  async getLeaguesForUser(userId: string, sport: string = 'nfl', season: string) {
    const cacheKey = `leagues:user:${userId}:${sport}:${season}`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get(`/user/${userId}/leagues/${sport}/${season}`).then(res => res.data),
      config.CACHE_TTL.LEAGUE
    );
  }

  async getLeague(leagueId: string) {
    const cacheKey = `league:${leagueId}`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get(`/league/${leagueId}`).then(res => res.data),
      config.CACHE_TTL.LEAGUE
    );
  }

  async getRosters(leagueId: string) {
    const cacheKey = `rosters:${leagueId}`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get(`/league/${leagueId}/rosters`).then(res => res.data),
      config.CACHE_TTL.ROSTER
    );
  }

  async getUsers(leagueId: string) {
    const cacheKey = `users:${leagueId}`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get(`/league/${leagueId}/users`).then(res => res.data),
      config.CACHE_TTL.USER
    );
  }

  async getMatchups(leagueId: string, week: number) {
    const cacheKey = `matchups:${leagueId}:${week}`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get(`/league/${leagueId}/matchups/${week}`).then(res => res.data),
      config.CACHE_TTL.MATCHUP
    );
  }

  async getWinnersBracket(leagueId: string) {
    const cacheKey = `winners_bracket:${leagueId}`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get(`/league/${leagueId}/winners_bracket`).then(res => res.data),
      config.CACHE_TTL.LEAGUE
    );
  }

  async getLosersBracket(leagueId: string) {
    const cacheKey = `losers_bracket:${leagueId}`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get(`/league/${leagueId}/losers_bracket`).then(res => res.data),
      config.CACHE_TTL.LEAGUE
    );
  }

  async getTransactions(leagueId: string, week: number) {
    const cacheKey = `transactions:${leagueId}:${week}`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get(`/league/${leagueId}/transactions/${week}`).then(res => res.data),
      config.CACHE_TTL.TRANSACTION
    );
  }

  async getTradedPicks(leagueId: string) {
    const cacheKey = `traded_picks:${leagueId}`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get(`/league/${leagueId}/traded_picks`).then(res => res.data),
      config.CACHE_TTL.DRAFT
    );
  }

  // Player endpoints
  async getAllPlayers(sport: string = 'nfl') {
    const cacheKey = `players:all:${sport}`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get(`/players/${sport}`).then(res => res.data),
      config.CACHE_TTL.PLAYER
    );
  }

  async getTrendingPlayers(sport: string = 'nfl', type: 'add' | 'drop' = 'add', lookback?: number, limit?: number) {
    const params = { type, lookback_hours: lookback, limit };
    const cacheKey = `players:trending:${sport}:${type}:${lookback}:${limit}`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get(`/players/${sport}/trending/${type}`, { params }).then(res => res.data),
      config.CACHE_TTL.TRENDING
    );
  }

  // Draft endpoints
  async getDraftsForUser(userId: string, sport: string = 'nfl', season: string) {
    const cacheKey = `drafts:user:${userId}:${sport}:${season}`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get(`/user/${userId}/drafts/${sport}/${season}`).then(res => res.data),
      config.CACHE_TTL.DRAFT
    );
  }

  async getDraftsForLeague(leagueId: string) {
    const cacheKey = `drafts:league:${leagueId}`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get(`/league/${leagueId}/drafts`).then(res => res.data),
      config.CACHE_TTL.DRAFT
    );
  }

  async getDraft(draftId: string) {
    const cacheKey = `draft:${draftId}`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get(`/draft/${draftId}`).then(res => res.data),
      config.CACHE_TTL.DRAFT
    );
  }

  async getDraftPicks(draftId: string) {
    const cacheKey = `draft:picks:${draftId}`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get(`/draft/${draftId}/picks`).then(res => res.data),
      config.CACHE_TTL.DRAFT
    );
  }

  async getTradedDraftPicks(draftId: string) {
    const cacheKey = `draft:traded_picks:${draftId}`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get(`/draft/${draftId}/traded_picks`).then(res => res.data),
      config.CACHE_TTL.DRAFT
    );
  }

  // State endpoints
  async getNFLState() {
    const cacheKey = `state:nfl`;
    return this.cache.wrap(
      cacheKey,
      () => this.client.get('/state/nfl').then(res => res.data),
      config.CACHE_TTL.NFL_STATE
    );
  }
}

// Export singleton instance
export const sleeperAPI = new SleeperAPIClient();