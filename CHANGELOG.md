# Changelog

All notable changes to the MCP Sleeper Server project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-20

### Added
- Initial release of MCP Sleeper Fantasy Football API Server
- Complete JSON-RPC 2.0 implementation following Model Context Protocol
- Full coverage of Sleeper API endpoints:
  - User methods (getUserByUsername, getUserById)
  - League methods (getLeague, getRosters, getMatchups, etc.)
  - Player methods (getAllPlayers, getTrendingPlayers)
  - Draft methods (getDraft, getDraftPicks, etc.)
  - State methods (getNFLState)
- Redis caching with automatic fallback to in-memory cache
- Rate limiting (1000 requests/minute) to comply with Sleeper API limits
- Comprehensive error handling with JSON-RPC error codes
- Health check endpoint with dependency status
- Prometheus metrics endpoint for monitoring
- OpenRPC specification and interactive documentation
- Docker containerization with multi-stage build
- Docker Compose setup with Redis integration
- TypeScript implementation with strict typing
- Comprehensive test suite with unit and integration tests
- CI/CD pipeline with GitHub Actions
- ESLint and Prettier configuration
- Request logging and performance monitoring
- Graceful shutdown handling
- Environment-based configuration
- LLM integration examples and documentation

### Security
- Helmet.js for security headers
- CORS configuration
- Input validation with Zod schemas
- Non-root Docker user
- No authentication required (follows Sleeper API model)

### Documentation
- Comprehensive README with quick start guide
- OpenRPC specification for all methods
- Integration examples for various platforms
- API documentation with request/response examples
- Setup script for easy development environment configuration

## [Unreleased]

### Planned Features
- WebSocket support for real-time updates
- GraphQL interface alongside JSON-RPC
- Built-in scheduling for periodic data fetching
- Advanced caching strategies per endpoint
- Bulk data export functionality
- Historical data analysis endpoints
- Custom aggregation methods
- Plugin system for extending functionality
- Admin dashboard for monitoring
- Kubernetes Helm charts