# Nightly Delta Sync System

## Overview

The nightly delta sync system automatically checks for and processes new fantasy football data every night. It's designed to be efficient, reliable, and production-ready with comprehensive monitoring and error handling.

## What It Does

### 🔍 **Smart Delta Detection**
- **GitHub Repository Monitoring**: Checks for new commits to historical data
- **Sleeper API Changes**: Detects new/updated players and status changes
- **Weekly Stats**: Monitors for new weekly statistics during NFL season
- **Intelligent Scheduling**: Adjusts check frequency based on NFL season timing

### 📊 **Data Processing**
- **Incremental Updates**: Only processes new/changed data
- **Data Validation**: Ensures data quality and consistency
- **Error Handling**: Graceful failure handling with notifications
- **Performance Monitoring**: Tracks sync duration and success rates

## Quick Setup

### 1. **Run the Setup Script**
```bash
# Make executable and run
chmod +x scripts/setup-analytics.sh
./scripts/setup-analytics.sh
```

This will:
- ✅ Check prerequisites (Docker, Node.js)
- ✅ Start database services
- ✅ Set up environment configuration
- ✅ Initialize database schema
- ✅ Ingest historical data
- ✅ Create nightly job script

### 2. **Test the Delta Sync**
```bash
# Test delta detection (dry run)
npm run analytics:check-delta

# Test actual sync
npm run analytics:force-sync

# Run nightly delta sync
npm run analytics:nightly-delta
```

## Scheduling Options

### **Option 1: Cron (Linux/Mac) - Recommended**

Add to your crontab:
```bash
crontab -e

# Add this line for 6 AM daily sync
0 6 * * * /path/to/your/project/scripts/nightly-update.sh

# Or for 2 AM daily sync
0 2 * * * /path/to/your/project/scripts/nightly-update.sh
```

**Verify cron job:**
```bash
crontab -l
```

### **Option 2: Windows Task Scheduler**

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: Daily at desired time
4. Set action: Start a program
5. Program: `bash.exe`
6. Arguments: `/path/to/project/scripts/nightly-update.sh`
7. Start in: `/path/to/project`

### **Option 3: Docker with Cron**

Create a cron container:
```dockerfile
FROM node:18-alpine

RUN apk add --no-cache bash dcron

COPY scripts/nightly-update.sh /scripts/
COPY scripts/analytics-cli.ts /scripts/
COPY package*.json /app/

WORKDIR /app
RUN npm install

# Add cron job
RUN echo "0 6 * * * /scripts/nightly-update.sh" | crontab -

CMD ["crond", "-f"]
```

### **Option 4: Cloud Scheduler (Production)**

**AWS EventBridge:**
```yaml
ScheduleExpression: "cron(0 6 * * ? *)"
Target: 
  ECS Task or Lambda function
```

**GitHub Actions:**
```yaml
on:
  schedule:
    - cron: "0 6 * * *"  # 6 AM UTC daily
```

## Manual Commands

### **Development & Testing**
```bash
# Check what would be synced (dry run)
npm run analytics:check-delta

# Force a sync regardless of delta
npm run analytics:force-sync

# Run the nightly delta sync manually
npm run analytics:nightly-delta

# Get current sync status
npx tsx scripts/analytics-cli.ts check-delta
```

### **Data Management**
```bash
# Setup initial database
npm run analytics:setup

# Ingest all historical data
npm run analytics:ingest

# Update current player data only
npm run analytics:update

# Full sync (historical + current)
npm run analytics:sync
```

## Monitoring & Logs

### **Log Files**
- **Daily logs**: `logs/nightly-update-YYYYMMDD.log`
- **Error logs**: `logs/nightly-errors-YYYYMMDD.log`
- **Retention**: 30 days automatic cleanup

### **Log Contents**
- Sync start/end times and duration
- Data changes detected and processed
- Service health checks
- Database statistics
- Error details and stack traces

