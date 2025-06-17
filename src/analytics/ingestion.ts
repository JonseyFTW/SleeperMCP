import axios from 'axios';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { analyticsDB } from './database';
import { sleeperAPI } from '../api/client';
import { logger } from '../utils/logger';

export class DataIngestionService {
  private readonly githubBaseUrl = 'https://raw.githubusercontent.com/hvpkod/NFL-Data/main/NFL-data-Players';

  /**
   * Download and process historical player data from GitHub
   */
  async ingestHistoricalData(startYear: number = 2015, endYear: number = 2024): Promise<void> {
    logger.info(`Starting historical data ingestion from ${startYear} to ${endYear}`);

    for (let year = startYear; year <= endYear; year++) {
      try {
        await this.ingestYearlyData(year);
        logger.info(`Completed ingestion for year ${year}`);
      } catch (error) {
        logger.error(`Failed to ingest data for year ${year}:`, error);
        // Continue with next year rather than failing completely
      }
    }

    logger.info('Historical data ingestion completed');
  }

  /**
   * Ingest data for a specific year
   */
  private async ingestYearlyData(year: number): Promise<void> {
    // Common file patterns from NFL data repositories
    const possibleFiles = [
      `${year}/players_${year}.csv`,
      `${year}/player_stats_${year}.csv`,
      `${year}/nfl_players_${year}.csv`,
      `players_${year}.csv`,
      `${year}.csv`
    ];

    for (const filePath of possibleFiles) {
      try {
        const url = `${this.githubBaseUrl}/${filePath}`;
        await this.downloadAndProcessCSV(url, year);
        return; // Success, move to next year
      } catch (error) {
        // Try next file pattern
        continue;
      }
    }

    throw new Error(`No valid data file found for year ${year}`);
  }

