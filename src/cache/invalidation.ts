import { enhancedCacheService } from './enhanced-service';
import { smartTTLManager } from './smart-ttl';
import { logger } from '../utils/logger';

interface InvalidationRule {
  pattern: RegExp;
  triggers: string[];
  description: string;
  priority: 'immediate' | 'scheduled' | 'batch';
}

export class CacheInvalidator {
  private invalidationRules: InvalidationRule[] = [
    // Matchup data becomes stale during games
    {
      pattern: /^matchups:/,
      triggers: ['game_start', 'game_end', 'score_update'],
      description: 'Matchup data during games',
      priority: 'immediate',
    },
    
    // Roster data changes during waiver periods
    {
      pattern: /^rosters:/,
      triggers: ['waiver_start', 'waiver_end', 'trade_completed'],
      description: 'Roster data during transactions',
      priority: 'immediate',
    },
    
    // Trending players data is highly volatile
    {
      pattern: /^players:trending:/,
      triggers: ['waiver_period', 'game_day', 'injury_report'],
      description: 'Trending player data',
      priority: 'scheduled',
    },
    
    // Transaction data during active periods
    {
      pattern: /^transactions:/,
      triggers: ['waiver_period', 'trade_deadline', 'roster_moves'],
      description: 'Transaction data',
      priority: 'scheduled',
    },
    
    // NFL state should be fresh during season
    {
      pattern: /^state:nfl/,
      triggers: ['week_change', 'season_change', 'schedule_update'],
      description: 'NFL state data',
      priority: 'immediate',
    },
  ];

  private lastInvalidationRun: Date | null = null;
  private invalidationStats = {
    totalInvalidations: 0,
    keysByPattern: {} as Record<string, number>,
    lastRunDuration: 0,
  };

  /**
   * Invalidate cache based on trigger events
   */
  async invalidateByTrigger(trigger: string): Promise<void> {
    const startTime = Date.now();
    logger.info(`Cache invalidation triggered: ${trigger}`);

    const matchingRules = this.invalidationRules.filter(rule => 
      rule.triggers.includes(trigger)
    );

    if (matchingRules.length === 0) {
      logger.debug(`No invalidation rules match trigger: ${trigger}`);
      return;
    }

    const immediateRules = matchingRules.filter(r => r.priority === 'immediate');
    const scheduledRules = matchingRules.filter(r => r.priority === 'scheduled');

    // Process immediate invalidations first
    if (immediateRules.length > 0) {
      await this.processInvalidationRules(immediateRules);
    }

    // Schedule non-immediate invalidations
    if (scheduledRules.length > 0) {
      setTimeout(() => this.processInvalidationRules(scheduledRules), 1000);
    }

    const duration = Date.now() - startTime;
    this.invalidationStats.lastRunDuration = duration;
    this.lastInvalidationRun = new Date();

    logger.info(`Cache invalidation completed for trigger ${trigger}`, {
      rulesProcessed: matchingRules.length,
      duration,
    });
  }

