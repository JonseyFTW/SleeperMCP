import { analyticsService } from '../../analytics/service';
import { deltaSyncService } from '../../analytics/delta-sync';
import { logger } from '../../utils/logger';

/**
 * Get comprehensive player analytics and performance metrics
 */
export async function getPlayerAnalytics(params: any[], _context: any) {
  const { playerId } = params[0] || {};
  
  if (!playerId) {
    throw new Error('playerId is required');
  }

  logger.info(`Getting analytics for player ${playerId}`);
  return analyticsService.getPlayerAnalytics(playerId);
}

/**
 * Get position-based analytics and rankings
 */
export async function getPositionAnalytics(params: any[], _context: any) {
  const { position, season } = params[0] || {};
  
  if (!position) {
    throw new Error('position is required');
  }

  logger.info(`Getting position analytics for ${position}`);
  return analyticsService.getPositionAnalytics(position, season);
}

/**
 * Get player projections based on historical performance
 */
export async function getPlayerProjections(params: any[], _context: any) {
  const { playerId, weeks = 4 } = params[0] || {};
  
  if (!playerId) {
    throw new Error('playerId is required');
  }

  logger.info(`Getting projections for player ${playerId}`);
  return analyticsService.getPlayerProjections(playerId, weeks);
}

/**
 * Get matchup analysis for player vs opponent
 */
export async function getMatchupAnalysis(params: any[], _context: any) {
  const { playerId, opponentTeam } = params[0] || {};
  
  if (!playerId || !opponentTeam) {
    throw new Error('playerId and opponentTeam are required');
  }

  logger.info(`Getting matchup analysis for ${playerId} vs ${opponentTeam}`);
  return analyticsService.getMatchupAnalysis(playerId, opponentTeam);
}

/**
 * Get top performers by position for a given timeframe
 */
export async function getTopPerformers(params: any[], _context: any) {
  const { position, limit: _limit = 20, timeframe: _timeframe = 'season' } = params[0] || {};
  
  logger.info(`Getting top performers for position ${position || 'all'}`);
  return analyticsService.getPositionAnalytics(position, undefined);
}

/**
 * Compare multiple players head-to-head
 */
export async function comparePlayersHQ(params: any[], _context: any) {
  const { playerIds } = params[0] || {};
  
  if (!playerIds || !Array.isArray(playerIds) || playerIds.length < 2) {
    throw new Error('At least 2 playerIds are required for comparison');
  }

  logger.info(`Comparing players: ${playerIds.join(', ')}`);
  
  // Get analytics for each player
  const comparisons = await Promise.all(
    playerIds.map(async (playerId: string) => {
      try {
        return await analyticsService.getPlayerAnalytics(playerId);
      } catch (error) {
        logger.warn(`Failed to get analytics for player ${playerId}:`, error);
        return null;
      }
    })
  );

  // Filter out null results and add comparison metrics
  const validComparisons = comparisons.filter(c => c !== null);
  
  if (validComparisons.length < 2) {
    throw new Error('Not enough valid player data for comparison');
  }

  // Calculate relative rankings
  const withRankings = validComparisons.map(player => ({
    ...player,
    comparison_metrics: {
      fantasy_points_rank: validComparisons
        .sort((a, b) => b.avg_fantasy_points_per_game - a.avg_fantasy_points_per_game)
        .findIndex(p => p.player_id === player.player_id) + 1,
      consistency_rank: validComparisons
        .sort((a, b) => (b.metrics?.consistency_score || 0) - (a.metrics?.consistency_score || 0))
        .findIndex(p => p.player_id === player.player_id) + 1,
      total_yards_rank: validComparisons
        .sort((a, b) => b.total_yards - a.total_yards)
        .findIndex(p => p.player_id === player.player_id) + 1
    }
  }));

  return {
    comparison_summary: {
      players_compared: validComparisons.length,
      highest_avg_points: Math.max(...validComparisons.map(p => p.avg_fantasy_points_per_game)),
      most_consistent: validComparisons.reduce((prev, current) => 
        (prev.metrics?.consistency_score || 0) > (current.metrics?.consistency_score || 0) ? prev : current
      ).player_id
    },
    players: withRankings
  };
}

/**
 * Get league-wide analytics and insights
 */
