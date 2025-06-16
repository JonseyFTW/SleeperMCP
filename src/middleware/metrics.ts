import { Request, Response } from 'express';
import { CacheService } from '../cache/service';

// Simple in-memory metrics storage
const metrics = {
  requests: {
    total: 0,
    byMethod: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
  },
  rpc: {
    total: 0,
    byMethod: {} as Record<string, number>,
    errors: 0,
  },
  performance: {
    responseTime: [] as number[],
  },
};

export function recordRequest(method: string, status: number, duration: number): void {
  metrics.requests.total++;
  metrics.requests.byMethod[method] = (metrics.requests.byMethod[method] || 0) + 1;
  metrics.requests.byStatus[status] = (metrics.requests.byStatus[status] || 0) + 1;
  
  // Keep last 1000 response times
  metrics.performance.responseTime.push(duration);
  if (metrics.performance.responseTime.length > 1000) {
    metrics.performance.responseTime.shift();
  }
}

export function recordRPCCall(method: string, success: boolean): void {
  metrics.rpc.total++;
  metrics.rpc.byMethod[method] = (metrics.rpc.byMethod[method] || 0) + 1;
  if (!success) {
    metrics.rpc.errors++;
  }
}

function calculatePercentile(arr: number[], percentile: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * percentile) - 1;
  return sorted[index] || 0;
}

export async function metrics(req: Request, res: Response): Promise<void> {
  const cache = new CacheService();
  const cacheStats = cache.getStats();

  const summary = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    requests: {
      ...metrics.requests,
      rate: metrics.requests.total / process.uptime(),
    },
    rpc: {
      ...metrics.rpc,
      errorRate: metrics.rpc.total > 0 ? metrics.rpc.errors / metrics.rpc.total : 0,
    },
    performance: {
      responseTime: {
        count: metrics.performance.responseTime.length,
        mean: metrics.performance.responseTime.reduce((a, b) => a + b, 0) / metrics.performance.responseTime.length || 0,
        p50: calculatePercentile(metrics.performance.responseTime, 0.5),
        p95: calculatePercentile(metrics.performance.responseTime, 0.95),
        p99: calculatePercentile(metrics.performance.responseTime, 0.99),
      },
    },
    cache: cacheStats,
    memory: {
      rss: process.memoryUsage().rss,
      heapTotal: process.memoryUsage().heapTotal,
      heapUsed: process.memoryUsage().heapUsed,
      external: process.memoryUsage().external,
    },
  };

  // Format as Prometheus metrics if requested
  if (req.headers.accept?.includes('text/plain')) {
    const prometheusMetrics = `
# HELP mcp_sleeper_uptime_seconds Server uptime in seconds
# TYPE mcp_sleeper_uptime_seconds gauge
mcp_sleeper_uptime_seconds ${summary.uptime}

# HELP mcp_sleeper_requests_total Total number of HTTP requests
# TYPE mcp_sleeper_requests_total counter
mcp_sleeper_requests_total ${summary.requests.total}

# HELP mcp_sleeper_rpc_calls_total Total number of RPC calls
# TYPE mcp_sleeper_rpc_calls_total counter
mcp_sleeper_rpc_calls_total ${summary.rpc.total}

# HELP mcp_sleeper_rpc_errors_total Total number of RPC errors
# TYPE mcp_sleeper_rpc_errors_total counter
mcp_sleeper_rpc_errors_total ${summary.rpc.errors}

# HELP mcp_sleeper_response_time_p95 95th percentile response time in ms
# TYPE mcp_sleeper_response_time_p95 gauge
mcp_sleeper_response_time_p95 ${summary.performance.responseTime.p95}

# HELP mcp_sleeper_memory_usage_bytes Memory usage in bytes
# TYPE mcp_sleeper_memory_usage_bytes gauge
mcp_sleeper_memory_usage_bytes{type="rss"} ${summary.memory.rss}
mcp_sleeper_memory_usage_bytes{type="heap_total"} ${summary.memory.heapTotal}
mcp_sleeper_memory_usage_bytes{type="heap_used"} ${summary.memory.heapUsed}
`;
    res.type('text/plain').send(prometheusMetrics);
  } else {
    res.json(summary);
  }
}

export { recordRequest, recordRPCCall };