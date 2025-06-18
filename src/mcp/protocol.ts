import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { createRPCMethods } from '../rpc/index';

// MCP Protocol Implementation
export interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPInitializeParams {
  protocolVersion: string;
  capabilities: {
    tools?: {};
    resources?: {};
    prompts?: {};
    logging?: {};
  };
  clientInfo: {
    name: string;
    version: string;
  };
}

export interface MCPInitializeResult {
  protocolVersion: string;
  serverInfo: {
    name: string;
    version: string;
  };
  capabilities: {
    tools?: {
      listChanged?: boolean;
    };
    resources?: {
      subscribe?: boolean;
      listChanged?: boolean;
    };
    prompts?: {
      listChanged?: boolean;
    };
    logging?: {};
  };
}

// Available MCP tools (converted from our RPC methods)
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
    name: "get_league_rosters",
    description: "Get all rosters in a fantasy league",
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

export class MCPProtocolHandler {
  private rpcMethods: Record<string, any>;

  constructor() {
    this.rpcMethods = createRPCMethods();
  }

  async handleMCPRequest(req: Request, res: Response): Promise<void> {
    try {
      const mcpRequest: MCPRequest = req.body;
      
      logger.info(`MCP request: ${mcpRequest.method}`, {
        id: mcpRequest.id,
        method: mcpRequest.method,
        params: mcpRequest.params
      });

      let response: MCPResponse;

      switch (mcpRequest.method) {
        case 'initialize':
          response = await this.handleInitialize(mcpRequest);
          break;
        
        case 'tools/list':
          response = this.handleToolsList(mcpRequest);
          break;
          
        case 'tools/call':
          response = await this.handleToolCall(mcpRequest);
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

      res.json(response);
    } catch (error) {
      logger.error('MCP request error:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        id: req.body?.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: (error as Error).message
        }
      });
    }
  }

  private async handleInitialize(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params as MCPInitializeParams;
    
    const result: MCPInitializeResult = {
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: 'sleeper-mcp-server',
        version: '1.0.0'
      },
      capabilities: {
        tools: {
          listChanged: false
        },
        resources: {
          subscribe: false,
          listChanged: false  
        },
        prompts: {
          listChanged: false
        },
        logging: {}
      }
    };

    logger.info('MCP initialized', {
      clientName: params.clientInfo?.name,
      clientVersion: params.clientInfo?.version
    });

    return {
      jsonrpc: '2.0',
      id: request.id,
      result
    };
  }

  private handleToolsList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0', 
      id: request.id,
      result: {
        tools: MCP_TOOLS
      }
    };
  }

  private async handleToolCall(request: MCPRequest): Promise<MCPResponse> {
    const { name, arguments: args } = request.params;
    
    try {
      let result: any;
      
      // Map MCP tool calls to RPC methods
      switch (name) {
        case 'get_player':
          result = await this.rpcMethods['sleeper.getPlayer']([args.player_id], {});
          break;
          
        case 'search_players':
          result = await this.rpcMethods['sleeper.searchPlayers']([args.query], {});
          break;
          
        case 'get_player_analytics':
          result = await this.rpcMethods['sleeper.getPlayerAnalytics']([args.player_id], {});
          break;
          
        case 'compare_players':
          result = await this.rpcMethods['sleeper.comparePlayersHQ'](args.player_ids, {});
          break;
          
        case 'get_trending_players':
          result = await this.rpcMethods['sleeper.getTrendingPlayers']([args.type || 'add'], {});
          break;
          
        case 'get_league_info':
          result = await this.rpcMethods['sleeper.getLeague']([args.league_id], {});
          break;
          
        case 'get_league_rosters':
          result = await this.rpcMethods['sleeper.getLeagueRosters']([args.league_id], {});
          break;
          
        case 'get_nfl_state':
          result = await this.rpcMethods['sleeper.getNFLState']([], {});
          break;
          
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        }
      };
    } catch (error) {
      return {
        jsonrpc: '2.0', 
        id: request.id,
        error: {
          code: -32602,
          message: `Tool execution failed: ${(error as Error).message}`
        }
      };
    }
  }
}