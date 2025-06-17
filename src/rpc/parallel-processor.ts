import { logger } from '../utils/logger';

interface RPCRequest {
  jsonrpc: string;
  method: string;
  params: any;
  id: string | number;
}

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

interface BatchRPCRequest {
  request: RPCRequest;
  context: any;
  priority: 'high' | 'medium' | 'low';
  dependencies?: string[]; // Method names this request depends on
}

export class ParallelRPCProcessor {
  private methodExecutors: Map<string, Function> = new Map();
  private readonly maxConcurrency = 10;

  /**
   * Register a method executor
   */
  registerMethod(method: string, executor: Function): void {
    this.methodExecutors.set(method, executor);
  }

  /**
   * Process multiple RPC requests in parallel
   */
  async processBatch(requests: BatchRPCRequest[]): Promise<RPCResponse[]> {
    if (requests.length === 0) return [];
    if (requests.length === 1) {
      const result = await this.processRequest(requests[0]);
      return [result];
    }

    logger.debug(`Processing batch of ${requests.length} RPC requests`);

    // Analyze dependencies and create execution plan
    const executionPlan = this.createExecutionPlan(requests);

    // Execute in phases based on dependencies
    const results: RPCResponse[] = [];
    const resultMap = new Map<string | number, any>();

    for (const phase of executionPlan) {
      const phasePromises = phase.map(async (batchRequest) => {
        try {
          // Inject dependency results into request context if needed
          const enhancedContext = this.enhanceContextWithDependencies(
            batchRequest.context,
            batchRequest.dependencies || [],
            resultMap
          );

          const response = await this.processRequest({
            ...batchRequest,
            context: enhancedContext
          });

          // Store result for dependent requests
          if (response.result !== undefined) {
            resultMap.set(batchRequest.request.id, response.result);
          }

          return response;
        } catch (error) {
          logger.error(`RPC request failed:`, error);
          return this.createErrorResponse(
            batchRequest.request.id,
            -32603,
            'Internal error',
            (error as Error).message
          );
        }
      });

      // Execute phase in parallel with concurrency limit
      const phaseResults = await this.executeWithConcurrencyLimit(phasePromises, this.maxConcurrency);
      results.push(...phaseResults);
    }

    logger.debug(`Batch processing completed: ${results.length} responses`);
    return results;
  }

  /**
   * Create execution plan based on dependencies
   */
  private createExecutionPlan(requests: BatchRPCRequest[]): BatchRPCRequest[][] {
    const phases: BatchRPCRequest[][] = [];
    const processedMethods = new Set<string>();
    const remaining = [...requests];

    while (remaining.length > 0) {
      const currentPhase: BatchRPCRequest[] = [];
      
      // Find requests with no unmet dependencies
      for (let i = remaining.length - 1; i >= 0; i--) {
        const request = remaining[i];
        const dependencies = request.dependencies || [];
        
        const unmetDependencies = dependencies.filter(dep => !processedMethods.has(dep));
        
        if (unmetDependencies.length === 0) {
          currentPhase.push(request);
          processedMethods.add(request.request.method);
          remaining.splice(i, 1);
        }
      }

      if (currentPhase.length === 0 && remaining.length > 0) {
        // Circular dependency or invalid dependency - add remaining requests to current phase
        logger.warn('Circular dependency detected, processing remaining requests without dependency ordering');
        currentPhase.push(...remaining);
        remaining.splice(0);
      }

      if (currentPhase.length > 0) {
        // Sort by priority within the phase
        currentPhase.sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
        
        phases.push(currentPhase);
      }
    }

    logger.debug(`Created execution plan with ${phases.length} phases`);
    return phases;
  }

  /**
   * Enhance request context with dependency results
   */
  private enhanceContextWithDependencies(
    context: any,
    dependencies: string[],
    resultMap: Map<string | number, any>
  ): any {
    if (dependencies.length === 0) return context;

    const dependencyResults: Record<string, any> = {};
    dependencies.forEach(dep => {
      // Find result by method name (simplified - in practice might need more sophisticated matching)
      for (const [, result] of resultMap.entries()) {
        dependencyResults[dep] = result;
        break; // Take first match
      }
    });

    return {
      ...context,
      dependencyResults
    };
  }

