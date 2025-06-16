#!/bin/bash

# MCP Sleeper Server Setup Script
# This script helps set up the development environment

set -e

echo "🏈 MCP Sleeper Server Setup"
echo "=========================="

# Check for required tools
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed. Please install $1 first."
        exit 1
    fi
    echo "✅ $1 is installed"
}

echo ""
echo "Checking dependencies..."
check_command node
check_command npm
check_command docker
check_command docker-compose

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js version is compatible: $(node -v)"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created. Please review and update as needed."
else
    echo "✅ .env file already exists"
fi

# Install dependencies
echo ""
echo "Installing npm dependencies..."
npm install
echo "✅ Dependencies installed"

# Build the project
echo ""
echo "Building TypeScript project..."
npm run build
echo "✅ Project built successfully"

# Run tests
echo ""
echo "Running tests..."
npm test
echo "✅ Tests passed"

# Docker setup
echo ""
echo "Docker Setup"
echo "------------"
read -p "Do you want to build the Docker image? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Building Docker image..."
    docker build -t mcp-sleeper-server .
    echo "✅ Docker image built"
fi

# Start services
echo ""
echo "Starting Services"
echo "-----------------"
read -p "Do you want to start the services with Docker Compose? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting services..."
    docker-compose up -d
    echo "✅ Services started"
    echo ""
    echo "Services running:"
    echo "- MCP Server: http://localhost:8080"
    echo "- API Docs: http://localhost:8080/docs"
    echo "- Health Check: http://localhost:8080/health"
    echo "- OpenRPC Spec: http://localhost:8080/openrpc.json"
    echo ""
    echo "To view logs: docker-compose logs -f"
    echo "To stop services: docker-compose down"
else
    echo ""
    echo "To start the server locally:"
    echo "- Development: npm run dev"
    echo "- Production: npm start"
fi

echo ""
echo "🎉 Setup complete! Happy coding!"
echo ""
echo "Next steps:"
echo "1. Review and update .env file with your configuration"
echo "2. Test the API with: curl -X POST http://localhost:8080/rpc -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"method\":\"sleeper.getNFLState\",\"id\":1}'"
echo "3. View the interactive documentation at http://localhost:8080/docs"
echo "4. Check out the README.md for more information"