# Analytics System for Sleeper MCP Server

## Overview

The analytics system provides comprehensive historical and current NFL player data analysis for building AI predictions and fantasy football insights. It's designed to be production-ready with proper data storage, validation, and automated ingestion pipelines.

## Architecture

### Data Sources
- **Historical Data**: NFL player stats from 2015-2024 via GitHub repository (https://github.com/hvpkod/NFL-Data)
- **Current Data**: Live player information from Sleeper API
- **Trending Data**: Real-time player trends and ownership data

### Database Design
- **PostgreSQL**: Primary analytics database with optimized schema
- **Time-series structure**: Efficient querying for player performance over time
- **Proper indexing**: Fast lookups for common analytics queries
- **Normalized data**: Separate tables for players, stats, and current status

### Key Features
- ✅ **Historical Data Ingestion**: Automated download and processing of CSV files
- ✅ **Current Data Sync**: Regular updates from Sleeper API
- ✅ **Player Analytics**: Performance metrics, consistency scores, trend analysis
- ✅ **Position Rankings**: Comparative analysis within positions
- ✅ **Projections**: ML-ready predictions based on historical performance
- ✅ **Matchup Analysis**: Historical performance vs specific opponents

## Quick Start

### 1. Database Setup

Start PostgreSQL and Redis with Docker:
```bash
docker-compose -f docker-compose.analytics.yml up -d
```

This will start:
- PostgreSQL on port 5432
- Redis on port 6379  
- pgAdmin on port 5050 (admin@sleeper.com / admin)

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Add to your `.env` file:
```env
# PostgreSQL Analytics Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=sleeper_analytics
POSTGRES_USER=sleeper
POSTGRES_PASSWORD=password
```

### 4. Initialize Database Schema

```bash
npm run analytics:setup
```

### 5. Ingest Historical Data

```bash
# Ingest all years (2015-2024)
npm run analytics:ingest

# Or specific years
npx tsx scripts/analytics-cli.ts ingest-historical --start-year 2020 --end-year 2024
```

### 6. Update Current Player Data

```bash
npm run analytics:update
```

## Analytics API Methods

The analytics system integrates seamlessly with your existing MCP server, adding these new JSON-RPC methods:

### Player Analytics
```javascript
// Get comprehensive player analytics
{
  "jsonrpc": "2.0",
  "method": "sleeper.getPlayerAnalytics",
  "params": {
    "playerId": "4046"
  },
  "id": 1
}
```

Returns:
- Career statistics
- Recent performance trends
- Consistency scores
- Position rankings
- Projection confidence

### Position Analytics
```javascript
// Get position rankings and comparisons
{
  "jsonrpc": "2.0", 
  "method": "sleeper.getPositionAnalytics",
  "params": {
    "position": "QB",
    "season": 2024
  },
  "id": 2
}
```

### Player Projections
```javascript
// Get ML-ready projections
{
  "jsonrpc": "2.0",
  "method": "sleeper.getPlayerProjections", 
  "params": {
    "playerId": "4046",
    "weeks": 4
  },
  "id": 3
}
```

### Matchup Analysis
```javascript
// Analyze historical performance vs opponent
{
  "jsonrpc": "2.0",
  "method": "sleeper.getMatchupAnalysis",
  "params": {
    "playerId": "4046",
    "opponentTeam": "KC"
  },
  "id": 4
}
```

### Player Comparisons
```javascript
// Compare multiple players head-to-head
{
  "jsonrpc": "2.0",
  "method": "sleeper.comparePlayersHQ",
  "params": {
    "playerIds": ["4046", "4035", "4039"]
  },
  "id": 5
}
```

## CLI Commands

### Data Management
```bash
# Set up database schema
npm run analytics:setup

# Ingest historical data (2015-2024)
npm run analytics:ingest

# Update current player data from Sleeper API  
npm run analytics:update

# Run complete daily sync
npm run analytics:sync

# Test analytics functionality
npm run analytics:test
```

### Advanced Usage
```bash
# Custom year range for historical data
npx tsx scripts/analytics-cli.ts ingest-historical --start-year 2020 --end-year 2024

# Test with specific player
npx tsx scripts/analytics-cli.ts test-analytics --player-id "4046"
```

## Data Pipeline

### Historical Data Ingestion
1. **Download**: Fetches CSV files from GitHub repository
2. **Normalize**: Maps varying column names to consistent schema
3. **Validate**: Ensures data quality and completeness
4. **Store**: Upserts into PostgreSQL with conflict resolution

### Current Data Updates
1. **Fetch**: Gets latest player data from Sleeper API
2. **Process**: Normalizes and enriches player information
3. **Sync**: Updates player status, injury info, trending data
4. **Cache**: Maintains fast access for frequent queries

### Analytics Calculations
- **Consistency Score**: Statistical variance analysis (0-100 scale)
- **Trend Direction**: Weighted average of recent performance
- **Projections**: Multi-factor predictive modeling
- **Position Rankings**: Relative performance within position groups

## Performance Optimizations

### Database Indexing
- Composite indexes on player_id + season + week
- Position-based indexes for rankings
- Time-based indexes for trend analysis

### Query Optimization
- Materialized views for common analytics queries
- Connection pooling for concurrent requests
- Batch processing for bulk operations

### Caching Strategy
- Redis cache for frequently accessed analytics
- Smart TTL based on data volatility
- Cache warming for popular players

## Monitoring & Maintenance

### Daily Sync Automation
Set up a cron job or scheduler to run daily updates:
```bash
# Add to crontab for daily 6 AM sync
0 6 * * * cd /path/to/sleeper-mcp && npm run analytics:sync
```

### Database Maintenance
```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('sleeper_analytics'));

-- Analyze table statistics
ANALYZE player_season_stats;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats WHERE tablename = 'player_season_stats';
```

## Troubleshooting

### Common Issues

**1. Database Connection Failed**
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check connection
psql -h localhost -U sleeper -d sleeper_analytics
```

**2. Historical Data Download Fails**
- Check internet connectivity
- Verify GitHub repository URLs are accessible
- Ensure sufficient disk space

**3. Memory Issues During Ingestion**
- Reduce batch size in ingestion service
- Increase Node.js memory limit: `--max-old-space-size=4096`

**4. Slow Analytics Queries**
- Check database indexes: `EXPLAIN ANALYZE SELECT ...`
- Ensure statistics are up to date: `ANALYZE table_name`
- Consider query optimization or additional indexes

## ML/AI Integration

### Feature Engineering
The analytics system provides ML-ready features:
- **Time Series**: Weekly performance over multiple seasons
- **Consistency Metrics**: Variance and stability scores  
- **Opponent Adjustments**: Performance vs strength of schedule
- **Trend Indicators**: Recent form and momentum
- **Position Context**: Relative performance within position

### Export for ML Models
```javascript
// Get comprehensive dataset for ML training
const features = await analyticsService.getPlayerAnalytics(playerId);
const trends = await analyticsService.getPlayerTrends(playerId, 20);
const matchups = await analyticsService.getMatchupAnalysis(playerId, 'all');
```

### Prediction Pipeline
1. **Feature Extraction**: Use analytics API to get structured features
2. **Data Preparation**: Normalize and engineer additional features
3. **Model Training**: Train on historical performance data
4. **Prediction**: Generate projections with confidence intervals
5. **Validation**: Backtest against actual outcomes

## Advanced Analytics

### Custom Queries
Direct database access for advanced analytics:
```sql
-- Player performance trends
SELECT player_id, season, week, fantasy_points,
       AVG(fantasy_points) OVER (PARTITION BY player_id ORDER BY season, week ROWS 4 PRECEDING) as rolling_avg
FROM player_season_stats
WHERE player_id = '4046'
ORDER BY season DESC, week DESC;

-- Position scarcity analysis  
SELECT position,
       COUNT(*) as total_players,
       AVG(fantasy_points) as avg_points,
       STDDEV(fantasy_points) as point_variance
FROM player_career_stats
GROUP BY position
ORDER BY avg_points DESC;
```

### Integration with R/Python
```python
# Python example using psycopg2
import psycopg2
import pandas as pd

conn = psycopg2.connect(
    host="localhost",
    database="sleeper_analytics", 
    user="sleeper",
    password="password"
)

# Load player data for ML
df = pd.read_sql_query("""
    SELECT * FROM player_season_stats 
    WHERE season >= 2020
""", conn)
```

## Why This Approach is Better

### vs. JSON Files
- ✅ **Structured Queries**: Complex analytics vs simple key-value lookups
- ✅ **Relationships**: Proper joins between players, teams, seasons
- ✅ **Indexing**: Fast lookups on any field combination
- ✅ **Transactions**: ACID compliance for data consistency
- ✅ **Concurrent Access**: Multiple users/processes safely

### vs. Simple Python Script
- ✅ **Production Ready**: Enterprise-grade database storage
- ✅ **Automated Pipeline**: Scheduled updates and error handling
- ✅ **API Integration**: Seamless MCP server integration
- ✅ **Scalability**: Handles millions of records efficiently
- ✅ **Data Validation**: Schema enforcement and data quality

### vs. Other Solutions
- ✅ **Cost Effective**: Open source PostgreSQL vs expensive analytics DBs
- ✅ **Flexible**: Custom analytics vs rigid SaaS platforms  
- ✅ **Integrated**: Built into your existing infrastructure
- ✅ **Extensible**: Easy to add new metrics and data sources

This analytics system provides a solid foundation for any fantasy football AI/ML project with production-grade data management and rich analytical capabilities.