  /**
   * Download and process a CSV file from URL
   */
  private async downloadAndProcessCSV(url: string, year: number): Promise<void> {
    logger.info(`Downloading data from: ${url}`);

    const response = await axios.get(url, { responseType: 'stream' });
    
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      let processedCount = 0;

      response.data
        .pipe(csv())
        .on('data', (data: any) => {
          results.push(data);
        })
        .on('end', async () => {
          try {
            // Process data in batches
            const batchSize = 100;
            for (let i = 0; i < results.length; i += batchSize) {
              const batch = results.slice(i, i + batchSize);
              await this.processBatch(batch, year);
              processedCount += batch.length;
              
              if (processedCount % 500 === 0) {
                logger.info(`Processed ${processedCount}/${results.length} records for ${year}`);
              }
            }
            
            logger.info(`Successfully processed ${results.length} records for year ${year}`);
            resolve();
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  /**
   * Process a batch of player records
   */
  private async processBatch(records: any[], year: number): Promise<void> {
    await analyticsDB.transaction(async (client) => {
      for (const record of records) {
        try {
          // Normalize the data (field names vary between sources)
          const normalizedData = this.normalizePlayerRecord(record, year);
          
          // Insert player basic info
          if (normalizedData.player) {
            const playerQuery = `
              INSERT INTO players (
                player_id, first_name, last_name, position, team, college, 
                height, weight, age, years_exp, birth_date, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
              ON CONFLICT (player_id) DO UPDATE SET
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

            await client.query(playerQuery, [
              normalizedData.player.player_id,
              normalizedData.player.first_name,
              normalizedData.player.last_name,
              normalizedData.player.position,
              normalizedData.player.team,
              normalizedData.player.college,
              normalizedData.player.height,
              normalizedData.player.weight,
              normalizedData.player.age,
              normalizedData.player.years_exp,
              normalizedData.player.birth_date
            ]);
          }

          // Insert season stats if available
          if (normalizedData.stats) {
            const statsQuery = `
              INSERT INTO player_season_stats (
                player_id, season, week, team, position,
                passing_attempts, passing_completions, passing_yards, passing_tds, passing_interceptions,
                rushing_attempts, rushing_yards, rushing_tds,
                receiving_targets, receiving_receptions, receiving_yards, receiving_tds,
                fantasy_points, ppr_points, games_played, games_started
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
              )
              ON CONFLICT (player_id, season, week) DO UPDATE SET
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

            await client.query(statsQuery, [
              normalizedData.stats.player_id,
              normalizedData.stats.season,
              normalizedData.stats.week || 0, // Season totals
              normalizedData.stats.team,
              normalizedData.stats.position,
              normalizedData.stats.passing_attempts || 0,
              normalizedData.stats.passing_completions || 0,
              normalizedData.stats.passing_yards || 0,
              normalizedData.stats.passing_tds || 0,
              normalizedData.stats.passing_interceptions || 0,
              normalizedData.stats.rushing_attempts || 0,
              normalizedData.stats.rushing_yards || 0,
              normalizedData.stats.rushing_tds || 0,
              normalizedData.stats.receiving_targets || 0,
              normalizedData.stats.receiving_receptions || 0,
              normalizedData.stats.receiving_yards || 0,
              normalizedData.stats.receiving_tds || 0,
              normalizedData.stats.fantasy_points || 0,
              normalizedData.stats.ppr_points || 0,
              normalizedData.stats.games_played || 0,
              normalizedData.stats.games_started || 0
            ]);
          }
        } catch (error) {
          logger.error(`Failed to process record:`, { record, error });
          // Continue with next record
        }
      }
    });
  }

  /**
   * Normalize player record from various CSV formats
   */
  private normalizePlayerRecord(record: any, year: number): { player?: any; stats?: any } {
    // Common field name mappings
    const fieldMap = {
      // Player info
      player_id: ['player_id', 'id', 'sleeper_id', 'Player_ID', 'playerID'],
      first_name: ['first_name', 'fname', 'First_Name', 'firstName', 'first'],
      last_name: ['last_name', 'lname', 'Last_Name', 'lastName', 'last'],
      position: ['position', 'pos', 'Position', 'Pos'],
      team: ['team', 'Team', 'tm', 'Tm'],
      college: ['college', 'College', 'school'],
      height: ['height', 'Height', 'ht'],
      weight: ['weight', 'Weight', 'wt'],
      age: ['age', 'Age'],
      years_exp: ['years_exp', 'experience', 'exp', 'Years_Exp'],
      
      // Stats
      passing_attempts: ['pass_att', 'passing_attempts', 'Pass_Att', 'Att'],
      passing_completions: ['pass_cmp', 'passing_completions', 'Pass_Cmp', 'Cmp'],
      passing_yards: ['pass_yds', 'passing_yards', 'Pass_Yds', 'PassYds'],
      passing_tds: ['pass_td', 'passing_tds', 'Pass_TD', 'PassTD'],
      passing_interceptions: ['pass_int', 'passing_interceptions', 'Pass_Int', 'Int'],
      
      rushing_attempts: ['rush_att', 'rushing_attempts', 'Rush_Att', 'RushAtt'],
      rushing_yards: ['rush_yds', 'rushing_yards', 'Rush_Yds', 'RushYds'],
      rushing_tds: ['rush_td', 'rushing_tds', 'Rush_TD', 'RushTD'],
      
      receiving_targets: ['rec_tgt', 'receiving_targets', 'Rec_Tgt', 'Targets'],
      receiving_receptions: ['rec', 'receiving_receptions', 'Rec', 'Receptions'],
      receiving_yards: ['rec_yds', 'receiving_yards', 'Rec_Yds', 'RecYds'],
      receiving_tds: ['rec_td', 'receiving_tds', 'Rec_TD', 'RecTD'],
      
      fantasy_points: ['fantasy_points', 'fpts', 'FantasyPoints', 'Fantasy_Points'],
      games_played: ['games_played', 'games', 'GP', 'G']
    };

    const getValue = (fieldKey: string): any => {
      const possibleFields = fieldMap[fieldKey as keyof typeof fieldMap] || [fieldKey];
      for (const field of possibleFields) {
        if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
          return record[field];
        }
      }
      return null;
    };

    // Generate player ID if not present
    const playerId = getValue('player_id') || 
                    `${getValue('first_name')}_${getValue('last_name')}_${getValue('team')}`.replace(/\s+/g, '_');

    const result: { player?: any; stats?: any } = {};

    // Player basic info
    if (getValue('first_name') || getValue('last_name')) {
      result.player = {
        player_id: playerId,
        first_name: getValue('first_name'),
        last_name: getValue('last_name'),
        position: getValue('position'),
        team: getValue('team'),
        college: getValue('college'),
        height: parseInt(getValue('height')) || null,
        weight: parseInt(getValue('weight')) || null,
        age: parseInt(getValue('age')) || null,
        years_exp: parseInt(getValue('years_exp')) || null,
        birth_date: null // Usually not in historical data
      };
    }

    // Stats (if any stat fields are present)
    const hasStats = getValue('passing_yards') || getValue('rushing_yards') || 
                    getValue('receiving_yards') || getValue('fantasy_points');
    
    if (hasStats) {
      result.stats = {
        player_id: playerId,
        season: year,
        week: parseInt(getValue('week')) || 0, // 0 for season totals
        team: getValue('team'),
        position: getValue('position'),
        passing_attempts: parseInt(getValue('passing_attempts')) || 0,
        passing_completions: parseInt(getValue('passing_completions')) || 0,
        passing_yards: parseInt(getValue('passing_yards')) || 0,
        passing_tds: parseInt(getValue('passing_tds')) || 0,
        passing_interceptions: parseInt(getValue('passing_interceptions')) || 0,
        rushing_attempts: parseInt(getValue('rushing_attempts')) || 0,
        rushing_yards: parseInt(getValue('rushing_yards')) || 0,
        rushing_tds: parseInt(getValue('rushing_tds')) || 0,
        receiving_targets: parseInt(getValue('receiving_targets')) || 0,
        receiving_receptions: parseInt(getValue('receiving_receptions')) || 0,
        receiving_yards: parseInt(getValue('receiving_yards')) || 0,
        receiving_tds: parseInt(getValue('receiving_tds')) || 0,
        fantasy_points: parseFloat(getValue('fantasy_points')) || 0,
        ppr_points: parseFloat(getValue('ppr_points')) || 0,
        games_played: parseInt(getValue('games_played')) || 0,
        games_started: parseInt(getValue('games_started')) || 0
      };
    }

    return result;
  }

  /**
   * Update current player data from Sleeper API
   */
  async updateCurrentPlayerData(): Promise<void> {
    logger.info('Starting current player data update from Sleeper API');

    try {
      // Get all current players from Sleeper
      const playersData = await sleeperAPI.getAllPlayers('nfl');
      
      const playerCount = Object.keys(playersData).length;
      logger.info(`Processing ${playerCount} current players from Sleeper API`);

      let processedCount = 0;
      const batchSize = 100;
      const playerEntries = Object.entries(playersData);

      for (let i = 0; i < playerEntries.length; i += batchSize) {
        const batch = playerEntries.slice(i, i + batchSize);
        
        await analyticsDB.transaction(async (client) => {
          for (const [sleeperId, playerData] of batch) {
            try {
              const normalizedPlayer = this.normalizeSleeperPlayer(sleeperId, playerData);
              
              // Upsert player basic info
              await analyticsDB.upsertPlayer(normalizedPlayer.player);
              
              // Upsert current status
              await analyticsDB.upsertCurrentPlayerData(normalizedPlayer.current);
              
              processedCount++;
            } catch (error) {
              logger.error(`Failed to process Sleeper player ${sleeperId}:`, error);
            }
          }
        });

        if (processedCount % 500 === 0) {
          logger.info(`Processed ${processedCount}/${playerCount} current players`);
        }
      }

      logger.info(`Current player data update completed: ${processedCount} players processed`);
    } catch (error) {
      logger.error('Failed to update current player data:', error);
      throw error;
    }
  }

  /**
   * Normalize Sleeper API player data
   */
  private normalizeSleeperPlayer(sleeperId: string, data: any): { player: any; current: any } {
    const playerId = data.player_id || `sleeper_${sleeperId}`;

    return {
      player: {
        player_id: playerId,
        sleeper_id: sleeperId,
        first_name: data.first_name,
        last_name: data.last_name,
        position: data.position,
        team: data.team,
        college: data.college,
        height: data.height ? parseInt(data.height) : null,
        weight: data.weight ? parseInt(data.weight) : null,
        age: data.age ? parseInt(data.age) : null,
        years_exp: data.years_exp ? parseInt(data.years_exp) : null,
        birth_date: data.birth_date ? new Date(data.birth_date) : null
      },
      current: {
        player_id: playerId,
        status: data.status,
        injury_status: data.injury_status,
        depth_chart_position: data.depth_chart_position,
        ownership_percentage: null, // Not provided by basic API
        trending_direction: null,
        news_updated: data.news_updated ? new Date(data.news_updated) : null,
        sleeper_data: data
      }
    };
  }

  /**
   * Run daily data sync
   */
  async runDailySync(): Promise<void> {
    logger.info('Starting daily data sync');
    
    try {
      // Update current player data
      await this.updateCurrentPlayerData();
      
      // TODO: Add trending players update
      // TODO: Add weekly stats update during season
      
      logger.info('Daily data sync completed successfully');
    } catch (error) {
      logger.error('Daily data sync failed:', error);
      throw error;
    }
  }
}

export const dataIngestion = new DataIngestionService();