import express, { Express } from 'express';
import { Server } from 'http';
import jayson from 'jayson/promise';
import { config } from '../config';
import { createRPCMethods } from '../rpc';
import { errorHandler } from '../middleware/errorHandler';
import { requestLogger } from '../middleware/requestLogger';
import { rateLimiter } from '../middleware/rateLimiter';
import { healthCheck } from '../middleware/healthCheck';
import { metrics } from '../middleware/metrics';
import { openRPCDocument } from '../openrpc/document';
import { logger } from '../utils/logger';
import { sleeperAPI } from '../api/client';
// Cache imports temporarily disabled to isolate hanging issue
// import { cacheWarmer } from '../cache/warming';
// import { enhancedCacheService } from '../cache/enhanced-service';
// import { cacheInvalidator } from '../cache/invalidation';
// import { cacheManager } from '../cache/manager';

export function createServer(app: Express): Server {
  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  app.use(requestLogger);

  // Health check endpoint
  app.get(config.ENDPOINTS.HEALTH, healthCheck);

  // Metrics endpoint (if enabled)
  if (config.ENABLE_METRICS) {
    app.get(config.ENDPOINTS.METRICS, metrics);
  }

  // Request optimization endpoints
  app.get('/optimization/stats', async (_req, res) => {
    try {
      const stats = {
        compression: {
          enabled: true,
          level: 6,
          threshold: 1024
        },
        connectionPooling: {
          maxSockets: 50,
          maxFreeSockets: 10,
          keepAlive: true,
          keepAliveMsecs: 30000
        },
        batchProcessing: sleeperAPI ? sleeperAPI.getBatchStats() : { available: false }
      };
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Cache management endpoints temporarily disabled to isolate hanging issue

  // OpenRPC documentation
  app.get(config.ENDPOINTS.OPENRPC, (_req, res) => {
    res.json(openRPCDocument);
  });

  // Interactive documentation UI
  if (config.ENABLE_OPENRPC_UI) {
    app.get(config.ENDPOINTS.DOCS, (_req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>MCP Sleeper API Documentation</title>
          <style>
            body { 
              margin: 0; 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: #f5f5f5;
            }
            .header {
              background: #1976d2;
              color: white;
              padding: 1rem 2rem;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header h1 {
              margin: 0;
              font-size: 1.5rem;
            }
            .container {
              max-width: 1200px;
              margin: 2rem auto;
              padding: 0 2rem;
            }
            .info {
              background: white;
              padding: 2rem;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              margin-bottom: 2rem;
            }
            .info h2 {
              margin-top: 0;
              color: #333;
            }
            .info p {
              color: #666;
              line-height: 1.6;
            }
            .info code {
              background: #f5f5f5;
              padding: 0.2rem 0.4rem;
              border-radius: 3px;
              font-family: 'Consolas', 'Monaco', monospace;
            }
            .endpoint {
              background: #e3f2fd;
              padding: 0.5rem 1rem;
              border-radius: 4px;
              margin: 0.5rem 0;
              font-family: monospace;
            }
            #openrpc-ui {
              background: white;
              padding: 2rem;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              min-height: 600px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🏈 MCP Sleeper Fantasy Football API</h1>
          </div>
          <div class="container">
            <div class="info">
              <h2>Welcome to the MCP Sleeper API Server</h2>
              <p>
                This server provides JSON-RPC 2.0 access to the Sleeper Fantasy Football API,
                implementing the Model Context Protocol for seamless integration with LLM agents.
              </p>
              <h3>Quick Start</h3>
              <p>Send JSON-RPC requests to:</p>
              <div class="endpoint">POST ${config.ENDPOINTS.RPC}</div>
              
              <h3>Example Request</h3>
              <pre><code>{
  "jsonrpc": "2.0",
  "method": "sleeper.getUserByUsername",
  "params": {
    "username": "example_user"
  },
  "id": 1
}</code></pre>

              <h3>Available Endpoints</h3>
              <div class="endpoint">POST ${config.ENDPOINTS.RPC} - JSON-RPC endpoint</div>
              <div class="endpoint">GET ${config.ENDPOINTS.HEALTH} - Health check</div>
              <div class="endpoint">GET ${config.ENDPOINTS.OPENRPC} - OpenRPC specification</div>
              ${config.ENABLE_METRICS ? `<div class="endpoint">GET ${config.ENDPOINTS.METRICS} - Prometheus metrics</div>` : ''}
            </div>
            
            <h2>Interactive API Explorer</h2>
            <div id="openrpc-ui">
              <p>Loading interactive documentation...</p>
            </div>
          </div>
          
          <script>
            // In a production environment, you would include a proper OpenRPC UI library here
            // For now, we'll show a simple message
            document.getElementById('openrpc-ui').innerHTML = \`
              <p>To explore the API interactively, use the OpenRPC specification at:</p>
              <div class="endpoint">
                <a href="${config.ENDPOINTS.OPENRPC}" target="_blank">${config.ENDPOINTS.OPENRPC}</a>
              </div>
              <p>You can import this specification into tools like:</p>
              <ul>
                <li><a href="https://playground.open-rpc.org/" target="_blank">OpenRPC Playground</a></li>
                <li><a href="https://www.postman.com/" target="_blank">Postman</a></li>
                <li><a href="https://insomnia.rest/" target="_blank">Insomnia</a></li>
              </ul>
            \`;
          </script>
        </body>
        </html>
      `);
    });
  }

  // Rate limiting for RPC endpoint
  app.use(config.ENDPOINTS.RPC, rateLimiter);

  // Create JSON-RPC server
  const rpcMethods = createRPCMethods();
  const rpcServer = new jayson.Server(rpcMethods, {
    useContext: true,
  });

  // JSON-RPC endpoint
  app.post(config.ENDPOINTS.RPC, (req, res): void => {
    logger.debug('RPC request:', {
      method: req.body.method,
      id: req.body.id,
      params: req.body.params,
    });

    rpcServer.call(req.body, { req, res }, (err: any, result: any): void => {
      if (err) {
        logger.error('RPC error:', err);
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: err.message,
          },
          id: req.body.id || null,
        });
        return;
      }

      res.json(
        result || {
          jsonrpc: '2.0',
          result: null,
          id: req.body.id || null,
        }
      );
    });

    // Callback handles the response, no explicit return needed
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`,
      availableEndpoints: Object.values(config.ENDPOINTS),
    });
  });

  // Error handling middleware
  app.use(errorHandler);

  return require('http').createServer(app);
}
