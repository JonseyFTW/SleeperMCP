import axios from 'axios';
import { analyticsDB } from './database';
import { sleeperAPI } from '../api/client';
import { logger } from '../utils/logger';
import { dataIngestion } from './ingestion';
import fs from 'fs/promises';
import path from 'path';

interface DeltaCheckResult {
  hasNewData: boolean;
  source: string;
  changes: {
    newPlayers: number;
    updatedPlayers: number;
    newStats: number;
  };
  lastCheck: Date;
  nextCheck: Date;
}

export class DeltaSyncService {
  private readonly metadataFile = path.join(process.cwd(), 'data', 'sync-metadata.json');
  private readonly githubApiUrl = 'https://api.github.com/repos/hvpkod/NFL-Data/commits';
  
  constructor() {
    this.ensureDataDirectory();
  }

  private async ensureDataDirectory(): Promise<void> {
    const dataDir = path.dirname(this.metadataFile);
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      logger.warn('Failed to create data directory:', error);
    }
  }

  /**
   * Run complete nightly delta sync
   */
  async runNightlySync(): Promise<DeltaCheckResult> {
    const startTime = Date.now();
    logger.info('🌙 Starting nightly delta sync...');

    try {
      const metadata = await this.loadSyncMetadata();
      const results: DeltaCheckResult = {
        hasNewData: false,
        source: 'multiple',
        changes: {
          newPlayers: 0,
          updatedPlayers: 0,
          newStats: 0
        },
        lastCheck: new Date(),
        nextCheck: new Date(Date.now() + 24 * 60 * 60 * 1000) // Next day
      };

      // 1. Check for GitHub repository updates
      const githubResult = await this.checkGitHubUpdates(metadata.lastGitHubCheck);
      if (githubResult.hasNewData) {
        logger.info('📈 New historical data detected on GitHub');
        await this.syncGitHubData();
        results.hasNewData = true;
        results.changes.newStats += githubResult.changes.newStats;
      }

      // 2. Update current player data from Sleeper API
      const sleeperResult = await this.checkSleeperUpdates(metadata.lastSleeperCheck);
      if (sleeperResult.hasNewData) {
        logger.info('🔄 Updating current player data from Sleeper');
        await dataIngestion.updateCurrentPlayerData();
        results.hasNewData = true;
        results.changes.newPlayers += sleeperResult.changes.newPlayers;
        results.changes.updatedPlayers += sleeperResult.changes.updatedPlayers;
      }

      // 3. Check for weekly stats updates (during season)
      const weeklyResult = await this.checkWeeklyStatsUpdates();
      if (weeklyResult.hasNewData) {
        logger.info('🏈 New weekly stats detected');
        await this.syncWeeklyStats();
        results.hasNewData = true;
        results.changes.newStats += weeklyResult.changes.newStats;
      }

      // 4. Update sync metadata
      await this.updateSyncMetadata({
        lastGitHubCheck: new Date(),
        lastSleeperCheck: new Date(),
        lastWeeklyCheck: new Date(),
        lastSuccessfulSync: results.hasNewData ? new Date() : metadata.lastSuccessfulSync,
        totalSyncs: metadata.totalSyncs + 1,
        lastResults: results
      });

      const duration = Date.now() - startTime;
      logger.info(`✅ Nightly sync completed in ${duration}ms`, {
        hasNewData: results.hasNewData,
        changes: results.changes,
        duration
      });

      return results;

    } catch (error) {
      logger.error('❌ Nightly sync failed:', error);
      throw error;
    }
  }

  /**
   * Check GitHub repository for new commits
   */
  private async checkGitHubUpdates(lastCheck: Date): Promise<DeltaCheckResult> {
    try {
      logger.debug('Checking GitHub repository for updates...');
      
      const response = await axios.get(this.githubApiUrl, {
        params: {
          since: lastCheck.toISOString(),
          path: 'NFL-data-Players',
          per_page: 10
        }
      });

      const commits = response.data;
      const hasNewData = commits.length > 0;

      if (hasNewData) {
        logger.info(`Found ${commits.length} new commits since ${lastCheck.toISOString()}`);
        
        // Log recent commits for visibility
        commits.slice(0, 3).forEach((commit: any) => {
          logger.info(`📝 Commit: ${commit.sha.substring(0, 7)} - ${commit.commit.message}`);
        });
      }

      return {
        hasNewData,
        source: 'github',
        changes: {
          newPlayers: 0,
          updatedPlayers: 0,
          newStats: hasNewData ? commits.length * 100 : 0 // Estimate
        },
        lastCheck: new Date(),
        nextCheck: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

    } catch (error) {
      logger.warn('Failed to check GitHub updates:', error);
      return {
        hasNewData: false,
        source: 'github',
        changes: { newPlayers: 0, updatedPlayers: 0, newStats: 0 },
        lastCheck: new Date(),
        nextCheck: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
    }
  }

  /**
   * Check Sleeper API for player updates
   */
  private async checkSleeperUpdates(lastCheck: Date): Promise<DeltaCheckResult> {
    try {
      logger.debug('Checking Sleeper API for player updates...');

      // Get current player count from our database
      const currentCountResult = await analyticsDB.query(
        'SELECT COUNT(*) as count FROM players'
      );
      const currentPlayerCount = parseInt(currentCountResult.rows[0].count);

      // Get fresh data from Sleeper
      const sleeperPlayers = await sleeperAPI.getAllPlayers('nfl');
      const sleeperPlayerCount = Object.keys(sleeperPlayers).length;

      // Check for significant changes
      const playerDifference = sleeperPlayerCount - currentPlayerCount;
      const hasNewData = Math.abs(playerDifference) > 5; // Threshold for updates

      if (hasNewData) {
        logger.info(`Player count change detected: ${currentPlayerCount} → ${sleeperPlayerCount}`);
      }

      // Check for recent player status updates (injuries, transactions, etc.)
      const recentUpdatesResult = await analyticsDB.query(`
        SELECT COUNT(*) as count 
        FROM player_current_data 
        WHERE updated_at > $1
      `, [lastCheck]);

      const recentUpdates = parseInt(recentUpdatesResult.rows[0].count);

      return {
        hasNewData: hasNewData || recentUpdates < 100, // Force update if few recent updates
        source: 'sleeper',
        changes: {
          newPlayers: Math.max(0, playerDifference),
          updatedPlayers: sleeperPlayerCount,
          newStats: 0
        },
        lastCheck: new Date(),
        nextCheck: new Date(Date.now() + 6 * 60 * 60 * 1000) // 6 hours
      };

    } catch (error) {
      logger.warn('Failed to check Sleeper updates:', error);
      return {
        hasNewData: true, // Default to true to ensure regular updates
        source: 'sleeper',
        changes: { newPlayers: 0, updatedPlayers: 0, newStats: 0 },
        lastCheck: new Date(),
        nextCheck: new Date(Date.now() + 6 * 60 * 60 * 1000)
      };
    }
  }

  /**
   * Check for weekly stats updates during NFL season
   */
  private async checkWeeklyStatsUpdates(): Promise<DeltaCheckResult> {
    try {
      const currentDate = new Date();
      const currentSeason = currentDate.getFullYear();
      
      // NFL season typically runs September through February
      const isSeasonTime = (
        (currentDate.getMonth() >= 8) || // September onwards
        (currentDate.getMonth() <= 1)    // Through February
      );

      if (!isSeasonTime) {
        logger.debug('Not in NFL season - skipping weekly stats check');
        return {
          hasNewData: false,
          source: 'weekly',
          changes: { newPlayers: 0, updatedPlayers: 0, newStats: 0 },
          lastCheck: new Date(),
          nextCheck: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };
      }

      // Get NFL state to determine current week
      const nflState = await sleeperAPI.getNFLState();
      const currentWeek = nflState.week;

      // Check if we have stats for the current week
      const weekStatsResult = await analyticsDB.query(`
        SELECT COUNT(*) as count 
        FROM player_season_stats 
        WHERE season = $1 AND week = $2
      `, [currentSeason, currentWeek]);

      const weekStatsCount = parseInt(weekStatsResult.rows[0].count);
      const hasNewData = weekStatsCount < 1000; // Expect thousands of weekly stats

      if (hasNewData) {
        logger.info(`Missing weekly stats for Season ${currentSeason}, Week ${currentWeek} (found ${weekStatsCount} records)`);
      }

      return {
        hasNewData,
        source: 'weekly',
        changes: {
          newPlayers: 0,
          updatedPlayers: 0,
          newStats: hasNewData ? 2000 : 0 // Estimate
        },
        lastCheck: new Date(),
        nextCheck: new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours during season
      };

    } catch (error) {
      logger.warn('Failed to check weekly stats updates:', error);
      return {
        hasNewData: false,
        source: 'weekly',
        changes: { newPlayers: 0, updatedPlayers: 0, newStats: 0 },
        lastCheck: new Date(),
        nextCheck: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
    }
  }

  /**
   * Sync new GitHub data
   */
  private async syncGitHubData(): Promise<void> {
    const currentYear = new Date().getFullYear();
    
    // Only sync recent years to avoid re-processing everything
    logger.info('Syncing recent historical data from GitHub...');
    await dataIngestion.ingestHistoricalData(currentYear - 1, currentYear);
  }

  /**
   * Sync weekly stats (placeholder for future implementation)
   */
  private async syncWeeklyStats(): Promise<void> {
    logger.info('Syncing weekly stats...');
    
    // TODO: Implement weekly stats sync when available
    // This would fetch current week stats from Sleeper or other sources
    // For now, just ensure current player data is up to date
    await dataIngestion.updateCurrentPlayerData();
  }

  /**
   * Load sync metadata
   */
  private async loadSyncMetadata(): Promise<any> {
    try {
      const content = await fs.readFile(this.metadataFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // Return default metadata if file doesn't exist
      const defaultMetadata = {
        lastGitHubCheck: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        lastSleeperCheck: new Date(Date.now() - 24 * 60 * 60 * 1000),    // 1 day ago
        lastWeeklyCheck: new Date(Date.now() - 6 * 60 * 60 * 1000),      // 6 hours ago
        lastSuccessfulSync: null,
        totalSyncs: 0,
        lastResults: null
      };
      
      await this.updateSyncMetadata(defaultMetadata);
      return defaultMetadata;
    }
  }

  /**
   * Update sync metadata
   */
  private async updateSyncMetadata(metadata: any): Promise<void> {
    try {
      const content = JSON.stringify(metadata, null, 2);
      await fs.writeFile(this.metadataFile, content, 'utf-8');
    } catch (error) {
      logger.warn('Failed to update sync metadata:', error);
    }
  }

  /**
   * Get sync status and statistics
   */
  async getSyncStatus(): Promise<any> {
    const metadata = await this.loadSyncMetadata();
    
    return {
      last_successful_sync: metadata.lastSuccessfulSync,
      total_syncs: metadata.totalSyncs,
      last_github_check: metadata.lastGitHubCheck,
      last_sleeper_check: metadata.lastSleeperCheck,
      last_weekly_check: metadata.lastWeeklyCheck,
      last_results: metadata.lastResults,
      next_sync: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      system_status: 'operational'
    };
  }

  /**
   * Force a sync (for testing or manual triggers)
   */
  async forceDeltaSync(): Promise<DeltaCheckResult> {
    logger.info('🔄 Forcing delta sync...');
    return this.runNightlySync();
  }
}

export const deltaSyncService = new DeltaSyncService();