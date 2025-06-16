import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from './server/server';
import { logger } from './utils/logger';
import { config } from './config';
import { initializeCache } from './cache/redis';
import { gracefulShutdown } from './utils/shutdown';

async function bootstrap() {
  try {
    // Initialize cache
    await initializeCache();
    logger.info('Cache initialized successfully');

    // Create Express app
    const app = express();

    // Apply security middleware
    app.use(helmet());
    app.use(cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
    }));

    // Request logging
    app.use(morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    }));

    // Create and start server
    const server = createServer(app);

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
      logger.info(`📚 OpenRPC documentation available at http://localhost:${config.PORT}/openrpc.json`);
      logger.info(`🔧 Interactive docs available at http://localhost:${config.PORT}/docs`);
      logger.info(`🏃 Health check available at http://localhost:${config.PORT}/health`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
bootstrap();