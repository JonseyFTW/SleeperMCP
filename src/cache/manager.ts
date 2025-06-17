import { enhancedCacheService } from './enhanced-service';
import { cacheWarmer } from './warming';
import { cacheInvalidator } from './invalidation';
import { compressionManager } from './compression';
import { logger } from '../utils/logger';

export interface CacheHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: {
    redis: 'connected' | 'disconnected' | 'error';
    memory: 'ok' | 'high' | 'critical';
    compression: 'enabled' | 'disabled' | 'error';
    warming: 'active' | 'inactive' | 'error';
    invalidation: 'active' | 'inactive' | 'error';
  };
  recommendations: string[];
}

export interface CachePerformanceMetrics {
  hitRate: number;
  missRate: number;
  avgResponseTime: number;
  compressionRatio: number;
  memoryUsage: {
    current: number;
    peak: number;
    limit: number;
    percentage: number;
  };
  keyDistribution: Record<string, number>;
  ttlDistribution: Record<string, number>;
}

export class CacheManager {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private performanceMetrics: CachePerformanceMetrics | null = null;

  /**
   * Get comprehensive cache health status
   */
  async getHealthStatus(): Promise<CacheHealthStatus> {
    const recommendations: string[] = [];
    
    try {
      const stats = await enhancedCacheService.getStats();
      const warmingStats = cacheWarmer.getStats();
      const invalidationStats = cacheInvalidator.getStats();

      // Check Redis connection
      const redisStatus = stats.useRedis ? 'connected' : 'disconnected';
      if (!stats.useRedis) {
        recommendations.push('Redis connection unavailable - using memory cache only');
      }

      // Check memory usage
      const memoryUsage = stats.memory.vsize || 0;
      const memoryLimit = 100 * 1024 * 1024; // 100MB limit for demo
      const memoryPercentage = (memoryUsage / memoryLimit) * 100;
      
      let memoryStatus: 'ok' | 'high' | 'critical' = 'ok';
      if (memoryPercentage > 90) {
        memoryStatus = 'critical';
        recommendations.push('Memory usage critical - consider cache cleanup or increase limits');
      } else if (memoryPercentage > 70) {
        memoryStatus = 'high';
        recommendations.push('Memory usage high - monitor cache growth');
      }

      // Check compression
      const compressionStatus = stats.compression?.enabled ? 'enabled' : 'disabled';
      if (!stats.compression?.enabled) {
        recommendations.push('Cache compression disabled - enable for better memory efficiency');
      }

      // Check warming
      const warmingStatus = warmingStats.warmingInProgress ? 'active' : 
        warmingStats.lastWarmingTime ? 'inactive' : 'error';
      if (!warmingStats.lastWarmingTime) {
        recommendations.push('Cache warming has never run - consider manual warming');
      }

      // Check invalidation
      const invalidationStatus = invalidationStats.lastInvalidationRun ? 'active' : 'inactive';

      // Overall health determination
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (memoryStatus === 'critical') {
        overallStatus = 'unhealthy';
      } else if (memoryStatus === 'high' || !stats.useRedis || warmingStatus === 'error' || redisStatus === 'disconnected') {
        overallStatus = 'degraded';
      }

      return {
        status: overallStatus,
        details: {
          redis: redisStatus,
          memory: memoryStatus,
          compression: compressionStatus,
          warming: warmingStatus,
          invalidation: invalidationStatus,
        },
        recommendations,
      };
    } catch (error) {
      logger.error('Error checking cache health:', error);
      return {
        status: 'unhealthy',
        details: {
          redis: 'error',
          memory: 'critical',
          compression: 'error',
          warming: 'error',
          invalidation: 'error',
        },
        recommendations: ['Cache system error - check logs for details'],
      };
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<CachePerformanceMetrics> {
    try {
      const stats = await enhancedCacheService.getStats();
      
      const totalRequests = stats.memory.hits + stats.memory.misses;
      const hitRate = totalRequests > 0 ? (stats.memory.hits / totalRequests) * 100 : 0;
      const missRate = totalRequests > 0 ? (stats.memory.misses / totalRequests) * 100 : 0;

      // Key distribution analysis
      const keyPatterns = enhancedCacheService.getKeyPatterns();
      const keyDistribution: Record<string, number> = {};
      
      for (const key of keyPatterns.memory) {
        const pattern = this.getKeyPattern(key);
        keyDistribution[pattern] = (keyDistribution[pattern] || 0) + 1;
      }

      // TTL distribution (would need to track this separately in real implementation)
      const ttlDistribution = {
        'short (< 1h)': 0,
        'medium (1h-24h)': 0,
        'long (> 24h)': 0,
      };

      return {
        hitRate,
        missRate,
        avgResponseTime: 0, // Would need to track this
        compressionRatio: parseFloat(stats.compression?.stats?.compressionRatio?.replace('%', '') || '0'),
        memoryUsage: {
          current: stats.memory.vsize || 0,
          peak: stats.memory.vsize || 0, // Would need to track peak
          limit: 100 * 1024 * 1024, // 100MB demo limit
          percentage: ((stats.memory.vsize || 0) / (100 * 1024 * 1024)) * 100,
        },
        keyDistribution,
        ttlDistribution,
      };
    } catch (error) {
      logger.error('Error getting performance metrics:', error);
      throw error;
    }
  }

  /**
   * Extract pattern from cache key
   */
  private getKeyPattern(key: string): string {
    const parts = key.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}:*`;
    }
    return key;
  }

  /**
   * Perform cache optimization
   */
  async optimizeCache(): Promise<{ success: boolean; actions: string[]; metrics: any }> {
    const actions: string[] = [];
    
    try {
      const healthStatus = await this.getHealthStatus();
      const beforeMetrics = await this.getPerformanceMetrics();

      // Optimization actions based on health status
      if (healthStatus.details.memory === 'critical' || healthStatus.details.memory === 'high') {
        await cacheInvalidator.cleanupExpiredEntries();
        actions.push('Cleaned up expired cache entries');
      }

      // Re-warm frequently accessed data if hit rate is low
      if (beforeMetrics.hitRate < 50) {
        await cacheWarmer.warmCache();
        actions.push('Re-warmed frequently accessed cache data');
      }

      // Enable compression if not enabled and memory usage is high
      if (healthStatus.details.compression === 'disabled' && 
          beforeMetrics.memoryUsage.percentage > 50) {
        compressionManager.updateOptions({ enabled: true });
        actions.push('Enabled cache compression');
      }

      // Trigger invalidation of stale data
      await cacheInvalidator.invalidateByTrigger('optimization');
      actions.push('Invalidated potentially stale cache data');

      const afterMetrics = await this.getPerformanceMetrics();

      return {
        success: true,
        actions,
        metrics: {
          before: beforeMetrics,
          after: afterMetrics,
          improvement: {
            memoryReduction: beforeMetrics.memoryUsage.current - afterMetrics.memoryUsage.current,
            hitRateChange: afterMetrics.hitRate - beforeMetrics.hitRate,
          },
        },
      };
    } catch (error) {
      logger.error('Cache optimization failed:', error);
      return {
        success: false,
        actions,
        metrics: null,
      };
    }
  }

  /**
   * Generate cache usage report
   */
  async generateReport(): Promise<any> {
    try {
      const health = await this.getHealthStatus();
      const performance = await this.getPerformanceMetrics();
      const cacheStats = await enhancedCacheService.getStats();
      const warmingStats = cacheWarmer.getStats();
      const invalidationStats = cacheInvalidator.getStats();

      return {
        timestamp: new Date().toISOString(),
        health,
        performance,
        configuration: {
          compression: compressionManager.getStats(),
          smartTTL: cacheStats.smartTTL,
        },
        activities: {
          warming: warmingStats,
          invalidation: invalidationStats,
        },
        recommendations: this.generateRecommendations(health, performance),
      };
    } catch (error) {
      logger.error('Error generating cache report:', error);
      throw error;
    }
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    health: CacheHealthStatus, 
    performance: CachePerformanceMetrics
  ): string[] {
    const recommendations: string[] = [...health.recommendations];

    // Performance-based recommendations
    if (performance.hitRate < 60) {
      recommendations.push('Low cache hit rate - consider warming more data or adjusting TTL strategies');
    }

    if (performance.compressionRatio < 20 && performance.memoryUsage.percentage > 50) {
      recommendations.push('Low compression ratio with high memory usage - review cached data types');
    }

    if (Object.keys(performance.keyDistribution).length > 10) {
      recommendations.push('High key pattern diversity - consider cache partitioning strategies');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Start continuous health monitoring
   */
  startHealthMonitoring(intervalMinutes = 5): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), 5000);
        });

        const health = await Promise.race([
          this.getHealthStatus(),
          timeoutPromise
        ]) as any;
        
        if (health.status === 'unhealthy') {
          logger.error('Cache health check failed', health);
          // In production, you might trigger alerts here
        } else if (health.status === 'degraded') {
          logger.warn('Cache health degraded', health);
        }

        // Update performance metrics with timeout
        const metricsPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Metrics timeout')), 5000);
        });

        this.performanceMetrics = await Promise.race([
          this.getPerformanceMetrics(),
          metricsPromise
        ]) as any;
      } catch (error) {
        logger.error('Health monitoring error:', error);
      }
    }, intervalMinutes * 60 * 1000);

    logger.info(`Cache health monitoring started (interval: ${intervalMinutes} minutes)`);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Cache health monitoring stopped');
    }
  }

  /**
   * Get current cached performance metrics
   */
  getCachedPerformanceMetrics(): CachePerformanceMetrics | null {
    return this.performanceMetrics;
  }

  /**
   * Emergency cache reset
   */
  async emergencyReset(): Promise<{ success: boolean; message: string }> {
    try {
      logger.warn('Performing emergency cache reset');
      
      // Flush all caches
      await enhancedCacheService.flush();
      
      // Reset compression stats
      compressionManager.updateOptions({ enabled: true });
      
      // Trigger immediate warming of critical data
      await cacheWarmer.warmCache(true);
      
      logger.info('Emergency cache reset completed');
      return { success: true, message: 'Cache emergency reset completed successfully' };
    } catch (error) {
      logger.error('Emergency cache reset failed:', error);
      return { success: false, message: `Emergency reset failed: ${(error as Error).message}` };
    }
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();