import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { recordRequest } from './metrics';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    res.send = originalSend;
    const duration = Date.now() - start;

    // Log response
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
    });

    // Record metrics
    recordRequest(req.method, res.statusCode, duration);

    return res.send(data);
  };

  next();
}
