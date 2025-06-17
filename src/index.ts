import 'dotenv/config';

console.log('🚀 Starting MCP Sleeper Server...');
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { createServer } from './server/server';
import { logger } from './utils/logger';
import { config } from './config';
import { initializeCache } from './cache/redis';
import { gracefulShutdown } from './utils/shutdown';
import { analyticsService } from './analytics/service';
// Advanced cache imports temporarily disabled to avoid circular dependencies
// import { cacheWarmer } from './cache/warming';
// import { cacheInvalidator } from './cache/invalidation';
// import { cacheManager } from './cache/manager';

async function bootstrap() {
  try {
    // Initialize cache
    await initializeCache();
    logger.info('Cache initialized successfully');

    // Initialize analytics service (optional - will gracefully fail if PostgreSQL not available)
    try {
      await analyticsService.initialize();
      logger.info('Analytics service initialized successfully');
    } catch (error) {
      logger.warn('Analytics service initialization failed (continuing without analytics):', error);
    }

    // Create Express app
    const app = express();

    // Apply compression middleware first
    app.use(compression({
      filter: (req, res) => {
        // Don't compress responses with this request header
        if (req.headers['x-no-compression']) {
          return false;
        }
        // Fallback to standard filter function
        return compression.filter(req, res);
      },
      level: 6, // Good balance between compression ratio and speed
      threshold: 1024, // Only compress responses > 1KB
    }));

    // Apply security middleware
    app.use(helmet());
    app.use(
      cors({
        origin: config.CORS_ORIGIN,
        credentials: true,
      })
    );

    // Request logging
    app.use(
      morgan('combined', {
        stream: {
          write: (message) => logger.info(message.trim()),
        },
      })
    );

    console.log('About to create server...');
    // Create and start server
    const server = createServer(app);
    console.log('Server created successfully!');

    // Handle graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT', () => gracefulShutdown(server));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown(server);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown(server);
    });

    // Start server
    server.listen(config.PORT, () => {
      logger.info(`🚀 MCP Sleeper Server running on port ${config.PORT}`);
      logger.info(
        `📚 OpenRPC documentation available at http://localhost:${config.PORT}/openrpc.json`
      );
      logger.info(`🔧 Interactive docs available at http://localhost:${config.PORT}/docs`);
      logger.info(`🏃 Health check available at http://localhost:${config.PORT}/health`);
      
      // All schedulers disabled for testing - server should work without them
      logger.info(`📊 Basic server running without cache schedulers`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
bootstrap();