  /**
   * Process a single RPC request
   */
  private async processRequest(batchRequest: BatchRPCRequest): Promise<RPCResponse> {
    const { request, context } = batchRequest;
    const { method, params, id } = request;

    const executor = this.methodExecutors.get(method);
    if (!executor) {
      return this.createErrorResponse(id, -32601, 'Method not found', `Method ${method} not found`);
    }

    try {
      const result = await executor(params, context);
      return {
        jsonrpc: '2.0',
        result,
        id
      };
    } catch (error) {
      logger.error(`RPC method ${method} failed:`, error);
      return this.createErrorResponse(
        id,
        -32603,
        'Internal error',
        (error as Error).message
      );
    }
  }

  /**
   * Execute promises with concurrency limit
   */
  private async executeWithConcurrencyLimit<T>(
    promises: Promise<T>[],
    limit: number
  ): Promise<T[]> {
    if (promises.length <= limit) {
      return Promise.all(promises);
    }

    const results: T[] = [];
    for (let i = 0; i < promises.length; i += limit) {
      const batch = promises.slice(i, i + limit);
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Create error response
   */
  private createErrorResponse(id: string | number, code: number, message: string, data?: any): RPCResponse {
    return {
      jsonrpc: '2.0',
      error: {
        code,
        message,
        ...(data && { data })
      },
      id
    };
  }

  /**
   * Analyze requests to identify potential batching opportunities
   */
  analyzeBatchingOpportunities(requests: RPCRequest[]): {
    batchableGroups: string[][];
    independentRequests: string[];
    recommendations: string[];
  } {
    const batchableGroups: string[][] = [];
    const independentRequests: string[] = [];
    const recommendations: string[] = [];

    // Group by method patterns
    const methodGroups = new Map<string, string[]>();
    
    requests.forEach((req, index) => {
      const method = req.method;
      const methodType = method.split('.')[1]; // e.g., 'getLeague' from 'sleeper.getLeague'
      
      if (methodType && this.isBatchableMethod(methodType)) {
        const groupKey = this.getBatchGroupKey(methodType, req.params);
        if (!methodGroups.has(groupKey)) {
          methodGroups.set(groupKey, []);
        }
        methodGroups.get(groupKey)!.push(`${index}`);
      } else {
        independentRequests.push(`${index}`);
      }
    });

    // Convert groups to arrays
    methodGroups.forEach(group => {
      if (group.length > 1) {
        batchableGroups.push(group);
        recommendations.push(`Requests ${group.join(', ')} can be batched together`);
      } else {
        independentRequests.push(...group);
      }
    });

    if (batchableGroups.length > 0) {
      recommendations.push(`${batchableGroups.length} batching opportunities identified`);
    }

    return {
      batchableGroups,
      independentRequests,
      recommendations
    };
  }

  /**
   * Check if method can be batched
   */
  private isBatchableMethod(method: string): boolean {
    const batchableMethods = [
      'getLeague', 'getRosters', 'getUsers', 'getMatchups',
      'getTransactions', 'getTradedPicks', 'getWinnersBracket', 
      'getLosersBracket', 'getDraftsForLeague'
    ];
    
    return batchableMethods.includes(method);
  }

  /**
   * Get batch group key for requests
   */
  private getBatchGroupKey(method: string, params: any): string {
    // Group by first parameter (usually league/user/draft ID)
    const firstParam = params && params[0] ? params[0] : 'global';
    return `${method}:${firstParam}`;
  }

  /**
   * Get processor statistics
   */
  getStats() {
    return {
      registeredMethods: this.methodExecutors.size,
      maxConcurrency: this.maxConcurrency,
      availableMethods: Array.from(this.methodExecutors.keys())
    };
  }
}