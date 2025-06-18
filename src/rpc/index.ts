import { userMethods } from './methods/user';
import { leagueMethods } from './methods/league';
import { playerMethods } from './methods/player';
import { draftMethods } from './methods/draft';
import { stateMethods } from './methods/state';
import { batchRPC, batchLeagueData, batchUserData, analyzeBatchOpportunities } from './methods/batch';
import { analyticsMethods } from './methods/analytics';
import { logger } from '../utils/logger';
import { JsonRpcError } from '../utils/errors';
import { recordRPCCall } from '../middleware/metrics';

export function createRPCMethods() {
  const methods = {
    ...userMethods,
    ...leagueMethods,
    ...playerMethods,
    ...draftMethods,
    ...stateMethods,
    // Batch processing methods
    'sleeper.batchRPC': batchRPC,
    'sleeper.batchLeagueData': batchLeagueData,
    'sleeper.batchUserData': batchUserData,
    'sleeper.analyzeBatchOpportunities': analyzeBatchOpportunities,
    // Analytics methods
    ...analyticsMethods,
  };

  // Wrap all methods with error handling
  const wrappedMethods: Record<string, any> = {};

  for (const [name, method] of Object.entries(methods)) {
    wrappedMethods[name] = async function (params: any, context: any) {
      const startTime = Date.now();
      const requestId = context?.req?.body?.id || 'unknown';

      logger.info(`RPC method called: ${name}`, {
        method: name,
        requestId,
        params,
      });

      try {
        const result = await method(params, context);

        const duration = Date.now() - startTime;
        logger.info(`RPC method completed: ${name}`, {
          method: name,
          requestId,
          duration,
        });

        // Record successful RPC call
        recordRPCCall(name, true);

        return result;
      } catch (error: any) {
        const duration = Date.now() - startTime;

        logger.error(`RPC method failed: ${name}`, {
          method: name,
          requestId,
          duration,
          error: error.message,
          stack: error.stack,
        });

        // Record failed RPC call
        recordRPCCall(name, false);

        // If it's already a JsonRpcError, re-throw it
        if (error instanceof JsonRpcError) {
          throw error;
        }

        // Convert API errors to JSON-RPC errors
        if (error.response?.status === 404) {
          throw new JsonRpcError(-32602, 'Resource not found', { originalError: error.message });
        } else if (error.response?.status === 429) {
          throw new JsonRpcError(-32003, 'Rate limit exceeded', {
            retryAfter: error.response.headers['retry-after'],
          });
        } else if (error.response?.status >= 400 && error.response?.status < 500) {
          throw new JsonRpcError(-32602, 'Invalid parameters', { originalError: error.message });
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          throw new JsonRpcError(-32002, 'Service unavailable', { originalError: error.message });
        } else {
          throw new JsonRpcError(-32603, 'Internal error', { originalError: error.message });
        }
      }
    };
  }

  return wrappedMethods;
}
