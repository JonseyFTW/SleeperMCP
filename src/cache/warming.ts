import { sleeperAPI } from '../api/client';
import { enhancedCacheService } from './enhanced-service';
import { smartTTLManager } from './smart-ttl';
import { logger } from '../utils/logger';

interface WarmingTask {
  key: string;
  fn: () => Promise<any>;
  dataType: string;
  context?: any;
  priority: 'high' | 'medium' | 'low';
  description: string;
}

export class CacheWarmer {
  private warmingInProgress = false;
  private lastWarmingTime: Date | null = null;
  private warmingStats = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    lastDuration: 0,
  };

  /**
   * Get frequently accessed data for cache warming
   */
  async getWarmingTasks(): Promise<WarmingTask[]> {
    const tasks: WarmingTask[] = [];
    
    try {
      // Always warm NFL state first - it's used for TTL calculations
      tasks.push({
        key: 'state:nfl',
        fn: () => sleeperAPI.getNFLState(),
        dataType: 'nfl_state',
        priority: 'high',
        description: 'NFL State',
      });

      // Get current NFL state to determine what else to warm
      const nflState = await sleeperAPI.getNFLState();
      
      // Warm all players data - large but frequently accessed
      tasks.push({
        key: 'players:all:nfl',
        fn: () => sleeperAPI.getAllPlayers('nfl'),
        dataType: 'player',
        priority: 'high',
        description: 'All NFL Players',
      });

      // Warm trending players data
      tasks.push({
        key: 'players:trending:nfl:add::',
        fn: () => sleeperAPI.getTrendingPlayers('nfl', 'add'),
        dataType: 'trending',
        priority: 'medium',
        description: 'Trending Add Players',
      });

      tasks.push({
        key: 'players:trending:nfl:drop::',
        fn: () => sleeperAPI.getTrendingPlayers('nfl', 'drop'),
        dataType: 'trending',
        priority: 'medium',
        description: 'Trending Drop Players',
      });

      // During active season, warm current week data
      if (nflState.season_type === 'regular' || nflState.season_type === 'post') {
        // These would require actual league IDs - in practice, you'd maintain
        // a list of active/popular leagues to warm
        logger.info('Active NFL season detected - would warm current week data for active leagues');
      }

      return tasks;
    } catch (error) {
      logger.error('Error generating warming tasks:', error);
      return tasks; // Return whatever we managed to create
    }
  }

  /**
   * Execute cache warming
   */
  async warmCache(_forceColdStart = false): Promise<void> {
    if (this.warmingInProgress) {
      logger.info('Cache warming already in progress, skipping');
      return;
    }

    this.warmingInProgress = true;
    const startTime = Date.now();

    try {
      logger.info('Starting cache warming process');
      
      const tasks = await this.getWarmingTasks();
      this.warmingStats.totalTasks = tasks.length;
      this.warmingStats.completedTasks = 0;
      this.warmingStats.failedTasks = 0;

      // Sort tasks by priority
      const sortedTasks = tasks.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      // Execute tasks with controlled concurrency
      const concurrencyLimit = 3;
      const results = await this.executeBatched(sortedTasks, concurrencyLimit);

      // Update stats
      this.warmingStats.completedTasks = results.filter(r => r.status === 'success').length;
      this.warmingStats.failedTasks = results.filter(r => r.status === 'failed').length;
      this.warmingStats.lastDuration = Date.now() - startTime;
      this.lastWarmingTime = new Date();

      logger.info('Cache warming completed', {
        total: this.warmingStats.totalTasks,
        completed: this.warmingStats.completedTasks,
        failed: this.warmingStats.failedTasks,
        duration: this.warmingStats.lastDuration,
      });

    } catch (error) {
      logger.error('Cache warming failed:', error);
    } finally {
      this.warmingInProgress = false;
    }
  }

  /**
   * Execute tasks in batches with controlled concurrency
   */
  private async executeBatched(
    tasks: WarmingTask[],
    concurrencyLimit: number
  ): Promise<Array<{ key: string; status: 'success' | 'failed'; error?: string }>> {
    const results: Array<{ key: string; status: 'success' | 'failed'; error?: string }> = [];
    
    for (let i = 0; i < tasks.length; i += concurrencyLimit) {
      const batch = tasks.slice(i, i + concurrencyLimit);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (task) => {
          try {
            logger.debug(`Warming cache: ${task.description} (${task.key})`);
            
            // Check if already cached (unless force warming)
            const existing = await enhancedCacheService.get(task.key);
            if (existing !== null) {
              logger.debug(`Cache already warm for: ${task.key}`);
              return { key: task.key, status: 'success' as const };
            }

            // Add timeout wrapper to prevent hanging
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Cache warming timeout')), 15000);
            });

            await Promise.race([
              enhancedCacheService.smartWrap(
                task.key,
                task.fn,
                task.dataType,
                task.context
              ),
              timeoutPromise
            ]);
            
            return { key: task.key, status: 'success' as const };
          } catch (error) {
            logger.warn(`Failed to warm cache for ${task.key}:`, error);
            return { 
              key: task.key, 
              status: 'failed' as const, 
              error: (error as Error).message 
            };
          }
        })
      );

      // Extract results
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({ 
            key: 'unknown', 
            status: 'failed', 
            error: result.reason?.message || 'Unknown error' 
          });
        }
      });

      // Small delay between batches to avoid overwhelming the API
      if (i + concurrencyLimit < tasks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Schedule automatic cache warming
   */
  scheduleWarming(): void {
    // Warm cache immediately on startup
    // Cache warming disabled for testing - will start manually via API
    logger.info('Cache warming is scheduled but disabled on startup for testing');

    // Schedule regular warming based on NFL schedule
    setInterval(async () => {
      try {
        const state = await smartTTLManager.getCacheStats();
        
        // More frequent warming during active season
        const warmingInterval = state.nflState?.season_type === 'regular' || state.nflState?.season_type === 'post'
          ? 30 * 60 * 1000 // 30 minutes during season
          : 2 * 60 * 60 * 1000; // 2 hours off-season

        // Check if it's time to warm
        const now = Date.now();
        const lastWarming = this.lastWarmingTime?.getTime() || 0;
        
        if (now - lastWarming >= warmingInterval) {
          await this.warmCache();
        }
      } catch (error) {
        logger.error('Error in scheduled cache warming:', error);
      }
    }, 10 * 60 * 1000); // Check every 10 minutes

    logger.info('Cache warming scheduler started');
  }

  /**
   * Warm cache for specific leagues (when league IDs are provided)
   */
  async warmLeagueData(leagueIds: string[], currentWeek?: number): Promise<void> {
    if (this.warmingInProgress) {
      logger.info('Cache warming in progress, queueing league warming');
      // In a production system, you might queue this request
      return;
    }

    const tasks: WarmingTask[] = [];

    for (const leagueId of leagueIds) {
      // League basic data
      tasks.push({
        key: `league:${leagueId}`,
        fn: () => sleeperAPI.getLeague(leagueId),
        dataType: 'league',
        context: { leagueId },
        priority: 'high',
        description: `League ${leagueId}`,
      });

      // Rosters
      tasks.push({
        key: `rosters:${leagueId}`,
        fn: () => sleeperAPI.getRosters(leagueId),
        dataType: 'roster',
        context: { leagueId },
        priority: 'high',
        description: `Rosters ${leagueId}`,
      });

      // Users
      tasks.push({
        key: `users:${leagueId}`,
        fn: () => sleeperAPI.getUsers(leagueId),
        dataType: 'user',
        context: { leagueId },
        priority: 'medium',
        description: `Users ${leagueId}`,
      });

      // Current week matchups if specified
      if (currentWeek) {
        tasks.push({
          key: `matchups:${leagueId}:${currentWeek}`,
          fn: () => sleeperAPI.getMatchups(leagueId, currentWeek),
          dataType: 'matchup',
          context: { leagueId, week: currentWeek },
          priority: 'high',
          description: `Matchups ${leagueId} Week ${currentWeek}`,
        });
      }
    }

    logger.info(`Warming cache for ${leagueIds.length} leagues`);
    await this.executeBatched(tasks, 2); // Lower concurrency for league-specific warming
  }

  /**
   * Get warming statistics
   */
  getStats() {
    return {
      warmingInProgress: this.warmingInProgress,
      lastWarmingTime: this.lastWarmingTime,
      stats: { ...this.warmingStats },
    };
  }

  /**
   * Manual cache warming endpoint
   */
  async manualWarm(dataTypes?: string[]): Promise<{ success: boolean; message: string }> {
    if (this.warmingInProgress) {
      return { success: false, message: 'Cache warming already in progress' };
    }

    try {
      if (dataTypes && dataTypes.length > 0) {
        // Warm specific data types only
        const allTasks = await this.getWarmingTasks();
        const filteredTasks = allTasks.filter(task => 
          dataTypes.some(type => task.dataType.includes(type))
        );
        
        if (filteredTasks.length === 0) {
          return { success: false, message: `No tasks found for data types: ${dataTypes.join(', ')}` };
        }

        await this.executeBatched(filteredTasks, 3);
        return { 
          success: true, 
          message: `Warmed ${filteredTasks.length} cache entries for types: ${dataTypes.join(', ')}` 
        };
      } else {
        // Warm all data
        await this.warmCache(true);
        return { 
          success: true, 
          message: `Warmed ${this.warmingStats.completedTasks} cache entries` 
        };
      }
    } catch (error) {
      return { success: false, message: `Cache warming failed: ${(error as Error).message}` };
    }
  }
}

// Export singleton instance
export const cacheWarmer = new CacheWarmer();