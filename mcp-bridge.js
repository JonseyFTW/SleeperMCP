#!/usr/bin/env node

/**
 * Local MCP Bridge for Claude Desktop
 * 
 * This script creates a local MCP server that bridges to your Railway deployment.
 * Run this locally and configure Claude Desktop to connect to it.
 * 
 * Usage:
 * 1. Install dependencies: npm install axios
 * 2. Run: node mcp-bridge.js
 * 3. Configure Claude Desktop to use this as a local MCP server
 */

const http = require('http');
const https = require('https');
const axios = require('axios');

// Configuration
const RAILWAY_SERVER_URL = 'https://sleepermcp-production.up.railway.app';
const MCP_PORT = 3001;

// MCP Tools Configuration
const MCP_TOOLS = [
  {
    name: "get_player",
    description: "Get detailed information about an NFL player",
    inputSchema: {
      type: "object",
      properties: {
        player_id: {
          type: "string",
          description: "The Sleeper player ID"
        }
      },
      required: ["player_id"]
    }
  },
  {
    name: "search_players", 
    description: "Search for NFL players by name",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Player name to search for"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_player_analytics",
    description: "Get comprehensive analytics for a player including trends, projections, and insights",
    inputSchema: {
      type: "object",
      properties: {
        player_id: {
          type: "string", 
          description: "The Sleeper player ID"
        }
      },
      required: ["player_id"]
    }
  },
  {
    name: "compare_players",
    description: "Compare two players head-to-head with detailed analytics",
    inputSchema: {
      type: "object",
      properties: {
        player_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of 2 player IDs to compare"
        }
      },
      required: ["player_ids"]
    }
  },
  {
    name: "get_trending_players",
    description: "Get currently trending players for waiver wire pickups",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["add", "drop"],
          description: "Type of trending players"
        }
      }
    }
  },
  {
    name: "get_league_info",
    description: "Get information about a fantasy league",
    inputSchema: {
      type: "object", 
      properties: {
        league_id: {
          type: "string",
          description: "The Sleeper league ID"
        }
      },
      required: ["league_id"]
    }
  },
  {
    name: "get_nfl_state",
    description: "Get current NFL season and week information",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  }
];

// HTTP Client for Railway requests
const httpClient = axios.create({
  baseURL: RAILWAY_SERVER_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Map MCP tool calls to JSON-RPC methods
const TOOL_TO_RPC_METHOD = {
  'get_player': 'sleeper.getPlayer',
  'search_players': 'sleeper.searchPlayers', 
  'get_player_analytics': 'sleeper.getPlayerAnalytics',
  'compare_players': 'sleeper.comparePlayersHQ',
  'get_trending_players': 'sleeper.getTrendingPlayers',
  'get_league_info': 'sleeper.getLeague',
  'get_league_rosters': 'sleeper.getLeagueRosters',
  'get_nfl_state': 'sleeper.getNFLState'
};

async function callRailwayAPI(method, params) {
  try {
    const response = await httpClient.post('/rpc', {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: Date.now()
    });
    
    if (response.data.error) {
      throw new Error(response.data.error.message);
    }
    
    return response.data.result;
  } catch (error) {
    console.error('Railway API call failed:', error.message);
    throw error;
  }
}

async function handleMCPRequest(req, res) {
  try {
    const mcpRequest = req.body;
    
    console.log(`MCP Request: ${mcpRequest.method}`, {
      id: mcpRequest.id,
      params: mcpRequest.params
    });

    let response;

    switch (mcpRequest.method) {
      case 'initialize':
        response = {
          jsonrpc: '2.0',
          id: mcpRequest.id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: {
              name: 'sleeper-mcp-bridge',
              version: '1.0.0'
            },
            capabilities: {
              tools: {
                listChanged: false
              }
            }
          }
        };
        break;
        
      case 'tools/list':
        response = {
          jsonrpc: '2.0',
          id: mcpRequest.id,
          result: {
            tools: MCP_TOOLS
          }
        };
        break;
        
      case 'tools/call':
        const { name, arguments: args } = mcpRequest.params;
        const rpcMethod = TOOL_TO_RPC_METHOD[name];
        
        if (!rpcMethod) {
          throw new Error(`Unknown tool: ${name}`);
        }
        
        // Convert MCP arguments to RPC parameters
        let rpcParams;
        switch (name) {
          case 'get_player':
          case 'get_player_analytics':
            rpcParams = [args.player_id];
            break;
          case 'search_players':
            rpcParams = [args.query];
            break;
          case 'compare_players':
            rpcParams = args.player_ids;
            break;
          case 'get_trending_players':
            rpcParams = [args.type || 'add'];
            break;
          case 'get_league_info':
          case 'get_league_rosters':
            rpcParams = [args.league_id];
            break;
          case 'get_nfl_state':
            rpcParams = [];
            break;
          default:
            rpcParams = [args];
        }
        
        const result = await callRailwayAPI(rpcMethod, rpcParams);
        
        response = {
          jsonrpc: '2.0',
          id: mcpRequest.id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        };
        break;
        
      default:
        response = {
          jsonrpc: '2.0',
          id: mcpRequest.id,
          error: {
            code: -32601,
            message: `Method '${mcpRequest.method}' not found`
          }
        };
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    
  } catch (error) {
    console.error('MCP request error:', error);
    const errorResponse = {
      jsonrpc: '2.0',
      id: req.body?.id,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error.message
      }
    };
    
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(errorResponse));
  }
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.method !== 'POST') {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    try {
      req.body = JSON.parse(body);
      handleMCPRequest(req, res);
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: 'Parse error'
        }
      }));
    }
  });
});

// Start server
server.listen(MCP_PORT, () => {
  console.log(`🔗 MCP Bridge running on http://localhost:${MCP_PORT}`);
  console.log(`📡 Proxying to: ${RAILWAY_SERVER_URL}`);
  console.log(`🤖 Ready for Claude Desktop integration!`);
  console.log(`\nClaude Desktop config:`);
  console.log(`{`);
  console.log(`  "mcpServers": {`);
  console.log(`    "sleeper": {`);
  console.log(`      "command": "node",`);
  console.log(`      "args": ["${__filename}"]`);
  console.log(`    }`);
  console.log(`  }`);
  console.log(`}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down MCP Bridge...');
  server.close(() => {
    process.exit(0);
  });
});