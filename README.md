# MCP Sleeper Fantasy Football API Server

A Model Context Protocol (MCP) server that wraps the Sleeper Fantasy Football API, providing JSON-RPC 2.0 access to all Sleeper endpoints for LLM tool integration.

## Features

- 🏈 Complete Sleeper API coverage with JSON-RPC 2.0 methods
- 🚀 Built with TypeScript, Express, and Node.js
- 🐳 Fully containerized with Docker
- 💾 Redis caching for improved performance
- 🔒 Rate limiting (1000 requests/minute)
- 📚 Auto-generated OpenRPC documentation
- 🧪 Comprehensive test suite
- 🔄 CI/CD with GitHub Actions

## Quick Start

### Using Docker

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-sleeper-server.git
cd mcp-sleeper-server

# Start with Docker Compose
docker-compose up -d

# Server will be available at http://localhost:8080
```

### Local Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
npm start
```

## API Documentation

The server exposes a JSON-RPC 2.0 interface. View the interactive documentation at:
- OpenRPC Spec: `http://localhost:8080/openrpc.json`
- Interactive UI: `http://localhost:8080/docs`

## Available Methods

### User Methods
- `sleeper.getUserByUsername` - Get user by username
- `sleeper.getUserById` - Get user by ID

### League Methods
- `sleeper.getLeaguesForUser` - Get all leagues for a user
- `sleeper.getLeague` - Get league details
- `sleeper.getRosters` - Get all rosters in a league
- `sleeper.getUsers` - Get all users in a league
- `sleeper.getMatchups` - Get matchups for a specific week
- `sleeper.getTransactions` - Get transactions for a specific week
- `sleeper.getTradedPicks` - Get all traded draft picks

### Player Methods
- `sleeper.getAllPlayers` - Get all NFL players
- `sleeper.getTrendingPlayers` - Get trending players

### Draft Methods
- `sleeper.getDraftsForUser` - Get all drafts for a user
- `sleeper.getDraftsForLeague` - Get all drafts for a league
- `sleeper.getDraft` - Get specific draft details
- `sleeper.getDraftPicks` - Get all picks for a draft

### State Methods
- `sleeper.getNFLState` - Get current NFL state (week, season, etc.)

## Example Usage

### Using curl

```bash
# Get user by username
curl -X POST http://localhost:8080/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "sleeper.getUserByUsername",
    "params": {
      "username": "example_user"
    },
    "id": 1
  }'

# Get leagues for user
curl -X POST http://localhost:8080/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "sleeper.getLeaguesForUser",
    "params": {
      "userId": "12345678",
      "season": "2024"
    },
    "id": 2
  }'
```

### Using Node.js Client

```javascript
const client = require('jayson/lib/client/http');

const rpcClient = client('http://localhost:8080/rpc');

// Get user
rpcClient.request('sleeper.getUserByUsername', 
  { username: 'example_user' }, 
  (err, response) => {
    if (err) throw err;
    console.log(response.result);
  }
);
```

### Integration with LLM Agents

The server implements the Model Context Protocol, making it discoverable and usable by tool-capable LLMs. Configure your LLM agent to connect to:

```
http://localhost:8080/rpc
```

The agent can discover available methods via the OpenRPC spec at `/openrpc.json`.

## Configuration

Environment variables can be set in `.env` file:

```env
# Server Configuration
PORT=8080
NODE_ENV=production

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_TTL=300

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000

# Logging
LOG_LEVEL=info
```

## Architecture

```
src/
├── server/           # Express server setup
├── rpc/             # JSON-RPC handlers
├── api/             # Sleeper API client
├── cache/           # Redis caching layer
├── middleware/      # Express middleware
├── types/           # TypeScript types
└── utils/           # Utility functions
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Linting

```bash
# Run ESLint
npm run lint

# Auto-fix issues
npm run lint:fix

# Format with Prettier
npm run format
```

### Building

```bash
# Build TypeScript
npm run build

# Build Docker image
docker build -t mcp-sleeper-server .
```

## Deployment

### Docker Hub

```bash
docker pull yourusername/mcp-sleeper-server:latest
docker run -p 8080:8080 yourusername/mcp-sleeper-server:latest
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-sleeper-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-sleeper-server
  template:
    metadata:
      labels:
        app: mcp-sleeper-server
    spec:
      containers:
      - name: server
        image: yourusername/mcp-sleeper-server:latest
        ports:
        - containerPort: 8080
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

- 📧 Email: support@example.com
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/mcp-sleeper-server/issues)
- 💬 Discord: [Join our server](https://discord.gg/example)