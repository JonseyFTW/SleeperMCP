import { analyticsDB } from './database';
import { dataIngestion } from './ingestion';
import { logger } from '../utils/logger';

export class AnalyticsService {
  
  /**
   * Initialize analytics service
   */
  async initialize(): Promise<void> {
    try {
      await analyticsDB.initialize();
      logger.info('Analytics service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize analytics service:', error);
      throw error;
    }
  }

  /**
   * Get player performance analytics
   */
  async getPlayerAnalytics(playerId: string): Promise<any> {
    try {
      const [careerStats, recentTrends] = await Promise.all([
        analyticsDB.getPlayerCareerStats(playerId),
        analyticsDB.getPlayerTrends(playerId, 10)
      ]);

      if (!careerStats) {
        return null;
      }

      // Calculate additional metrics
      const analytics = {
        ...careerStats,
        trends: recentTrends,
        metrics: {
          consistency_score: this.calculateConsistencyScore(recentTrends),
          upward_trend: this.calculateTrendDirection(recentTrends),
          position_rank: await this.getPositionRank(playerId, careerStats.position),
          projection_confidence: this.calculateProjectionConfidence(recentTrends)
        }
      };

      return analytics;
    } catch (error) {
      logger.error(`Failed to get analytics for player ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Get position rankings and comparisons
   */
  async getPositionAnalytics(position: string, season?: number): Promise<any> {
    try {
      const leaders = await analyticsDB.getCurrentSeasonLeaders(position, 100);
      
      // Add percentile rankings
      const withPercentiles = leaders.map((player, index) => ({
        ...player,
        rank: index + 1,
        percentile: Math.round((1 - index / leaders.length) * 100)
      }));

      return {
        position,
        season: season || new Date().getFullYear(),
        total_players: withPercentiles.length,
        leaders: withPercentiles.slice(0, 20), // Top 20
        statistics: {
          avg_fantasy_points: leaders.reduce((sum, p) => sum + p.avg_fantasy_points, 0) / leaders.length,
          top_10_threshold: leaders[9]?.season_fantasy_points || 0,
          playoff_threshold: leaders[Math.floor(leaders.length * 0.7)]?.season_fantasy_points || 0
        }
      };
    } catch (error) {
      logger.error(`Failed to get position analytics for ${position}:`, error);
      throw error;
    }
  }

  /**
   * Get player projections based on historical performance
   */
  async getPlayerProjections(playerId: string, weeks: number = 4): Promise<any> {
    try {
      const trends = await analyticsDB.getPlayerTrends(playerId, 10);
      
      if (trends.length === 0) {
        return null;
      }

      const recentGames = trends.slice(0, 5);
      const seasonGames = trends.filter(t => t.season === new Date().getFullYear());

      // Simple projection based on recent performance and seasonal trends
      const projection = {
        player_id: playerId,
        projection_period: `Next ${weeks} weeks`,
        projected_stats: {
          fantasy_points_per_game: this.calculateWeightedAverage(recentGames, 'fantasy_points'),
          passing_yards_per_game: this.calculateWeightedAverage(recentGames, 'passing_yards'),
          rushing_yards_per_game: this.calculateWeightedAverage(recentGames, 'rushing_yards'),
          receiving_yards_per_game: this.calculateWeightedAverage(recentGames, 'receiving_yards'),
          total_tds_per_game: this.calculateWeightedAverage(recentGames, 'passing_tds') +
                              this.calculateWeightedAverage(recentGames, 'rushing_tds') +
                              this.calculateWeightedAverage(recentGames, 'receiving_tds')
        },
        confidence_level: this.calculateProjectionConfidence(recentGames),
        trend_direction: this.calculateTrendDirection(recentGames),
        season_totals: seasonGames.length > 0 ? {
          games_played: seasonGames.length,
          season_fantasy_points: seasonGames.reduce((sum, g) => sum + g.fantasy_points, 0),
          avg_per_game: seasonGames.reduce((sum, g) => sum + g.fantasy_points, 0) / seasonGames.length
        } : null
      };

      return projection;
    } catch (error) {
      logger.error(`Failed to get projections for player ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Get matchup analysis
   */
  async getMatchupAnalysis(playerId: string, opponentTeam: string): Promise<any> {
    try {
      // Get historical performance against this opponent
      const query = `
        SELECT 
          season, week, fantasy_points, ppr_points,
          passing_yards, rushing_yards, receiving_yards,
          passing_tds, rushing_tds, receiving_tds
        FROM player_season_stats pss
        JOIN teams opp ON opp.team_code = $2
        WHERE pss.player_id = $1 
        ORDER BY season DESC, week DESC
        LIMIT 10
      `;

      const historicalMatchups = await analyticsDB.query(query, [playerId, opponentTeam]);
      
      if (historicalMatchups.rows.length === 0) {
        return {
          player_id: playerId,
          opponent_team: opponentTeam,
          historical_games: 0,
          recommendation: 'No historical data available'
        };
      }

      const games = historicalMatchups.rows;
      const avgFantasyPoints = games.reduce((sum: number, g: any) => sum + g.fantasy_points, 0) / games.length;
      const avgTotalYards = games.reduce((sum: number, g: any) => 
        sum + (g.passing_yards || 0) + (g.rushing_yards || 0) + (g.receiving_yards || 0), 0
      ) / games.length;

      return {
        player_id: playerId,
        opponent_team: opponentTeam,
        historical_games: games.length,
        avg_fantasy_points: Math.round(avgFantasyPoints * 100) / 100,
        avg_total_yards: Math.round(avgTotalYards),
        best_game: Math.max(...games.map((g: any) => g.fantasy_points)),
        worst_game: Math.min(...games.map((g: any) => g.fantasy_points)),
        recommendation: this.generateMatchupRecommendation(avgFantasyPoints, games),
        recent_games: games.slice(0, 3)
      };
    } catch (error) {
      logger.error(`Failed to get matchup analysis for ${playerId} vs ${opponentTeam}:`, error);
      throw error;
    }
  }

  /**
   * Run data ingestion processes
   */
  async ingestHistoricalData(startYear?: number, endYear?: number): Promise<void> {
    return dataIngestion.ingestHistoricalData(startYear, endYear);
  }

  async updateCurrentData(): Promise<void> {
    return dataIngestion.updateCurrentPlayerData();
  }

  async runDailySync(): Promise<void> {
    return dataIngestion.runDailySync();
  }

  // Helper methods for calculations

  private calculateConsistencyScore(games: any[]): number {
    if (games.length < 3) return 0;
    
    const fantasyPoints = games.map(g => g.fantasy_points);
    const mean = fantasyPoints.reduce((sum, pts) => sum + pts, 0) / fantasyPoints.length;
    const variance = fantasyPoints.reduce((sum, pts) => sum + Math.pow(pts - mean, 2), 0) / fantasyPoints.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Lower standard deviation = higher consistency (scale 0-100)
    return Math.max(0, Math.min(100, 100 - (standardDeviation * 5)));
  }

  private calculateTrendDirection(games: any[]): 'up' | 'down' | 'steady' {
    if (games.length < 3) return 'steady';
    
    const recent = games.slice(0, 3);
    const earlier = games.slice(3, 6);
    
    const recentAvg = recent.reduce((sum, g) => sum + g.fantasy_points, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, g) => sum + g.fantasy_points, 0) / earlier.length;
    
    const difference = recentAvg - earlierAvg;
    
    if (difference > 2) return 'up';
    if (difference < -2) return 'down';
    return 'steady';
  }

  private async getPositionRank(playerId: string, position: string): Promise<number> {
    const leaders = await analyticsDB.getCurrentSeasonLeaders(position, 200);
    const playerIndex = leaders.findIndex(p => p.player_id === playerId);
    return playerIndex >= 0 ? playerIndex + 1 : 0;
  }

  private calculateProjectionConfidence(games: any[]): number {
    if (games.length < 3) return 25; // Low confidence with limited data
    
    const consistencyScore = this.calculateConsistencyScore(games);
    const recentGames = Math.min(games.length, 5);
    
    // Base confidence on consistency and sample size
    const sampleSizeScore = (recentGames / 5) * 50; // Max 50 points for sample size
    const confidence = consistencyScore * 0.5 + sampleSizeScore;
    
    return Math.round(Math.min(95, Math.max(25, confidence)));
  }

  private calculateWeightedAverage(games: any[], field: string): number {
    if (games.length === 0) return 0;
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    games.forEach((game, index) => {
      const weight = games.length - index; // More recent games weighted higher
      weightedSum += (game[field] || 0) * weight;
      totalWeight += weight;
    });
    
    return Math.round((weightedSum / totalWeight) * 100) / 100;
  }

  private generateMatchupRecommendation(avgPoints: number, games: any[]): string {
    const consistency = this.calculateConsistencyScore(games);
    
    if (avgPoints >= 15 && consistency >= 70) {
      return 'Strong Start - Consistent high performer against this opponent';
    } else if (avgPoints >= 12) {
      return 'Good Start - Above average production expected';
    } else if (avgPoints >= 8) {
      return 'Flex Option - Moderate production expected';
    } else {
      return 'Avoid - Poor historical performance against this opponent';
    }
  }

  async close(): Promise<void> {
    await analyticsDB.close();
  }
}

export const analyticsService = new AnalyticsService();