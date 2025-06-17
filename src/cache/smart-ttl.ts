import { sleeperAPI } from '../api/client';
import { logger } from '../utils/logger';
import { SleeperNFLState } from '../types/sleeper';

export interface CacheContext {
  dataType: string;
  leagueId?: string;
  week?: number;
  season?: string;
  currentTime: Date;
}

export interface TTLStrategy {
  baseTTL: number;
  gameTimeTTL: number;
  offSeasonTTL: number;
  waiverTimeTTL?: number;
}

export class SmartTTLManager {
  private nflState: SleeperNFLState | null = null;
  private lastStateUpdate: Date = new Date(0);
  private stateUpdateInterval = 5 * 60 * 1000; // 5 minutes

  // TTL strategies for different data types
  private strategies: Record<string, TTLStrategy> = {
    // User data - changes infrequently
    user: {
      baseTTL: 24 * 60 * 60, // 24 hours
      gameTimeTTL: 24 * 60 * 60, // Same during games
      offSeasonTTL: 7 * 24 * 60 * 60, // 7 days off-season
    },

    // League settings - changes rarely
    league: {
      baseTTL: 12 * 60 * 60, // 12 hours
      gameTimeTTL: 12 * 60 * 60, // Same during games
      offSeasonTTL: 24 * 60 * 60, // 24 hours off-season
    },

    // Rosters - changes during waivers and trades
    roster: {
      baseTTL: 60 * 60, // 1 hour
      gameTimeTTL: 60 * 60, // 1 hour during games
      offSeasonTTL: 24 * 60 * 60, // 24 hours off-season
      waiverTimeTTL: 5 * 60, // 5 minutes during waiver period
    },

    // Matchups - need real-time during games
    matchup: {
      baseTTL: 60 * 60, // 1 hour
      gameTimeTTL: 60, // 1 minute during games
      offSeasonTTL: 24 * 60 * 60, // 24 hours off-season
    },

    // Transactions - moderately dynamic
    transaction: {
      baseTTL: 30 * 60, // 30 minutes
      gameTimeTTL: 10 * 60, // 10 minutes during games
      offSeasonTTL: 12 * 60 * 60, // 12 hours off-season
    },

    // Players - changes during games and weekly
    player: {
      baseTTL: 6 * 60 * 60, // 6 hours
      gameTimeTTL: 60 * 60, // 1 hour during games
      offSeasonTTL: 7 * 24 * 60 * 60, // 7 days off-season
    },

    // Trending players - very dynamic
    trending: {
      baseTTL: 15 * 60, // 15 minutes
      gameTimeTTL: 5 * 60, // 5 minutes during games
      offSeasonTTL: 60 * 60, // 1 hour off-season
    },

    // Draft data - static once completed
    draft: {
      baseTTL: 24 * 60 * 60, // 24 hours
      gameTimeTTL: 24 * 60 * 60, // Same during games
      offSeasonTTL: 7 * 24 * 60 * 60, // 7 days off-season
    },

    // NFL state - semi-dynamic
    nfl_state: {
      baseTTL: 5 * 60, // 5 minutes
      gameTimeTTL: 60, // 1 minute during games
      offSeasonTTL: 60 * 60, // 1 hour off-season
    },
  };

  /**
   * Get the current NFL state with caching
   */
  private async getNFLState(): Promise<SleeperNFLState | null> {
    const now = new Date();
    
    // Update state if it's stale
    if (!this.nflState || now.getTime() - this.lastStateUpdate.getTime() > this.stateUpdateInterval) {
      try {
        this.nflState = await sleeperAPI.getNFLState();
        this.lastStateUpdate = now;
        logger.debug('Updated NFL state cache', {
          season: this.nflState?.season,
          week: this.nflState?.week,
          seasonType: this.nflState?.season_type,
        });
      } catch (error) {
        logger.warn('Failed to update NFL state:', error);
      }
    }

    return this.nflState;
  }

