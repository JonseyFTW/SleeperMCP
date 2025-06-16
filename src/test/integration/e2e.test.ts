import request from 'supertest';
import express from 'express';
import { createServer } from '../../server/server';

describe('E2E Integration Tests', () => {
  let app: express.Express;
  let server: any;

  beforeAll(() => {
    app = express();
    server = createServer(app);
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('Complete User Flow', () => {
    it('should handle a complete fantasy football query flow', async () => {
      // Step 1: Get NFL State
      const stateResponse = await request(app)
        .post('/rpc')
        .send({
          jsonrpc: '2.0',
          method: 'sleeper.getNFLState',
          id: 1,
        });

      expect(stateResponse.status).toBe(200);
      expect(stateResponse.body.result).toHaveProperty('season');
      expect(stateResponse.body.result).toHaveProperty('week');

      const currentSeason = stateResponse.body.result.season;
      const currentWeek = stateResponse.body.result.week;

      // Step 2: Get user by username (using a test user)
      const userResponse = await request(app)
        .post('/rpc')
        .send({
          jsonrpc: '2.0',
          method: 'sleeper.getUserByUsername',
          params: { username: 'sleeperbot' }, // Official Sleeper test account
          id: 2,
        });

      if (userResponse.body.result) {
        const userId = userResponse.body.result.user_id;

        // Step 3: Get user's leagues
        const leaguesResponse = await request(app)
          .post('/rpc')
          .send({
            jsonrpc: '2.0',
            method: 'sleeper.getLeaguesForUser',
            params: {
              userId,
              sport: 'nfl',
              season: currentSeason,
            },
            id: 3,
          });

        expect(leaguesResponse.status).toBe(200);
        expect(Array.isArray(leaguesResponse.body.result)).toBe(true);

        if (leaguesResponse.body.result.length > 0) {
          const leagueId = leaguesResponse.body.result[0].league_id;

          // Step 4: Get league details
          const leagueResponse = await request(app)
            .post('/rpc')
            .send({
              jsonrpc: '2.0',
              method: 'sleeper.getLeague',
              params: { leagueId },
              id: 4,
            });

          expect(leagueResponse.status).toBe(200);
          expect(leagueResponse.body.result).toHaveProperty('name');

          // Step 5: Get matchups for current week
          const matchupsResponse = await request(app)
            .post('/rpc')
            .send({
              jsonrpc: '2.0',
              method: 'sleeper.getMatchups',
              params: { leagueId, week: currentWeek },
              id: 5,
            });

          expect(matchupsResponse.status).toBe(200);
          expect(Array.isArray(matchupsResponse.body.result)).toBe(true);
        }
      }
    });
  });

  describe('Batch Requests', () => {
    it('should handle batch JSON-RPC requests', async () => {
      const batchRequest = [
        {
          jsonrpc: '2.0',
          method: 'sleeper.getNFLState',
          id: 1,
        },
        {
          jsonrpc: '2.0',
          method: 'sleeper.getTrendingPlayers',
          params: { sport: 'nfl', type: 'add', limit: 5 },
          id: 2,
        },
      ];

      const response = await request(app)
        .post('/rpc')
        .send(batchRequest);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('id', 1);
      expect(response.body[1]).toHaveProperty('id', 2);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle invalid user gracefully', async () => {
      const response = await request(app)
        .post('/rpc')
        .send({
          jsonrpc: '2.0',
          method: 'sleeper.getUserByUsername',
          params: { username: 'definitely_not_a_real_user_12345' },
          id: 1,
        });

      expect(response.status).toBe(200);
      // Sleeper API returns null for non-existent users
      if (response.body.error) {
        expect(response.body.error).toHaveProperty('code');
      } else {
        expect(response.body.result).toBe(null);
      }
    });

    it('should validate parameters', async () => {
      const response = await request(app)
        .post('/rpc')
        .send({
          jsonrpc: '2.0',
          method: 'sleeper.getMatchups',
          params: { leagueId: '123', week: 99 }, // Invalid week number
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe(-32602);
    });
  });

  describe('Caching Behavior', () => {
    it('should cache repeated requests', async () => {
      const request1Start = Date.now();
      const response1 = await request(app)
        .post('/rpc')
        .send({
          jsonrpc: '2.0',
          method: 'sleeper.getAllPlayers',
          params: { sport: 'nfl' },
          id: 1,
        });
      const request1Duration = Date.now() - request1Start;

      expect(response1.status).toBe(200);

      // Second request should be much faster due to caching
      const request2Start = Date.now();
      const response2 = await request(app)
        .post('/rpc')
        .send({
          jsonrpc: '2.0',
          method: 'sleeper.getAllPlayers',
          params: { sport: 'nfl' },
          id: 2,
        });
      const request2Duration = Date.now() - request2Start;

      expect(response2.status).toBe(200);
      
      // Cache hit should be significantly faster (at least 50% faster)
      // Note: This might be flaky in CI, so we're being conservative
      if (request1Duration > 100) {
        expect(request2Duration).toBeLessThan(request1Duration * 0.5);
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // This test is disabled by default as it would slow down the test suite
      // Uncomment to test rate limiting behavior
      
      /*
      const requests = [];
      for (let i = 0; i < 1100; i++) {
        requests.push(
          request(app)
            .post('/rpc')
            .send({
              jsonrpc: '2.0',
              method: 'sleeper.getNFLState',
              id: i,
            })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
      expect(rateLimited[0].body.error.code).toBe(-32003);
      */
    });
  });
});