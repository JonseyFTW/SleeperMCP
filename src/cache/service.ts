import NodeCache from 'node-cache';
import { config } from '../config';
import { logger } from '../utils/logger';
import { redisClient } from './redis';

export class CacheService {
  private memoryCache: NodeCache;
  private useRedis: boolean = false;

  constructor() {
    // Initialize in-memory cache as fallback
    this.memoryCache = new NodeCache({
      stdTTL: config.CACHE_DEFAULT_TTL,
      checkperiod: 120,
      useClones: false,
    });

    // Check if Redis is available
    this.checkRedisConnection();
  }

  private async checkRedisConnection() {
    try {
      if (redisClient && redisClient.status === 'ready') {
        this.useRedis = true;
        logger.info('Using Redis for caching');
      }
    } catch (error) {
      logger.warn('Redis not available, falling back to in-memory cache');
      this.useRedis = false;
    }
  }

  async get(key: string): Promise<any> {
    if (!config.CACHE_ENABLED) return null;

    try {
      if (this.useRedis && redisClient) {
        const value = await redisClient.get(key);
        if (value) {
          logger.debug(`Cache hit (Redis): ${key}`);
          return JSON.parse(value);
        }
      }

      // Fallback to memory cache
      const value = this.memoryCache.get(key);
      if (value !== undefined) {
        logger.debug(`Cache hit (Memory): ${key}`);
        return value;
      }

      logger.debug(`Cache miss: ${key}`);
      return null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!config.CACHE_ENABLED) return;

    const cacheTTL = ttl || config.CACHE_DEFAULT_TTL;

    try {
      if (this.useRedis && redisClient) {
        await redisClient.set(key, JSON.stringify(value), 'EX', cacheTTL);
        logger.debug(`Cache set (Redis): ${key} (TTL: ${cacheTTL}s)`);
      }

      // Also set in memory cache as backup
      this.memoryCache.set(key, value, cacheTTL);
      logger.debug(`Cache set (Memory): ${key} (TTL: ${cacheTTL}s)`);
    } catch (error) {
      logger.error('Cache set error:', error);
      // Continue execution even if caching fails
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (this.useRedis && redisClient) {
        await redisClient.del(key);
      }
      this.memoryCache.del(key);
      logger.debug(`Cache delete: ${key}`);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  async flush(): Promise<void> {
    try {
      if (this.useRedis && redisClient) {
        await redisClient.flushdb();
      }
      this.memoryCache.flushAll();
      logger.info('Cache flushed');
    } catch (error) {
      logger.error('Cache flush error:', error);
    }
  }

  // Wrapper function for automatic caching
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Check cache first
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    try {
      const result = await fn();
      await this.set(key, result, ttl);
      return result;
    } catch (error) {
      logger.error(`Error executing wrapped function for key ${key}:`, error);
      throw error;
    }
  }

  // Get cache statistics
  getStats() {
    const memoryStats = {
      keys: this.memoryCache.keys().length,
      hits: this.memoryCache.getStats().hits,
      misses: this.memoryCache.getStats().misses,
      ksize: this.memoryCache.getStats().ksize,
      vsize: this.memoryCache.getStats().vsize,
    };

    return {
      useRedis: this.useRedis,
      memory: memoryStats,
    };
  }
}