export async function getLeagueInsights(params: any[], _context: any) {
  const { leagueId, week } = params[0] || {};
  
  // This would require league-specific data, which could be added later
  // For now, return general insights
  logger.info(`Getting league insights for league ${leagueId}`);
  
  // Get top performers by position
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const positionLeaders = await Promise.all(
    positions.map(async (position) => {
      const analytics = await analyticsService.getPositionAnalytics(position);
      return {
        position,
        top_performer: analytics.leaders[0],
        position_depth: analytics.total_players,
        avg_points: analytics.statistics.avg_fantasy_points
      };
    })
  );

  return {
    league_id: leagueId,
    week: week || 'season',
    position_insights: positionLeaders,
    generated_at: new Date().toISOString()
  };
}

/**
 * Data management methods
 */

/**
 * Trigger historical data ingestion
 */
export async function ingestHistoricalData(params: any[], _context: any) {
  const { startYear, endYear } = params[0] || {};
  
  logger.info(`Starting historical data ingestion: ${startYear || 2015} to ${endYear || 2024}`);
  
  try {
    await analyticsService.ingestHistoricalData(startYear, endYear);
    return {
      success: true,
      message: `Historical data ingestion completed for years ${startYear || 2015} to ${endYear || 2024}`,
      completed_at: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Historical data ingestion failed:', error);
    throw new Error(`Data ingestion failed: ${(error as Error).message}`);
  }
}

/**
 * Update current player data from Sleeper API
 */
export async function updateCurrentPlayerData(_params: any[], _context: any) {
  logger.info('Starting current player data update');
  
  try {
    await analyticsService.updateCurrentData();
    return {
      success: true,
      message: 'Current player data updated successfully',
      updated_at: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Current player data update failed:', error);
    throw new Error(`Data update failed: ${(error as Error).message}`);
  }
}

/**
 * Run complete daily data sync
 */
export async function runDailyDataSync(_params: any[], _context: any) {
  logger.info('Starting daily data sync');
  
  try {
    await analyticsService.runDailySync();
    return {
      success: true,
      message: 'Daily data sync completed successfully',
      synced_at: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Daily data sync failed:', error);
    throw new Error(`Daily sync failed: ${(error as Error).message}`);
  }
}

/**
 * Run nightly delta sync to check for new data
 */
export async function runNightlyDeltaSync(_params: any[], _context: any): Promise<any> {
  logger.info('Starting nightly delta sync');
  
  try {
    const result = await deltaSyncService.runNightlySync();
    return {
      success: true,
      message: result.hasNewData ? 
        `Delta sync completed: Found new data from ${result.source}` : 
        'Delta sync completed: No new data found',
      result,
      synced_at: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Nightly delta sync failed:', error);
    throw new Error(`Delta sync failed: ${(error as Error).message}`);
  }
}

/**
 * Get sync status and statistics
 */
export async function getSyncStatus(_params: any[], _context: any) {
  logger.info('Getting sync status');
  
  try {
    const status = await deltaSyncService.getSyncStatus();
    return {
      success: true,
      status,
      checked_at: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to get sync status:', error);
    throw new Error(`Sync status check failed: ${(error as Error).message}`);
  }
}

/**
 * Force a delta sync (for testing or manual triggers)
 */
export async function forceDeltaSync(_params: any[], _context: any): Promise<any> {
  logger.info('Forcing delta sync');
  
  try {
    const result = await deltaSyncService.forceDeltaSync();
    return {
      success: true,
      message: 'Force delta sync completed',
      result,
      synced_at: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Force delta sync failed:', error);
    throw new Error(`Force sync failed: ${(error as Error).message}`);
  }
}

// Export all analytics methods
export const analyticsMethods = {
  'sleeper.getPlayerAnalytics': getPlayerAnalytics,
  'sleeper.getPositionAnalytics': getPositionAnalytics,
  'sleeper.getPlayerProjections': getPlayerProjections,
  'sleeper.getMatchupAnalysis': getMatchupAnalysis,
  'sleeper.getTopPerformers': getTopPerformers,
  'sleeper.comparePlayersHQ': comparePlayersHQ,
  'sleeper.getLeagueInsights': getLeagueInsights,
  'sleeper.ingestHistoricalData': ingestHistoricalData,
  'sleeper.updateCurrentPlayerData': updateCurrentPlayerData,
  'sleeper.runDailyDataSync': runDailyDataSync,
  'sleeper.runNightlyDeltaSync': runNightlyDeltaSync,
  'sleeper.getSyncStatus': getSyncStatus,
  'sleeper.forceDeltaSync': forceDeltaSync,
};