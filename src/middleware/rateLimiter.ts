import rateLimit from 'express-rate-limit';
import { config } from '../config';

export const rateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    jsonrpc: '2.0',
    error: {
      code: -32003,
      message: 'Rate limit exceeded. Please try again later.',
      data: {
        limit: config.RATE_LIMIT_MAX_REQUESTS,
        windowMs: config.RATE_LIMIT_WINDOW_MS,
      },
    },
    id: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      jsonrpc: '2.0',
      error: {
        code: -32003,
        message: 'Rate limit exceeded. Please try again later.',
        data: {
          limit: config.RATE_LIMIT_MAX_REQUESTS,
          windowMs: config.RATE_LIMIT_WINDOW_MS,
          retryAfter: res.getHeader('Retry-After'),
        },
      },
      id: req.body?.id || null,
    });
  },
});