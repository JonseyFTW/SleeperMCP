import { logger } from '../utils/logger';

interface BatchRequest {
  id: string;
  method: string;
  params: any[];
  resolve: (value: any) => void;
  reject: (error: any) => void;
  cacheKey?: string;
  priority: 'high' | 'medium' | 'low';
}

export class BatchProcessor {
  private pendingRequests: Map<string, BatchRequest[]> = new Map();
  private processingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly batchDelay = 50; // ms to wait for batching
  private readonly maxBatchSize = 10;

  /**
   * Add a request to the batch queue
   */
  addRequest<T>(
    batchKey: string,
    id: string,
    method: string,
    params: any[],
    priority: 'high' | 'medium' | 'low' = 'medium',
    cacheKey?: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const request: BatchRequest = {
        id,
        method,
        params,
        resolve,
        reject,
        cacheKey,
        priority,
      };

      // Add to pending requests
      if (!this.pendingRequests.has(batchKey)) {
        this.pendingRequests.set(batchKey, []);
      }
      this.pendingRequests.get(batchKey)!.push(request);

      // Schedule batch processing
      this.scheduleBatchProcessing(batchKey);
    });
  }

  /**
   * Schedule batch processing with debouncing
   */
  private scheduleBatchProcessing(batchKey: string): void {
    // Clear existing timeout
    if (this.processingTimeouts.has(batchKey)) {
      clearTimeout(this.processingTimeouts.get(batchKey));
    }

    const timeout = setTimeout(() => {
      void this.processBatch(batchKey);
    }, this.batchDelay);

    this.processingTimeouts.set(batchKey, timeout);

    // Process immediately if batch is full
    const requests = this.pendingRequests.get(batchKey) || [];
    if (requests.length >= this.maxBatchSize) {
      clearTimeout(timeout);
      this.processingTimeouts.delete(batchKey);
      void this.processBatch(batchKey);
    }
  }

  /**
   * Process a batch of requests
   */
  private async processBatch(batchKey: string): Promise<void> {
    const requests = this.pendingRequests.get(batchKey) || [];
    if (requests.length === 0) {
      return;
    }

    // Clear the batch
    this.pendingRequests.set(batchKey, []);
    this.processingTimeouts.delete(batchKey);

    // Sort by priority
    const sortedRequests = requests.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    logger.debug(`Processing batch ${batchKey} with ${sortedRequests.length} requests`);

    // Group related requests that can be truly batched
    const batchGroups = this.groupBatchableRequests(sortedRequests);

    // Process each group
    for (const group of batchGroups) {
      try {
        await this.processRequestGroup(group);
      } catch (error) {
        logger.error(`Batch processing error for group:`, error);
        // Reject all requests in the failed group
        group.forEach((req) => req.reject(error));
      }
    }
  }

  /**
   * Group requests that can be batched together
   */
  private groupBatchableRequests(requests: BatchRequest[]): BatchRequest[][] {
    const groups: BatchRequest[][] = [];
    const batchableGroups: Map<string, BatchRequest[]> = new Map();

    for (const request of requests) {
      const groupKey = this.getBatchGroupKey(request);

      if (groupKey) {
        if (!batchableGroups.has(groupKey)) {
          batchableGroups.set(groupKey, []);
        }
        batchableGroups.get(groupKey)!.push(request);
      } else {
        // Individual request
        groups.push([request]);
      }
    }

    // Add batchable groups
    batchableGroups.forEach((group) => groups.push(group));

    return groups;
  }

  /**
   * Determine if requests can be batched together
   */
  private getBatchGroupKey(request: BatchRequest): string | null {
    const { method, params } = request;

    // League-related requests can be batched by league
    if (method.includes('league') && params.length > 0) {
      const leagueId = params[0];
      return `league:${leagueId}`;
    }

    // User-related requests can be batched by user
    if (method.includes('user') && params.length > 0) {
      const userId = params[0];
      return `user:${userId}`;
    }

    // Draft-related requests can be batched by draft
    if (method.includes('draft') && params.length > 0) {
      const draftId = params[0];
      return `draft:${draftId}`;
    }

    // Trending/state requests can be batched together
    if (method.includes('trending') || method.includes('state') || method.includes('players')) {
      return 'global';
    }

    return null; // Cannot be batched
  }

  /**
   * Process a group of related requests in parallel
   */
  private async processRequestGroup(group: BatchRequest[]): Promise<void> {
    if (group.length === 1) {
      // Single request
      const request = group[0];
      try {
        const result = await this.executeRequest(request);
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
      return;
    }

    // Multiple related requests - execute in parallel
    const promises = group.map(async (request) => {
      try {
        const result = await this.executeRequest(request);
        request.resolve(result);
        return { success: true, id: request.id };
      } catch (error) {
        request.reject(error);
        return { success: false, id: request.id, error };
      }
    });

    const results = await Promise.allSettled(promises);

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - successful;

    logger.debug(`Batch group completed: ${successful} successful, ${failed} failed`);
  }

  /**
   * Execute individual request (to be implemented by client)
   */
  private executeRequest(_request: BatchRequest): Promise<any> {
    throw new Error('executeRequest must be implemented by the API client');
  }

  /**
   * Set the request executor
   */
  setRequestExecutor(executor: (request: BatchRequest) => Promise<any>): void {
    this.executeRequest = executor;
  }

  /**
   * Get batch statistics
   */
  getStats() {
    const totalPending = Array.from(this.pendingRequests.values()).reduce(
      (sum, requests) => sum + requests.length,
      0
    );

    return {
      pendingBatches: this.pendingRequests.size,
      totalPendingRequests: totalPending,
      activeBatchKeys: Array.from(this.pendingRequests.keys()),
    };
  }

  /**
   * Clear all pending requests (for cleanup)
   */
  clearPending(): void {
    // Reject all pending requests
    this.pendingRequests.forEach((requests) => {
      requests.forEach((req) => req.reject(new Error('Batch processor shutting down')));
    });

    // Clear timeouts
    this.processingTimeouts.forEach((timeout) => clearTimeout(timeout));

    // Clear maps
    this.pendingRequests.clear();
    this.processingTimeouts.clear();
  }
}
