import { Request, Response } from 'express';
import { config } from '../config';
import { redisClient } from '../cache/redis';
import { sleeperAPI } from '../api/client';

export async function healthCheck(req: Request, res: Response): Promise<void> {
  const health: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
  };

  // Check Redis health
  if (config.CACHE_ENABLED && redisClient) {
    try {
      await redisClient.ping();
      health.redis = { status: 'connected' };
    } catch (error) {
      health.redis = { status: 'disconnected', error: error.message };
      health.status = 'degraded';
    }
  }

  // Check Sleeper API health
  try {
    const state = await sleeperAPI.getNFLState();
    health.sleeperAPI = { 
      status: 'connected',
      season: state.season,
      week: state.week,
    };
  } catch (error) {
    health.sleeperAPI = { status: 'disconnected', error: error.message };
    health.status = 'degraded';
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  health.memory = {
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
  };

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
}