#!/bin/bash

# Nightly Delta Update Job for Sleeper Analytics
# This script runs every night to check for and process new data

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/nightly-update-$(date +%Y%m%d).log"
ERROR_LOG="$LOG_DIR/nightly-errors-$(date +%Y%m%d).log"
MAX_LOG_FILES=30

# Colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure logs directory exists
mkdir -p "$LOG_DIR"

# Function to log with timestamp
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
    
    # Also log to console with colors if running interactively
    if [[ -t 1 ]]; then
        case $level in
            INFO)  echo -e "${BLUE}[$timestamp] [INFO]${NC} $message" ;;
            SUCCESS) echo -e "${GREEN}[$timestamp] [SUCCESS]${NC} $message" ;;
            WARNING) echo -e "${YELLOW}[$timestamp] [WARNING]${NC} $message" ;;
            ERROR) echo -e "${RED}[$timestamp] [ERROR]${NC} $message" ;;
            *) echo "[$timestamp] [$level] $message" ;;
        esac
    fi
}

# Function to handle errors
handle_error() {
    local exit_code=$?
    local line_number=$1
    
    log "ERROR" "Script failed at line $line_number with exit code $exit_code"
    echo "[$timestamp] Script failed at line $line_number with exit code $exit_code" >> "$ERROR_LOG"
    
    # Send notification (if configured)
    send_notification "ERROR" "Nightly analytics sync failed at line $line_number"
    
    exit $exit_code
}

# Function to send notifications (placeholder for future implementation)
send_notification() {
    local level="$1"
    local message="$2"
    
    # TODO: Implement notification system (email, Slack, Discord, etc.)
    # For now, just log the notification
    log "NOTIFICATION" "[$level] $message"
    
    # Example implementations:
    # curl -X POST -H 'Content-type: application/json' \
    #   --data "{\"text\":\"$message\"}" \
    #   "$SLACK_WEBHOOK_URL"
    
    # echo "$message" | mail -s "Sleeper Analytics $level" "$ADMIN_EMAIL"
}

# Function to check if services are running
check_services() {
    log "INFO" "Checking required services..."
    
    # Check if Docker containers are running
    if ! docker ps | grep -q "sleeper-analytics-db"; then
        log "ERROR" "PostgreSQL container is not running"
        return 1
    fi
    
    if ! docker ps | grep -q "sleeper-redis"; then
        log "ERROR" "Redis container is not running"
        return 1
    fi
    
    # Test database connection
    if ! docker exec sleeper-analytics-db pg_isready -U sleeper -d sleeper_analytics > /dev/null 2>&1; then
        log "ERROR" "PostgreSQL is not accepting connections"
        return 1
    fi
    
    # Test Redis connection
    if ! docker exec sleeper-redis redis-cli ping | grep -q PONG; then
        log "ERROR" "Redis is not responding"
        return 1
    fi
    
    log "SUCCESS" "All services are running"
    return 0
}

# Function to cleanup old log files
cleanup_logs() {
    log "INFO" "Cleaning up old log files..."
    
    # Keep only the last MAX_LOG_FILES files
    find "$LOG_DIR" -name "nightly-update-*.log" -type f | sort | head -n -$MAX_LOG_FILES | xargs -r rm
    find "$LOG_DIR" -name "nightly-errors-*.log" -type f | sort | head -n -$MAX_LOG_FILES | xargs -r rm
    
    log "INFO" "Log cleanup completed"
}

