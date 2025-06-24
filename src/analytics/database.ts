import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

export class AnalyticsDatabase {
  private pool: Pool;

  constructor() {
    // Use DATABASE_URL if available, otherwise use individual config values
    if (config.DATABASE_URL) {
      logger.info(`Connecting to PostgreSQL using DATABASE_URL`);
      this.pool = new Pool({
        connectionString: config.DATABASE_URL,
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    } else {
      logger.info(`Connecting to PostgreSQL using host: ${config.POSTGRES_HOST}:${config.POSTGRES_PORT}`);
      this.pool = new Pool({
        host: config.POSTGRES_HOST || 'localhost',
        port: config.POSTGRES_PORT || 5432,
        database: config.POSTGRES_DB || 'sleeper_analytics',
        user: config.POSTGRES_USER || 'sleeper',
        password: config.POSTGRES_PASSWORD || 'password',
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }
  }

  async initialize(): Promise<void> {
    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      logger.info('Analytics database connection established');
      
      // Run schema setup
      await this.setupSchema();
    } catch (error) {
      logger.error('Failed to connect to analytics database:', error);
      throw error;
    }
  }

  private async setupSchema(): Promise<void> {
    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = await fs.readFile(schemaPath, 'utf-8');
      
      const client = await this.pool.connect();
      await client.query(schema);
      client.release();
      
      logger.info('Analytics database schema initialized');
    } catch (error) {
      // Handle the case where tables already exist
      if (error && typeof error === 'object' && 'code' in error && error.code === '42P07') { // relation already exists
        logger.info('Analytics database schema already exists, skipping initialization');
        return;
      }
      logger.error('Failed to setup analytics schema:', error);
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Player data operations
  async upsertPlayer(playerData: any): Promise<void> {
    const query = `
      INSERT INTO players (
        player_id, sleeper_id, first_name, last_name, position, 
        team, college, height, weight, age, years_exp, birth_date, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
      ON CONFLICT (player_id) 
      DO UPDATE SET
        sleeper_id = EXCLUDED.sleeper_id,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        position = EXCLUDED.position,
        team = EXCLUDED.team,
        college = EXCLUDED.college,
        height = EXCLUDED.height,
        weight = EXCLUDED.weight,
        age = EXCLUDED.age,
        years_exp = EXCLUDED.years_exp,
        birth_date = EXCLUDED.birth_date,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.query(query, [
      playerData.player_id,
      playerData.sleeper_id,
      playerData.first_name,
      playerData.last_name,
      playerData.position,
      playerData.team,
      playerData.college,
      playerData.height,
      playerData.weight,
      playerData.age,
      playerData.years_exp,
      playerData.birth_date
    ]);
  }

  async upsertPlayerSeasonStats(statsData: any): Promise<void> {
    const query = `
      INSERT INTO player_season_stats (
        player_id, season, week, team, position,
        passing_attempts, passing_completions, passing_yards, passing_tds, passing_interceptions,
        rushing_attempts, rushing_yards, rushing_tds,
        receiving_targets, receiving_receptions, receiving_yards, receiving_tds,
        fantasy_points, ppr_points, games_played, games_started
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      )
      ON CONFLICT (player_id, season, week)
      DO UPDATE SET
        team = EXCLUDED.team,
        position = EXCLUDED.position,
        passing_attempts = EXCLUDED.passing_attempts,
        passing_completions = EXCLUDED.passing_completions,
        passing_yards = EXCLUDED.passing_yards,
        passing_tds = EXCLUDED.passing_tds,
        passing_interceptions = EXCLUDED.passing_interceptions,
        rushing_attempts = EXCLUDED.rushing_attempts,
        rushing_yards = EXCLUDED.rushing_yards,
        rushing_tds = EXCLUDED.rushing_tds,
        receiving_targets = EXCLUDED.receiving_targets,
        receiving_receptions = EXCLUDED.receiving_receptions,
        receiving_yards = EXCLUDED.receiving_yards,
        receiving_tds = EXCLUDED.receiving_tds,
        fantasy_points = EXCLUDED.fantasy_points,
        ppr_points = EXCLUDED.ppr_points,
        games_played = EXCLUDED.games_played,
        games_started = EXCLUDED.games_started
    `;

    await this.query(query, [
      statsData.player_id, statsData.season, statsData.week, statsData.team, statsData.position,
      statsData.passing_attempts || 0, statsData.passing_completions || 0, 
      statsData.passing_yards || 0, statsData.passing_tds || 0, statsData.passing_interceptions || 0,
      statsData.rushing_attempts || 0, statsData.rushing_yards || 0, statsData.rushing_tds || 0,
      statsData.receiving_targets || 0, statsData.receiving_receptions || 0, 
      statsData.receiving_yards || 0, statsData.receiving_tds || 0,
      statsData.fantasy_points || 0, statsData.ppr_points || 0,
      statsData.games_played || 0, statsData.games_started || 0
    ]);
  }

  async upsertCurrentPlayerData(playerData: any): Promise<void> {
    const query = `
      INSERT INTO player_current_data (
        player_id, status, injury_status, depth_chart_position,
        ownership_percentage, trending_direction, news_updated, sleeper_data, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (player_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        injury_status = EXCLUDED.injury_status,
        depth_chart_position = EXCLUDED.depth_chart_position,
        ownership_percentage = EXCLUDED.ownership_percentage,
        trending_direction = EXCLUDED.trending_direction,
        news_updated = EXCLUDED.news_updated,
        sleeper_data = EXCLUDED.sleeper_data,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.query(query, [
      playerData.player_id,
      playerData.status,
      playerData.injury_status,
      playerData.depth_chart_position,
      playerData.ownership_percentage,
      playerData.trending_direction,
      playerData.news_updated,
      JSON.stringify(playerData.sleeper_data)
    ]);
  }

  // Analytics queries
  async getPlayerCareerStats(playerId: string): Promise<any> {
    const query = `
      SELECT * FROM player_career_stats 
      WHERE player_id = $1
    `;
    const result = await this.query(query, [playerId]);
    return result.rows[0];
  }

  async getCurrentSeasonLeaders(position?: string, limit: number = 50): Promise<any[]> {
    let query = `SELECT * FROM current_season_leaders`;
    const params: any[] = [];

    if (position) {
      query += ` WHERE position = $1`;
      params.push(position);
    }

    query += ` LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.query(query, params);
    return result.rows;
  }

  async getPlayerTrends(playerId: string, weeks: number = 5): Promise<any[]> {
    const query = `
      SELECT season, week, fantasy_points, ppr_points, 
             passing_yards, rushing_yards, receiving_yards,
             passing_tds, rushing_tds, receiving_tds
      FROM player_season_stats 
      WHERE player_id = $1 
      ORDER BY season DESC, week DESC 
      LIMIT $2
    `;
    const result = await this.query(query, [playerId, weeks]);
    return result.rows;
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Analytics database connection pool closed');
  }
}

// Singleton instance
export const analyticsDB = new AnalyticsDatabase();