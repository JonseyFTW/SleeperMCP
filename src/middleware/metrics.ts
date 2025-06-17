import { Request, Response } from 'express';
import { enhancedCacheService } from '../cache/enhanced-service';

// Simple in-memory metrics storage
const metricsData = {
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
  metricsData.requests.total++;
  metricsData.requests.byMethod[method] = (metricsData.requests.byMethod[method] || 0) + 1;
  metricsData.requests.byStatus[status] = (metricsData.requests.byStatus[status] || 0) + 1;

  // Keep last 1000 response times
  metricsData.performance.responseTime.push(duration);
  if (metricsData.performance.responseTime.length > 1000) {
    metricsData.performance.responseTime.shift();
  }
}

export function recordRPCCall(method: string, success: boolean): void {
  metricsData.rpc.total++;
  metricsData.rpc.byMethod[method] = (metricsData.rpc.byMethod[method] || 0) + 1;
  if (!success) {
    metricsData.rpc.errors++;
  }
}

function calculatePercentile(arr: number[], percentile: number): number {
  if (arr.length === 0) {
    return 0;
  }
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * percentile) - 1;
  return sorted[index] || 0;
}

export async function metrics(req: Request, res: Response): Promise<void> {
  let cacheStats;

  try {
    cacheStats = await enhancedCacheService.getStats();
  } catch (error) {
    // If cache stats fail, provide fallback data
    cacheStats = {
      useRedis: false,
      memory: {
        keys: 0,
        hits: 0,
        misses: 0,
        ksize: 0,
        vsize: 0,
      },
      error: 'Failed to retrieve cache statistics',
    };
  }

  const summary = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    requests: {
      ...metricsData.requests,
      rate: metricsData.requests.total / process.uptime(),
    },
    rpc: {
      ...metricsData.rpc,
      errorRate: metricsData.rpc.total > 0 ? metricsData.rpc.errors / metricsData.rpc.total : 0,
    },
    performance: {
      responseTime: {
        count: metricsData.performance.responseTime.length,
        mean:
          metricsData.performance.responseTime.reduce((a: number, b: number) => a + b, 0) /
            metricsData.performance.responseTime.length || 0,
        p50: calculatePercentile(metricsData.performance.responseTime, 0.5),
        p95: calculatePercentile(metricsData.performance.responseTime, 0.95),
        p99: calculatePercentile(metricsData.performance.responseTime, 0.99),
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
