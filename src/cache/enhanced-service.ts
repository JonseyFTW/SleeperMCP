import NodeCache from 'node-cache';
import { config } from '../config';
import { logger } from '../utils/logger';
import { redisClient } from './redis';
import { smartTTLManager, CacheContext } from './smart-ttl';
import { compressionManager } from './compression';

interface CacheEntry {
  data: any;
  metadata: {
    compressed: boolean;
    originalSize: number;
    compressedSize?: number;
    timestamp: number;
    version: string;
  };
}

export class EnhancedCacheService {
  private memoryCache: NodeCache;
  private useRedis: boolean = false;
  private compressionStats = {
    totalEntries: 0,
    compressedEntries: 0,
    totalSavedBytes: 0,
  };

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
            const entry: CacheEntry = JSON.parse(value);
            return await compressionManager.decompress(entry.data, entry.metadata.compressed);
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
        const entry = value as CacheEntry;
        return await compressionManager.decompress(entry.data, entry.metadata.compressed);
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
      // Compress the data
      const compressionResult = await compressionManager.compress(value);
      const entry: CacheEntry = {
        data: compressionResult.data,
        metadata: compressionManager.createCacheMetadata(
          compressionResult.compressed,
          compressionResult.originalSize,
          compressionResult.compressedSize
        ),
      };

      // Update compression stats
      this.updateCompressionStats(compressionResult);

      const serializedEntry = JSON.stringify(entry);

      if (this.useRedis && redisClient && redisClient.status === 'ready') {
        try {
          await redisClient.set(key, serializedEntry, 'EX', cacheTTL);
          logger.debug(`Cache set (Redis): ${key} (TTL: ${cacheTTL}s, Compressed: ${compressionResult.compressed})`);
        } catch (redisError) {
          logger.warn('Redis set failed, disabling Redis cache:', redisError);
          this.useRedis = false;
        }
      }

      // Also set in memory cache as backup
      this.memoryCache.set(key, entry, cacheTTL);
      logger.debug(`Cache set (Memory): ${key} (TTL: ${cacheTTL}s, Compressed: ${compressionResult.compressed})`);
    } catch (error) {
      logger.error('Cache set error:', error);
      // Continue execution even if caching fails
    }
  }

  private updateCompressionStats(result: { compressed: boolean; originalSize: number; compressedSize?: number }) {
    this.compressionStats.totalEntries++;
    
    if (result.compressed && result.compressedSize) {
      this.compressionStats.compressedEntries++;
      this.compressionStats.totalSavedBytes += result.originalSize - result.compressedSize;
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
      
      // Reset compression stats
      this.compressionStats = {
        totalEntries: 0,
        compressedEntries: 0,
        totalSavedBytes: 0,
      };
      
      logger.info('Cache flushed');
    } catch (error) {
      logger.error('Cache flush error:', error);
    }
  }

  // Smart wrapper with automatic TTL optimization and compression
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

  // Get comprehensive cache statistics
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
    
    // Get compression stats
    const compressionConfig = compressionManager.getStats();

    return {
      useRedis: this.useRedis,
      memory: memoryStats,
      smartTTL: smartStats,
      compression: {
        ...compressionConfig,
        stats: {
          ...this.compressionStats,
          compressionRatio: this.compressionStats.totalEntries > 0 
            ? (this.compressionStats.compressedEntries / this.compressionStats.totalEntries * 100).toFixed(1) + '%'
            : '0%',
          savedBytes: this.compressionStats.totalSavedBytes,
          savedMB: (this.compressionStats.totalSavedBytes / (1024 * 1024)).toFixed(2) + 'MB',
        },
      },
    };
  }

  // Utility methods for cache management
  async warmCache(keys: Array<{ key: string; fn: () => Promise<any>; dataType: string; context?: Partial<CacheContext> }>): Promise<void> {
    logger.info(`Warming cache with ${keys.length} keys`);
    
    const results = await Promise.allSettled(
      keys.map(async ({ key, fn, dataType, context }) => {
        try {
          await this.smartWrap(key, fn, dataType, context);
          return { key, status: 'success' };
        } catch (error) {
          logger.warn(`Failed to warm cache for key ${key}:`, error);
          return { key, status: 'failed', error: (error as Error).message };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 'success').length;
    logger.info(`Cache warming completed: ${successful}/${keys.length} keys warmed`);
  }

  // Get cache key patterns for monitoring
  getKeyPatterns(): { redis: string[]; memory: string[] } {
    const memoryKeys = this.memoryCache.keys();
    
    // For Redis, we'd need to scan keys (not implemented here for performance reasons)
    return {
      redis: [], // Would require SCAN operation
      memory: memoryKeys,
    };
  }
}

// Export singleton instance
export const enhancedCacheService = new EnhancedCacheService();