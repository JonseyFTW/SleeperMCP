import { sleeperAPI } from '../../api/client';
import { ParallelRPCProcessor } from '../parallel-processor';
import { logger } from '../../utils/logger';

interface RPCResponse {
  jsonrpc: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number;
}

// Create parallel processor instance
const parallelProcessor = new ParallelRPCProcessor();

// Register all available methods
parallelProcessor.registerMethod('sleeper.getUserByUsername', async (params: any[], __context: any) => {
  return sleeperAPI.getUserByUsername(params[0]);
});

parallelProcessor.registerMethod('sleeper.getUserById', async (params: any[], _context: any) => {
  return sleeperAPI.getUserById(params[0]);
});

parallelProcessor.registerMethod('sleeper.getLeaguesForUser', async (params: any[], _context: any) => {
  return sleeperAPI.getLeaguesForUser(params[0], params[1] || 'nfl', params[2]);
});

parallelProcessor.registerMethod('sleeper.getLeague', async (params: any[], _context: any) => {
  return sleeperAPI.getLeague(params[0]);
});

parallelProcessor.registerMethod('sleeper.getRosters', async (params: any[], _context: any) => {
  return sleeperAPI.getRosters(params[0]);
});

parallelProcessor.registerMethod('sleeper.getUsers', async (params: any[], _context: any) => {
  return sleeperAPI.getUsers(params[0]);
});

parallelProcessor.registerMethod('sleeper.getMatchups', async (params: any[], _context: any) => {
  return sleeperAPI.getMatchups(params[0], params[1]);
});

parallelProcessor.registerMethod('sleeper.getWinnersBracket', async (params: any[], _context: any) => {
  return sleeperAPI.getWinnersBracket(params[0]);
});

parallelProcessor.registerMethod('sleeper.getLosersBracket', async (params: any[], _context: any) => {
  return sleeperAPI.getLosersBracket(params[0]);
});

parallelProcessor.registerMethod('sleeper.getTransactions', async (params: any[], _context: any) => {
  return sleeperAPI.getTransactions(params[0], params[1]);
});

parallelProcessor.registerMethod('sleeper.getTradedPicks', async (params: any[], _context: any) => {
  return sleeperAPI.getTradedPicks(params[0]);
});

parallelProcessor.registerMethod('sleeper.getAllPlayers', async (params: any[], _context: any) => {
  return sleeperAPI.getAllPlayers(params[0] || 'nfl');
});

parallelProcessor.registerMethod('sleeper.getTrendingPlayers', async (params: any[], _context: any) => {
  return sleeperAPI.getTrendingPlayers(params[0] || 'nfl', params[1] || 'add', params[2], params[3]);
});

parallelProcessor.registerMethod('sleeper.getDraftsForUser', async (params: any[], _context: any) => {
  return sleeperAPI.getDraftsForUser(params[0], params[1] || 'nfl', params[2]);
});

parallelProcessor.registerMethod('sleeper.getDraftsForLeague', async (params: any[], _context: any) => {
  return sleeperAPI.getDraftsForLeague(params[0]);
});

parallelProcessor.registerMethod('sleeper.getDraft', async (params: any[], _context: any) => {
  return sleeperAPI.getDraft(params[0]);
});

parallelProcessor.registerMethod('sleeper.getDraftPicks', async (params: any[], _context: any) => {
  return sleeperAPI.getDraftPicks(params[0]);
});

parallelProcessor.registerMethod('sleeper.getTradedDraftPicks', async (params: any[], _context: any) => {
  return sleeperAPI.getTradedDraftPicks(params[0]);
});

parallelProcessor.registerMethod('sleeper.getNFLState', async (_params: any[], _context: any) => {
  return sleeperAPI.getNFLState();
});

/**
 * Batch processing for multiple independent RPC requests
 */
export async function batchRPC(requests: any[], _context: any): Promise<RPCResponse[]> {
  logger.info(`Processing batch RPC with ${requests.length} requests`);

  if (!Array.isArray(requests)) {
    throw new Error('Batch requests must be an array');
  }

  // Convert to batch request format
  const batchRequests = requests.map((req, index) => ({
    request: {
      jsonrpc: req.jsonrpc || '2.0',
      method: req.method,
      params: req.params || [],
      id: req.id || index
    },
    context: _context,
    priority: req.priority || 'medium',
    dependencies: req.dependencies || []
  }));

  // Process in parallel
  const results = await parallelProcessor.processBatch(batchRequests);
  
  logger.info(`Batch RPC completed: ${results.length} responses`);
  return results;
}

/**
 * Optimized batch processing for league data
 */
export async function batchLeagueData(params: any[], _context: any) {
  const { leagueId, requests } = params[0] || {};
  
  if (!leagueId || !Array.isArray(requests)) {
    throw new Error('leagueId and requests array are required');
  }

  logger.info(`Batching ${requests.length} requests for league ${leagueId}`);

  const results = await sleeperAPI.batchLeagueRequests(leagueId, requests);
  
  logger.info(`League batch completed for ${leagueId}`);
  return results;
}

/**
 * Optimized batch processing for user data
 */
export async function batchUserData(params: any[], _context: any) {
  const { userId, sport = 'nfl', season, requests } = params[0] || {};
  
  if (!userId || !season || !Array.isArray(requests)) {
    throw new Error('userId, season, and requests array are required');
  }

  logger.info(`Batching ${requests.length} requests for user ${userId}`);

  const results = await sleeperAPI.batchUserRequests(userId, sport, season, requests);
  
  logger.info(`User batch completed for ${userId}`);
  return results;
}

/**
 * Analyze batch opportunities for given requests
 */
export async function analyzeBatchOpportunities(params: any[], _context: any) {
  const requests = params[0];
  
  if (!Array.isArray(requests)) {
    throw new Error('Requests array is required');
  }

  const analysis = parallelProcessor.analyzeBatchingOpportunities(requests);
  
  return {
    ...analysis,
    processorStats: parallelProcessor.getStats(),
    batchAPIStats: sleeperAPI.getBatchStats()
  };
}