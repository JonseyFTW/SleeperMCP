# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development server with hot reload
npm run dev

# Build TypeScript to dist/
npm run build

# Start production server
npm start

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Lint TypeScript files
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Type check without emitting files
npm run type-check
```

## Architecture Overview

This is a Model Context Protocol (MCP) server that wraps the Sleeper Fantasy Football API as a JSON-RPC 2.0 service. The architecture follows a layered approach:

### Core Components

- **`src/index.ts`** - Application bootstrap with Express app setup, middleware configuration, and graceful shutdown handling
- **`src/server/server.ts`** - Express server creation with JSON-RPC endpoint configuration and middleware pipeline
- **`src/config.ts`** - Centralized configuration using Zod validation with environment variable parsing
- **`src/rpc/index.ts`** - JSON-RPC method registry with error handling wrapper for all RPC methods

### Service Layers

- **`src/api/client.ts`** - Sleeper API HTTP client with axios, handles external API communication
- **`src/cache/`** - Redis-based caching layer with configurable TTL per endpoint type
- **`src/rpc/methods/`** - Individual RPC method implementations organized by domain (user, league, player, draft, state)

### Infrastructure

- **`src/middleware/`** - Express middleware for rate limiting, health checks, metrics, error handling, and request logging
- **`src/utils/`** - Shared utilities including structured logging (Winston), graceful shutdown, validation schemas, and custom error classes

### Configuration System

The config system uses Zod schemas for type-safe environment variable parsing with defaults. Key configurations include cache TTL per endpoint type, Redis settings, rate limiting, and feature flags.

## Key Patterns

- All RPC methods are automatically wrapped with error handling, logging, and performance timing
- API responses are cached in Redis with different TTL values based on data volatility
- JSON-RPC errors are properly mapped from HTTP status codes and network errors  
- Graceful shutdown handles cleanup of Redis connections and HTTP server
- OpenRPC specification is auto-generated for API documentation

## Testing

- Unit tests for individual components in `src/**/*.test.ts`
- Integration tests in `src/test/integration/`
- Test setup and utilities in `src/test/setup.ts`
- Use Jest with TypeScript support via ts-jest

## Docker & Deployment

- `Dockerfile` for containerized deployment
- `docker-compose.yml` includes Redis for local development
- Environment variables configured via `.env` file
- Prometheus metrics available at `/metrics` endpoint when enabled