# Function to collect system stats
collect_stats() {
    log "INFO" "Collecting system statistics..."
    
    # Database size
    local db_size=$(docker exec sleeper-analytics-db psql -U sleeper -d sleeper_analytics -t -c "SELECT pg_size_pretty(pg_database_size('sleeper_analytics'));" | xargs)
    log "INFO" "Database size: $db_size"
    
    # Player count
    local player_count=$(docker exec sleeper-analytics-db psql -U sleeper -d sleeper_analytics -t -c "SELECT COUNT(*) FROM players;" | xargs)
    log "INFO" "Total players: $player_count"
    
    # Stats records count
    local stats_count=$(docker exec sleeper-analytics-db psql -U sleeper -d sleeper_analytics -t -c "SELECT COUNT(*) FROM player_season_stats;" | xargs)
    log "INFO" "Total stats records: $stats_count"
    
    # Disk usage
    local disk_usage=$(df -h "$PROJECT_DIR" | tail -1 | awk '{print $5}')
    log "INFO" "Disk usage: $disk_usage"
}

# Function to run the delta sync
run_delta_sync() {
    log "INFO" "Starting nightly delta sync..."
    
    cd "$PROJECT_DIR"
    
    # Set environment variables if needed
    export NODE_ENV=${NODE_ENV:-production}
    
    # Run the delta sync
    if npm run analytics:nightly-delta >> "$LOG_FILE" 2>> "$ERROR_LOG"; then
        log "SUCCESS" "Delta sync completed successfully"
        return 0
    else
        log "ERROR" "Delta sync failed"
        return 1
    fi
}

# Function to run health checks
run_health_checks() {
    log "INFO" "Running post-sync health checks..."
    
    cd "$PROJECT_DIR"
    
    # Test analytics functionality
    if npx tsx scripts/analytics-cli.ts test-analytics >> "$LOG_FILE" 2>> "$ERROR_LOG"; then
        log "SUCCESS" "Analytics health check passed"
    else
        log "WARNING" "Analytics health check failed (non-critical)"
    fi
    
    # Check for data consistency
    local recent_updates=$(docker exec sleeper-analytics-db psql -U sleeper -d sleeper_analytics -t -c "SELECT COUNT(*) FROM player_current_data WHERE updated_at > NOW() - INTERVAL '2 days';" | xargs)
    
    if [ "$recent_updates" -gt 1000 ]; then
        log "SUCCESS" "Data freshness check passed ($recent_updates recent updates)"
    else
        log "WARNING" "Low number of recent updates: $recent_updates"
    fi
}

# Function to generate summary report
generate_summary() {
    local start_time="$1"
    local end_time=$(date)
    local duration=$(($(date +%s) - start_time))
    
    log "INFO" "=== Nightly Sync Summary ==="
    log "INFO" "Start time: $(date -d @$start_time)"
    log "INFO" "End time: $end_time"
    log "INFO" "Duration: ${duration}s"
    log "INFO" "Log file: $LOG_FILE"
    
    # Check if there were any errors
    if [ -s "$ERROR_LOG" ]; then
        log "WARNING" "Errors were logged to: $ERROR_LOG"
        send_notification "WARNING" "Nightly sync completed with errors. Check logs: $ERROR_LOG"
    else
        log "SUCCESS" "Nightly sync completed without errors"
        send_notification "SUCCESS" "Nightly analytics sync completed successfully"
    fi
}

# Main execution function
main() {
    local start_time=$(date +%s)
    
    # Set up error handling
    trap 'handle_error $LINENO' ERR
    
    log "INFO" "🌙 Starting nightly analytics update job"
    log "INFO" "Project directory: $PROJECT_DIR"
    log "INFO" "Log file: $LOG_FILE"
    
    # Pre-flight checks
    check_services || exit 1
    
    # Collect initial stats
    collect_stats
    
    # Run the main sync
    if run_delta_sync; then
        log "SUCCESS" "Main sync operation completed"
    else
        log "ERROR" "Main sync operation failed"
        send_notification "ERROR" "Nightly analytics sync failed during main operation"
        exit 1
    fi
    
    # Post-sync health checks
    run_health_checks
    
    # Cleanup
    cleanup_logs
    
    # Generate summary
    generate_summary "$start_time"
    
    log "SUCCESS" "🎉 Nightly analytics update completed successfully"
}

# Run main function with all arguments
main "$@"