  /**
   * Determine if current time is during active game windows
   */
  private async isGameTime(): Promise<boolean> {
    const state = await this.getNFLState();
    if (!state) return false;

    // Off-season or pre-season
    if (state.season_type === 'pre') {
      return false;
    }

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = now.getHours();

    // During regular season or playoffs
    if (state.season_type === 'regular' || state.season_type === 'post') {
      // Game windows (EST/EDT):
      // Thursday: 8:20 PM
      // Sunday: 1:00 PM - 11:30 PM  
      // Monday: 8:20 PM
      
      if (dayOfWeek === 4 && hour >= 20 && hour <= 23) return true; // Thursday night
      if (dayOfWeek === 0 && hour >= 13 && hour <= 23) return true; // Sunday games
      if (dayOfWeek === 1 && hour >= 20 && hour <= 23) return true; // Monday night
    }

    return false;
  }

  /**
   * Determine if current time is during waiver period
   */
  private async isWaiverTime(): Promise<boolean> {
    // Typical waiver periods: Tuesday night - Wednesday morning
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();

    // Tuesday 10 PM - Wednesday 6 AM (EST/EDT)
    if (dayOfWeek === 2 && hour >= 22) return true; // Tuesday night
    if (dayOfWeek === 3 && hour <= 6) return true; // Wednesday morning

    return false;
  }

  /**
   * Get optimal TTL for a cache context
   */
  async getOptimalTTL(context: CacheContext): Promise<number> {
    const strategy = this.strategies[context.dataType];
    if (!strategy) {
      logger.warn(`No TTL strategy found for data type: ${context.dataType}`);
      return 300; // Default 5 minutes
    }

    const state = await this.getNFLState();
    
    // Off-season - use longer TTL
    if (!state || state.season_type === 'pre') {
      return strategy.offSeasonTTL;
    }

    // Check for waiver time (roster-specific)
    if (context.dataType === 'roster' && strategy.waiverTimeTTL) {
      const isWaiver = await this.isWaiverTime();
      if (isWaiver) {
        return strategy.waiverTimeTTL;
      }
    }

    // Check for game time
    const isGame = await this.isGameTime();
    if (isGame) {
      return strategy.gameTimeTTL;
    }

    // Default to base TTL
    return strategy.baseTTL;
  }

  /**
   * Get TTL with additional context-based adjustments
   */
  async getContextualTTL(
    dataType: string,
    additionalContext?: Partial<CacheContext>
  ): Promise<number> {
    const context: CacheContext = {
      dataType,
      currentTime: new Date(),
      ...additionalContext,
    };

    let ttl = await this.getOptimalTTL(context);

    // Apply contextual modifiers
    if (context.week !== undefined) {
      const state = await this.getNFLState();
      
      // Current week data is more volatile
      if (state && context.week === state.week) {
        ttl = Math.floor(ttl * 0.5); // Reduce TTL by 50%
      }
      
      // Future weeks are more stable
      if (state && context.week > state.week) {
        ttl = Math.floor(ttl * 1.5); // Increase TTL by 50%
      }
    }

    // Ensure minimum TTL of 30 seconds
    return Math.max(ttl, 30);
  }

  /**
   * Get TTL strategies for monitoring/debugging
   */
  getStrategies(): Record<string, TTLStrategy> {
    return { ...this.strategies };
  }

  /**
   * Update TTL strategy for a data type
   */
  updateStrategy(dataType: string, strategy: Partial<TTLStrategy>): void {
    if (this.strategies[dataType]) {
      this.strategies[dataType] = { ...this.strategies[dataType], ...strategy };
      logger.info(`Updated TTL strategy for ${dataType}`, strategy);
    } else {
      logger.warn(`Cannot update strategy for unknown data type: ${dataType}`);
    }
  }

  /**
   * Get current cache statistics
   */
  async getCacheStats() {
    const state = await this.getNFLState();
    const isGame = await this.isGameTime();
    const isWaiver = await this.isWaiverTime();

    return {
      nflState: state,
      isGameTime: isGame,
      isWaiverTime: isWaiver,
      lastStateUpdate: this.lastStateUpdate,
      strategies: Object.keys(this.strategies),
    };
  }
}

// Export singleton instance
export const smartTTLManager = new SmartTTLManager();