#!/bin/bash

# Analytics Setup Script for Sleeper MCP Server
# This script will set up the complete analytics system

set -e  # Exit on any error

echo "🚀 Starting Sleeper Analytics Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed and running
check_docker() {
    print_status "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        echo "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    print_success "Docker is installed and running"
}

# Check if Docker Compose is available
check_docker_compose() {
    print_status "Checking Docker Compose..."
    
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    elif docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    else
        print_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
    
    print_success "Docker Compose is available: $DOCKER_COMPOSE"
}

# Check if Node.js and npm are installed
check_node() {
    print_status "Checking Node.js installation..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. Current version: $(node --version)"
        exit 1
    fi
    
    print_success "Node.js $(node --version) is installed"
}

# Install npm dependencies
install_dependencies() {
    print_status "Installing npm dependencies..."
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Please run this script from the project root."
        exit 1
    fi
    
    npm install
    print_success "Dependencies installed successfully"
}

# Start database services
start_databases() {
    print_status "Starting database services..."
    
    # Stop any existing containers
    $DOCKER_COMPOSE -f docker-compose.analytics.yml down 2>/dev/null || true
    
    # Start the services
    $DOCKER_COMPOSE -f docker-compose.analytics.yml up -d
    
    print_status "Waiting for databases to be ready..."
    
    # Wait for PostgreSQL to be ready
    for i in {1..30}; do
        if docker exec sleeper-analytics-db pg_isready -U sleeper -d sleeper_analytics &> /dev/null; then
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "PostgreSQL failed to start within 30 seconds"
            exit 1
        fi
        sleep 1
    done
    
    # Wait for Redis to be ready
    for i in {1..20}; do
        if docker exec sleeper-redis redis-cli ping | grep PONG &> /dev/null; then
            break
        fi
        if [ $i -eq 20 ]; then
            print_error "Redis failed to start within 20 seconds"
            exit 1
        fi
        sleep 1
    done
    
    print_success "Database services are running"
}

# Set up environment variables
setup_environment() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f ".env" ]; then
        print_status "Creating .env file..."
        cat > .env << EOF
# Node Environment
NODE_ENV=development

# Server Configuration
PORT=8080
CORS_ORIGIN=*

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_TTL=300

# PostgreSQL Analytics Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=sleeper_analytics
POSTGRES_USER=sleeper
POSTGRES_PASSWORD=password

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000

# Logging
LOG_LEVEL=info

# Sleeper API
SLEEPER_API_BASE_URL=https://api.sleeper.app/v1
SLEEPER_API_TIMEOUT=30000

# Cache Settings
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=300

# Feature Flags
ENABLE_METRICS=true
ENABLE_OPENRPC_UI=true
EOF
        print_success "Created .env file with default configuration"
    else
        print_status ".env file already exists, checking for analytics settings..."
        
        # Add analytics settings if they don't exist
        if ! grep -q "POSTGRES_HOST" .env; then
            echo "" >> .env
            echo "# PostgreSQL Analytics Database" >> .env
            echo "POSTGRES_HOST=localhost" >> .env
            echo "POSTGRES_PORT=5432" >> .env
            echo "POSTGRES_DB=sleeper_analytics" >> .env
            echo "POSTGRES_USER=sleeper" >> .env
            echo "POSTGRES_PASSWORD=password" >> .env
            print_success "Added analytics configuration to existing .env file"
        fi
    fi
}

# Initialize database schema
setup_database() {
    print_status "Setting up database schema..."
    
    npm run analytics:setup
    print_success "Database schema initialized"
}

# Ingest historical data
ingest_historical_data() {
    print_status "Starting historical data ingestion..."
    print_warning "This process may take 10-30 minutes depending on your internet connection."
    print_status "You can monitor progress in the console output."
    
    # Ask user if they want to proceed
    echo
    read -p "Do you want to ingest historical data now? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Starting data ingestion (this may take a while)..."
        npm run analytics:ingest
        print_success "Historical data ingestion completed"
    else
        print_warning "Skipping historical data ingestion. You can run it later with: npm run analytics:ingest"
    fi
}

# Update current player data
update_current_data() {
    print_status "Updating current player data from Sleeper API..."
    
    npm run analytics:update
    print_success "Current player data updated"
}

# Test the analytics system
test_analytics() {
    print_status "Testing analytics system..."
    
    npm run analytics:test
    print_success "Analytics system test completed"
}

# Set up nightly job
setup_nightly_job() {
    print_status "Setting up nightly delta update job..."
    
    # Create the nightly job script
    cat > scripts/nightly-update.sh << 'EOF'
#!/bin/bash

# Nightly Delta Update Job for Sleeper Analytics
# This script runs every night to check for and process new data

cd "$(dirname "$0")/.."

LOG_FILE="logs/nightly-update-$(date +%Y%m%d).log"
mkdir -p logs

echo "$(date): Starting nightly delta update" >> "$LOG_FILE"

# Run the nightly update
npm run analytics:sync >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo "$(date): Nightly update completed successfully" >> "$LOG_FILE"
else
    echo "$(date): Nightly update failed" >> "$LOG_FILE"
fi
EOF
    
    chmod +x scripts/nightly-update.sh
    
    print_success "Nightly job script created at scripts/nightly-update.sh"
    print_status "To set up automatic scheduling, see the instructions below."
}

# Print final instructions
print_final_instructions() {
    echo
    print_success "🎉 Analytics setup completed successfully!"
    echo
    echo "🔧 Services running:"
    echo "  - PostgreSQL: localhost:5432 (sleeper_analytics database)"
    echo "  - Redis: localhost:6379"
    echo "  - pgAdmin: http://localhost:5050 (admin@sleeper.com / admin)"
    echo
    echo "📊 Available commands:"
    echo "  npm run analytics:setup    - Initialize database schema"
    echo "  npm run analytics:ingest   - Ingest historical data"
    echo "  npm run analytics:update   - Update current player data"
    echo "  npm run analytics:sync     - Run complete daily sync"
    echo "  npm run analytics:test     - Test analytics functionality"
    echo
    echo "🕒 To set up automated nightly updates:"
    echo "  Option 1 - Cron (Linux/Mac):"
    echo "    crontab -e"
    echo "    Add: 0 6 * * * /path/to/project/scripts/nightly-update.sh"
    echo
    echo "  Option 2 - Task Scheduler (Windows):"
    echo "    Create a task to run scripts/nightly-update.sh daily at 6 AM"
    echo
    echo "  Option 3 - GitHub Actions / Cloud Scheduler for production"
    echo
    echo "🚀 Start your MCP server:"
    echo "  npm run dev"
    echo
    echo "📖 View analytics documentation:"
    echo "  cat ANALYTICS.md"
    echo
}

# Main execution
main() {
    echo "🏈 Sleeper MCP Analytics Setup"
    echo "=============================="
    echo
    
    check_docker
    check_docker_compose
    check_node
    install_dependencies
    setup_environment
    start_databases
    setup_database
    update_current_data
    ingest_historical_data
    test_analytics
    setup_nightly_job
    print_final_instructions
}

# Run main function
main "$@"