import axios from 'axios';
import { SleeperAPIClient } from './client';
// import { CacheService } from '../cache/service';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock cache service
jest.mock('../cache/service', () => ({
  CacheService: jest.fn().mockImplementation(() => ({
    wrap: jest.fn().mockImplementation((_key, fn, _ttl) => fn()),
  })),
}));

describe('SleeperAPIClient', () => {
  let client: SleeperAPIClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAxiosInstance = {
      get: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    client = new SleeperAPIClient();
  });

  describe('User endpoints', () => {
    it('should get user by username', async () => {
      const mockUser = { user_id: '123', username: 'testuser' };
      mockAxiosInstance.get.mockResolvedValue({ data: mockUser });

      const result = await client.getUserByUsername('testuser');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/user/testuser');
      expect(result).toEqual(mockUser);
    });

    it('should get user by ID', async () => {
      const mockUser = { user_id: '123', username: 'testuser' };
      mockAxiosInstance.get.mockResolvedValue({ data: mockUser });

      const result = await client.getUserById('123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/user/123');
      expect(result).toEqual(mockUser);
    });
  });

  describe('League endpoints', () => {
    it('should get leagues for user', async () => {
      const mockLeagues = [{ league_id: '456', name: 'Test League' }];
      mockAxiosInstance.get.mockResolvedValue({ data: mockLeagues });

      const result = await client.getLeaguesForUser('123', 'nfl', '2024');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/user/123/leagues/nfl/2024');
      expect(result).toEqual(mockLeagues);
    });

    it('should get league details', async () => {
      const mockLeague = { league_id: '456', name: 'Test League' };
      mockAxiosInstance.get.mockResolvedValue({ data: mockLeague });

      const result = await client.getLeague('456');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/league/456');
      expect(result).toEqual(mockLeague);
    });

    it('should get rosters', async () => {
      const mockRosters = [{ roster_id: 1, owner_id: '123' }];
      mockAxiosInstance.get.mockResolvedValue({ data: mockRosters });

      const result = await client.getRosters('456');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/league/456/rosters');
      expect(result).toEqual(mockRosters);
    });

    it('should get matchups', async () => {
      const mockMatchups = [{ matchup_id: 1, roster_id: 1 }];
      mockAxiosInstance.get.mockResolvedValue({ data: mockMatchups });

      const result = await client.getMatchups('456', 10);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/league/456/matchups/10');
      expect(result).toEqual(mockMatchups);
    });

    it('should get transactions', async () => {
      const mockTransactions = [{ transaction_id: '789', type: 'trade' }];
      mockAxiosInstance.get.mockResolvedValue({ data: mockTransactions });

      const result = await client.getTransactions('456', 10);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/league/456/transactions/10');
      expect(result).toEqual(mockTransactions);
    });
  });

  describe('Player endpoints', () => {
    it('should get all players', async () => {
      const mockPlayers = { '1234': { player_id: '1234', full_name: 'Test Player' } };
      mockAxiosInstance.get.mockResolvedValue({ data: mockPlayers });

      const result = await client.getAllPlayers('nfl');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/players/nfl');
      expect(result).toEqual(mockPlayers);
    });

    it('should get trending players', async () => {
      const mockTrending = [{ player_id: '1234', count: 100 }];
      mockAxiosInstance.get.mockResolvedValue({ data: mockTrending });

      const result = await client.getTrendingPlayers('nfl', 'add', 24, 25);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/players/nfl/trending/add',
        { params: { type: 'add', lookback_hours: 24, limit: 25 } }
      );
      expect(result).toEqual(mockTrending);
    });
  });

  describe('Draft endpoints', () => {
    it('should get drafts for user', async () => {
      const mockDrafts = [{ draft_id: '999', status: 'complete' }];
      mockAxiosInstance.get.mockResolvedValue({ data: mockDrafts });

      const result = await client.getDraftsForUser('123', 'nfl', '2024');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/user/123/drafts/nfl/2024');
      expect(result).toEqual(mockDrafts);
    });

    it('should get draft picks', async () => {
      const mockPicks = [{ pick_no: 1, player_id: '1234' }];
      mockAxiosInstance.get.mockResolvedValue({ data: mockPicks });

      const result = await client.getDraftPicks('999');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/draft/999/picks');
      expect(result).toEqual(mockPicks);
    });
  });

  describe('State endpoints', () => {
    it('should get NFL state', async () => {
      const mockState = { week: 10, season: '2024', season_type: 'regular' };
      mockAxiosInstance.get.mockResolvedValue({ data: mockState });

      const result = await client.getNFLState();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/state/nfl');
      expect(result).toEqual(mockState);
    });
  });

  describe('Error handling', () => {
    it('should handle 404 errors', async () => {
      const error = {
        response: { status: 404, data: 'Not Found' },
        config: { url: '/user/invalid' },
      };
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(client.getUserByUsername('invalid')).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      const error = {
        code: 'ETIMEDOUT',
        config: { url: '/user/test' },
      };
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(client.getUserByUsername('test')).rejects.toThrow();
    });
  });
});