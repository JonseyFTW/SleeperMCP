import request from 'supertest';
import express from 'express';
import { createServer } from './server';

describe('Server', () => {
  let app: express.Express;
  let server: any;

  beforeAll(() => {
    app = express();
    server = createServer(app);
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('Health Check', () => {
    it('should return 200 OK for health check', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('OpenRPC Documentation', () => {
    it('should return OpenRPC specification', async () => {
      const response = await request(app).get('/openrpc.json');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('openrpc');
      expect(response.body).toHaveProperty('info');
      expect(response.body).toHaveProperty('methods');
    });

    it('should return documentation page', async () => {
      const response = await request(app).get('/docs');
      expect(response.status).toBe(200);
      expect(response.text).toContain('MCP Sleeper Fantasy Football API');
    });
  });

  describe('JSON-RPC Endpoint', () => {
    it('should handle valid JSON-RPC request', async () => {
      const response = await request(app)
        .post('/rpc')
        .send({
          jsonrpc: '2.0',
          method: 'sleeper.getNFLState',
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('id', 1);
    });

    it('should return error for invalid method', async () => {
      const response = await request(app)
        .post('/rpc')
        .send({
          jsonrpc: '2.0',
          method: 'invalid.method',
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', -32601);
    });

    it('should handle batch requests', async () => {
      const response = await request(app)
        .post('/rpc')
        .send([
          {
            jsonrpc: '2.0',
            method: 'sleeper.getNFLState',
            id: 1,
          },
          {
            jsonrpc: '2.0',
            method: 'sleeper.getNFLState',
            id: 2,
          },
        ]);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not Found');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/rpc')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(500);
    });
  });

  describe('Metrics', () => {
    it('should return metrics in JSON format', async () => {
      const response = await request(app)
        .get('/metrics')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('requests');
      expect(response.body).toHaveProperty('rpc');
    });

    it('should return metrics in Prometheus format', async () => {
      const response = await request(app)
        .get('/metrics')
        .set('Accept', 'text/plain');

      expect(response.status).toBe(200);
      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });
  });
});