import NodeCache from 'node-cache';
import { config } from '../config';
import { logger } from '../utils/logger';
import { redisClient } from './redis';
import { smartTTLManager, CacheContext } from './smart-ttl';

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

    // Check if Redis is available - don't await in constructor
    this.checkRedisConnection().catch((error) => {
      logger.warn('Failed to check Redis connection:', error);
      this.useRedis = false;
    });
  }

  private async checkRedisConnection() {
    try {
      if (redisClient && redisClient.status === 'ready') {
        // Test the connection with a ping
        await redisClient.ping();
        this.useRedis = true;
        logger.info('Using Redis for caching');
      } else {
        this.useRedis = false;
        logger.info('Redis not ready, using in-memory cache only');
      }
    } catch (error) {
      logger.warn('Redis not available, falling back to in-memory cache:', error);
      this.useRedis = false;
    }
  }

  async get(key: string): Promise<any> {
    if (!config.CACHE_ENABLED) {
      return null;
    }

    try {
      if (this.useRedis && redisClient && redisClient.status === 'ready') {
        try {
          const value = await redisClient.get(key);
          if (value) {
            logger.debug(`Cache hit (Redis): ${key}`);
            return JSON.parse(value);
          }
        } catch (redisError) {
          logger.warn('Redis get failed, falling back to memory cache:', redisError);
          this.useRedis = false;
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
    if (!config.CACHE_ENABLED) {
      return;
    }

    const cacheTTL = ttl || config.CACHE_DEFAULT_TTL;

    try {
      if (this.useRedis && redisClient && redisClient.status === 'ready') {
        try {
          await redisClient.set(key, JSON.stringify(value), 'EX', cacheTTL);
          logger.debug(`Cache set (Redis): ${key} (TTL: ${cacheTTL}s)`);
        } catch (redisError) {
          logger.warn('Redis set failed, disabling Redis cache:', redisError);
          this.useRedis = false;
        }
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
      if (this.useRedis && redisClient && redisClient.status === 'ready') {
        try {
          await redisClient.del(key);
        } catch (redisError) {
          logger.warn('Redis delete failed:', redisError);
          this.useRedis = false;
        }
      }
      this.memoryCache.del(key);
      logger.debug(`Cache delete: ${key}`);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  async flush(): Promise<void> {
    try {
      if (this.useRedis && redisClient && redisClient.status === 'ready') {
        try {
          await redisClient.flushdb();
        } catch (redisError) {
          logger.warn('Redis flush failed:', redisError);
          this.useRedis = false;
        }
      }
      this.memoryCache.flushAll();
      logger.info('Cache flushed');
    } catch (error) {
      logger.error('Cache flush error:', error);
    }
  }

  // Wrapper function for automatic caching
  async wrap<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
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

  // Smart wrapper with automatic TTL optimization
  async smartWrap<T>(
    key: string,
    fn: () => Promise<T>,
    dataType: string,
    context?: Partial<CacheContext>
  ): Promise<T> {
    // Check cache first
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result with smart TTL
    try {
      const result = await fn();
      const optimalTTL = await smartTTLManager.getContextualTTL(dataType, context);
      
      logger.debug(`Smart cache set: ${key}`, {
        dataType,
        ttl: optimalTTL,
        context,
      });
      
      await this.set(key, result, optimalTTL);
      return result;
    } catch (error) {
      logger.error(`Error executing smart wrapped function for key ${key}:`, error);
      throw error;
    }
  }

  // Convenience method for setting with smart TTL
  async smartSet(
    key: string,
    value: any,
    dataType: string,
    context?: Partial<CacheContext>
  ): Promise<void> {
    const optimalTTL = await smartTTLManager.getContextualTTL(dataType, context);
    await this.set(key, value, optimalTTL);
  }

  // Get cache statistics
  async getStats() {
    const memoryStats = {
      keys: this.memoryCache.keys().length,
      hits: this.memoryCache.getStats().hits,
      misses: this.memoryCache.getStats().misses,
      ksize: this.memoryCache.getStats().ksize,
      vsize: this.memoryCache.getStats().vsize,
    };

    // Get smart TTL stats
    const smartStats = await smartTTLManager.getCacheStats();

    return {
      useRedis: this.useRedis,
      memory: memoryStats,
      smartTTL: smartStats,
    };
  }
}