### **Example Log Output**
```
[2024-01-15 06:00:01] [INFO] 🌙 Starting nightly analytics update job
[2024-01-15 06:00:02] [SUCCESS] All services are running
[2024-01-15 06:00:03] [INFO] Database size: 2.1 GB
[2024-01-15 06:00:03] [INFO] Total players: 3,247
[2024-01-15 06:00:15] [INFO] 📈 New historical data detected on GitHub
[2024-01-15 06:05:32] [SUCCESS] Delta sync completed successfully
[2024-01-15 06:05:45] [SUCCESS] Analytics health check passed
[2024-01-15 06:05:46] [SUCCESS] 🎉 Nightly analytics update completed successfully
```

## API Integration

The delta sync can also be triggered via your MCP server's JSON-RPC API:

### **Check Sync Status**
```javascript
{
  "jsonrpc": "2.0",
  "method": "sleeper.getSyncStatus",
  "params": {},
  "id": 1
}
```

### **Trigger Nightly Sync**
```javascript
{
  "jsonrpc": "2.0", 
  "method": "sleeper.runNightlyDeltaSync",
  "params": {},
  "id": 2
}
```

### **Force Sync (Testing)**
```javascript
{
  "jsonrpc": "2.0",
  "method": "sleeper.forceDeltaSync", 
  "params": {},
  "id": 3
}
```

## Delta Detection Logic

### **GitHub Repository Changes**
- Checks commit history since last sync
- Focuses on `NFL-data-Players` directory
- Processes only new/modified files
- Handles CSV format variations gracefully

### **Sleeper API Changes**
- Compares player counts and last update timestamps
- Detects new player additions/removals
- Updates injury status, depth charts, ownership
- Refreshes trending player data

### **Weekly Stats (In Season)**
- Automatically detects NFL season timing
- Checks for missing weekly statistics
- Downloads current week stats when available
- Adjusts sync frequency during season

## Error Handling & Recovery

### **Automatic Recovery**
- Service health checks before sync
- Database connection validation
- Graceful degradation on partial failures
- Automatic retry for transient failures

### **Notification System**
Ready for integration with:
- 📧 Email notifications
- 💬 Slack/Discord webhooks  
- 📱 SMS alerts
- 📊 Monitoring dashboards

### **Common Issues & Solutions**

**🔴 Database Connection Failed**
```bash
# Check if containers are running
docker ps | grep sleeper

# Restart services
docker-compose -f docker-compose.analytics.yml restart
```

**🔴 GitHub API Rate Limiting**
- Uses conditional requests to minimize API calls
- Automatically backs off on rate limits
- Falls back to file-based detection

**🔴 Disk Space Issues**
- Monitor disk usage in logs
- Automatic log rotation (30 days)
- Database maintenance commands available

## Performance Tuning

### **During NFL Season**
- Increase sync frequency to every 4 hours
- Monitor for weekly stat releases (Tuesday/Wednesday)
- Scale database resources if needed

### **Off Season**
- Reduce to daily or weekly syncs
- Focus on player transactions and draft prep
- Archive old season data

### **Database Optimization**
```sql
-- Check database performance
EXPLAIN ANALYZE SELECT * FROM player_season_stats WHERE season = 2024;

-- Update table statistics
ANALYZE player_season_stats;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan 
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;
```

## Testing the System

### **Verify Delta Detection**
```bash
# Check what the system would sync
npm run analytics:check-delta

# Expected output shows:
# - Last sync times
# - Detected changes
# - Next sync schedule
```

### **Test Nightly Job**
```bash
# Run the complete nightly script
./scripts/nightly-update.sh

# Check logs
tail -f logs/nightly-update-$(date +%Y%m%d).log
```

### **Validate Data Integrity**
```bash
# Test analytics functionality
npm run analytics:test

# Check database consistency
npx tsx scripts/analytics-cli.ts test-analytics --player-id "4046"
```

## Production Deployment

### **Recommended Setup**
1. **Dedicated Server**: Run on always-on server/VPS
2. **Monitoring**: Set up log monitoring and alerts
3. **Backups**: Daily database backups before sync
4. **Notifications**: Configure failure alerts
5. **Documentation**: Keep sync logs for troubleshooting

### **Security Considerations**
- Store sensitive configs in environment variables
- Use read-only GitHub tokens when possible
- Regular security updates for dependencies
- Monitor for unusual sync patterns

The nightly delta sync system ensures your analytics data stays current automatically, with minimal maintenance required once properly configured.