import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;

export async function initializeCache(): Promise<void> {
  if (!config.CACHE_ENABLED) {
    logger.info('Cache disabled by configuration');
    return;
  }

  try {
    logger.info(`Redis config - HOST: ${config.REDIS_HOST}, PORT: ${config.REDIS_PORT}, PASSWORD: ${config.REDIS_PASSWORD ? 'SET' : 'NOT SET'}`);
    
    redisClient = new Redis({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD,
      family: 0, // Enable dual-stack (IPv4 + IPv6) lookup for Railway compatibility
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis connection attempt ${times}, retrying in ${delay}ms`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 10000,
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis client error:', error);
    });

    redisClient.on('close', () => {
      logger.warn('Redis client closed');
    });

    // Test connection
    await redisClient.ping();
    logger.info('Redis connection successful');
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    // Don't throw - we'll fall back to in-memory cache
  }
}

export async function closeCache(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

export { redisClient };