  /**
   * Process invalidation rules
   */
  private async processInvalidationRules(rules: InvalidationRule[]): Promise<void> {
    for (const rule of rules) {
      try {
        await this.invalidateByPattern(rule.pattern, rule.description);
      } catch (error) {
        logger.error(`Failed to process invalidation rule: ${rule.description}`, error);
      }
    }
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  async invalidateByPattern(pattern: RegExp, description?: string): Promise<number> {
    try {
      // Get cache key patterns - in a real implementation, you'd scan Redis keys
      const keyPatterns = enhancedCacheService.getKeyPatterns();
      let invalidatedCount = 0;

      // Invalidate memory cache keys
      for (const key of keyPatterns.memory) {
        if (pattern.test(key)) {
          await enhancedCacheService.del(key);
          invalidatedCount++;
        }
      }

      // Update stats
      const patternStr = pattern.toString();
      this.invalidationStats.totalInvalidations += invalidatedCount;
      this.invalidationStats.keysByPattern[patternStr] = 
        (this.invalidationStats.keysByPattern[patternStr] || 0) + invalidatedCount;

      if (invalidatedCount > 0) {
        logger.info(`Invalidated ${invalidatedCount} cache entries`, {
          pattern: patternStr,
          description,
        });
      }

      return invalidatedCount;
    } catch (error) {
      logger.error('Error invalidating cache by pattern:', error);
      return 0;
    }
  }

  /**
   * Schedule automatic invalidations based on NFL schedule
   */
  scheduleAutomaticInvalidation(): void {
    // Check for schedule-based invalidations every 5 minutes
    setInterval(async () => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Invalidation check timeout')), 10000);
        });

        await Promise.race([
          this.checkScheduleBasedInvalidation(),
          timeoutPromise
        ]);
      } catch (error) {
        logger.error('Error in scheduled cache invalidation:', error);
      }
    }, 5 * 60 * 1000);

    logger.info('Automatic cache invalidation scheduler started');
  }

  /**
   * Check for schedule-based invalidation triggers
   */
  private async checkScheduleBasedInvalidation(): Promise<void> {
    const stats = await smartTTLManager.getCacheStats();
    const nflState = stats.nflState;
    
    if (!nflState) return;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Week change detection (Tuesdays at 1 AM)
    if (dayOfWeek === 2 && hour === 1 && minute < 5) {
      await this.invalidateByTrigger('week_change');
    }

    // Waiver period detection (Tuesday night - Wednesday morning)
    if ((dayOfWeek === 2 && hour >= 22) || (dayOfWeek === 3 && hour <= 6)) {
      if (!this.recentlyTriggered('waiver_period', 12 * 60 * 60 * 1000)) { // Once per 12 hours
        await this.invalidateByTrigger('waiver_period');
      }
    }

    // Game day detection (Sunday, Monday, Thursday)
    if ([0, 1, 4].includes(dayOfWeek)) {
      if (!this.recentlyTriggered('game_day', 6 * 60 * 60 * 1000)) { // Once per 6 hours
        await this.invalidateByTrigger('game_day');
      }
    }

    // During active season, more frequent checks
    if (nflState.season_type === 'regular' || nflState.season_type === 'post') {
      // Game time invalidations
      if (stats.isGameTime && !this.recentlyTriggered('game_start', 60 * 60 * 1000)) {
        await this.invalidateByTrigger('game_start');
      }
    }
  }

  /**
   * Check if a trigger was recently executed
   */
  private recentlyTriggered(_trigger: string, withinMs: number): boolean {
    // In a production system, you'd store trigger timestamps
    // For now, we'll use the last invalidation run as a simple check
    if (!this.lastInvalidationRun) return false;
    
    const timeSinceLastRun = Date.now() - this.lastInvalidationRun.getTime();
    return timeSinceLastRun < withinMs;
  }

  /**
   * Invalidate specific cache entries by keys
   */
  async invalidateKeys(keys: string[]): Promise<number> {
    let invalidatedCount = 0;
    
    for (const key of keys) {
      try {
        await enhancedCacheService.del(key);
        invalidatedCount++;
      } catch (error) {
        logger.warn(`Failed to invalidate key ${key}:`, error);
      }
    }

    this.invalidationStats.totalInvalidations += invalidatedCount;
    
    if (invalidatedCount > 0) {
      logger.info(`Manually invalidated ${invalidatedCount} cache entries`);
    }

    return invalidatedCount;
  }

  /**
   * Invalidate cache for a specific league
   */
  async invalidateLeague(leagueId: string): Promise<number> {
    const patterns = [
      new RegExp(`^league:${leagueId}`),
      new RegExp(`^rosters:${leagueId}`),
      new RegExp(`^users:${leagueId}`),
      new RegExp(`^matchups:${leagueId}:`),
      new RegExp(`^transactions:${leagueId}:`),
      new RegExp(`^.*bracket:${leagueId}`),
    ];

    let totalInvalidated = 0;
    
    for (const pattern of patterns) {
      const count = await this.invalidateByPattern(pattern, `League ${leagueId} data`);
      totalInvalidated += count;
    }

    logger.info(`Invalidated ${totalInvalidated} cache entries for league ${leagueId}`);
    return totalInvalidated;
  }

  /**
   * Time-based cache cleanup for expired entries
   */
  async cleanupExpiredEntries(): Promise<void> {
    // This would typically be handled by Redis TTL, but for memory cache
    // we might want to manually clean up very old entries
    
    try {
      const stats = await enhancedCacheService.getStats();
      logger.debug('Cache cleanup check', {
        memoryKeys: stats.memory.keys,
        useRedis: stats.useRedis,
      });

      // In a production system, you'd implement more sophisticated cleanup logic
      // For now, this is a placeholder for potential future enhancements
    } catch (error) {
      logger.error('Error during cache cleanup:', error);
    }
  }

  /**
   * Get invalidation statistics
   */
  getStats() {
    return {
      lastInvalidationRun: this.lastInvalidationRun,
      stats: { ...this.invalidationStats },
      rules: this.invalidationRules.map(rule => ({
        pattern: rule.pattern.toString(),
        triggers: rule.triggers,
        description: rule.description,
        priority: rule.priority,
      })),
    };
  }

  /**
   * Add custom invalidation rule
   */
  addInvalidationRule(rule: InvalidationRule): void {
    this.invalidationRules.push(rule);
    logger.info('Added custom invalidation rule', {
      pattern: rule.pattern.toString(),
      triggers: rule.triggers,
      description: rule.description,
    });
  }

  /**
   * Manual trigger for testing/admin purposes
   */
  async manualTrigger(trigger: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.invalidateByTrigger(trigger);
      return { 
        success: true, 
        message: `Successfully triggered invalidation: ${trigger}` 
      };
    } catch (error) {
      return { 
        success: false, 
        message: `Failed to trigger invalidation: ${(error as Error).message}` 
      };
    }
  }
}

// Export singleton instance
export const cacheInvalidator = new CacheInvalidator();