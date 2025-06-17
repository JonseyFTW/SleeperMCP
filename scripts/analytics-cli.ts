#!/usr/bin/env npx tsx

import 'dotenv/config';
import { Command } from 'commander';
import { analyticsService } from '../src/analytics/service';
import { deltaSyncService } from '../src/analytics/delta-sync';
import { logger } from '../src/utils/logger';

const program = new Command();

program
  .name('analytics-cli')
  .description('CLI for managing analytics data')
  .version('1.0.0');

program
  .command('ingest-historical')
  .description('Ingest historical player data from GitHub repository')
  .option('-s, --start-year <year>', 'Start year for ingestion', '2015')
  .option('-e, --end-year <year>', 'End year for ingestion', '2024')
  .action(async (options) => {
    try {
      logger.info('Starting historical data ingestion...');
      await analyticsService.initialize();
      
      const startYear = parseInt(options.startYear);
      const endYear = parseInt(options.endYear);
      
      await analyticsService.ingestHistoricalData(startYear, endYear);
      
      logger.info('Historical data ingestion completed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Historical data ingestion failed:', error);
      process.exit(1);
    }
  });

program
  .command('update-current')
  .description('Update current player data from Sleeper API')
  .action(async () => {
    try {
      logger.info('Starting current data update...');
      await analyticsService.initialize();
      
      await analyticsService.updateCurrentData();
      
      logger.info('Current data update completed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Current data update failed:', error);
      process.exit(1);
    }
  });

program
  .command('daily-sync')
  .description('Run complete daily data synchronization')
  .action(async () => {
    try {
      logger.info('Starting daily sync...');
      await analyticsService.initialize();
      
      await analyticsService.runDailySync();
      
      logger.info('Daily sync completed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Daily sync failed:', error);
      process.exit(1);
    }
  });

program
  .command('nightly-delta')
  .description('Run nightly delta sync to check for new data')
  .action(async () => {
    try {
      logger.info('Starting nightly delta sync...');
      await analyticsService.initialize();
      
      const result = await deltaSyncService.runNightlySync();
      
      if (result.hasNewData) {
        logger.info(`✅ Delta sync completed: Found new data from ${result.source}`);
        logger.info(`Changes: ${JSON.stringify(result.changes, null, 2)}`);
      } else {
        logger.info('✅ Delta sync completed: No new data found');
      }
      
      process.exit(0);
    } catch (error) {
      logger.error('Nightly delta sync failed:', error);
      process.exit(1);
    }
  });

program
  .command('check-delta')
  .description('Check for new data without syncing')
  .action(async () => {
    try {
      logger.info('Checking for delta changes...');
      await analyticsService.initialize();
      
      const status = await deltaSyncService.getSyncStatus();
      
      console.log('\n📊 Sync Status:');
      console.log(JSON.stringify(status, null, 2));
      
      process.exit(0);
    } catch (error) {
      logger.error('Delta check failed:', error);
      process.exit(1);
    }
  });

program
  .command('force-sync')
  .description('Force a complete delta sync (for testing)')
  .action(async () => {
    try {
      logger.info('Forcing delta sync...');
      await analyticsService.initialize();
      
      const result = await deltaSyncService.forceDeltaSync();
      
      logger.info('Force sync results:', result);
      process.exit(0);
    } catch (error) {
      logger.error('Force sync failed:', error);
      process.exit(1);
    }
  });

program
  .command('setup-db')
  .description('Set up analytics database schema')
  .action(async () => {
    try {
      logger.info('Setting up analytics database...');
      await analyticsService.initialize();
      
      logger.info('Analytics database setup completed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Database setup failed:', error);
      process.exit(1);
    }
  });

program
  .command('test-analytics')
  .description('Test analytics functionality with sample queries')
  .option('-p, --player-id <id>', 'Player ID to test with')
  .action(async (options) => {
    try {
      logger.info('Testing analytics functionality...');
      await analyticsService.initialize();
      
      // Test basic analytics queries
      const testPlayerId = options.playerId || 'sample_player_id';
      
      logger.info('Testing player analytics...');
      const playerAnalytics = await analyticsService.getPlayerAnalytics(testPlayerId);
      logger.info('Player analytics result:', playerAnalytics);
      
      logger.info('Testing position analytics...');
      const positionAnalytics = await analyticsService.getPositionAnalytics('QB');
      logger.info('Position analytics sample:', {
        total_players: positionAnalytics?.total_players,
        top_3_players: positionAnalytics?.leaders?.slice(0, 3)
      });
      
      logger.info('Analytics testing completed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Analytics testing failed:', error);
      process.exit(1);
    }
  });

// Add error handling for the CLI
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception in CLI:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection in CLI at:', promise, 'reason:', reason);
  process.exit(1);
});

program.parse(process.argv);