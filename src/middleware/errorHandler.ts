import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { JsonRpcError } from '../utils/errors';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('Express error handler:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
  });

  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof JsonRpcError) {
    res.status(200).json({
      jsonrpc: '2.0',
      error: err.toJSON(),
      id: req.body?.id || null,
    });
  } else {
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal server error',
        data: process.env.NODE_ENV === 'development' ? err.message : undefined,
      },
      id: req.body?.id || null,
    });
  }
}