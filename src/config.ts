import { z } from 'zod';

const configSchema = z.object({
  // Server configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('8080').transform(Number),

  // CORS configuration
  CORS_ORIGIN: z.string().default('*'),

  // Redis configuration
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform(Number),
  REDIS_TTL: z.string().default('300').transform(Number), // 5 minutes default
  REDIS_PASSWORD: z.string().optional(),

  // PostgreSQL configuration for analytics
  DATABASE_URL: z.string().optional(),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.string().default('5432').transform(Number),
  POSTGRES_DB: z.string().default('sleeper_analytics'),
  POSTGRES_USER: z.string().default('sleeper'),
  POSTGRES_PASSWORD: z.string().default('password'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('60000').transform(Number), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: z.string().default('1000').transform(Number),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Sleeper API
  SLEEPER_API_BASE_URL: z.string().default('https://api.sleeper.app/v1'),
  SLEEPER_API_TIMEOUT: z.string().default('30000').transform(Number), // 30 seconds

  // Cache settings
  CACHE_ENABLED: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),
  CACHE_DEFAULT_TTL: z.string().default('300').transform(Number), // 5 minutes

  // Feature flags
  ENABLE_METRICS: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),
  ENABLE_OPENRPC_UI: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),
});

// Parse and validate environment variables
const env = configSchema.parse(process.env);

export const config = {
  ...env,

  // Derived configurations
  IS_PRODUCTION: env.NODE_ENV === 'production',
  IS_DEVELOPMENT: env.NODE_ENV === 'development',
  IS_TEST: env.NODE_ENV === 'test',

  // Cache TTL configurations for different endpoints
  CACHE_TTL: {
    USER: 3600, // 1 hour
    LEAGUE: 300, // 5 minutes
    ROSTER: 300, // 5 minutes
    PLAYER: 86400, // 24 hours
    MATCHUP: 60, // 1 minute during games
    TRANSACTION: 300, // 5 minutes
    DRAFT: 3600, // 1 hour
    NFL_STATE: 60, // 1 minute
    TRENDING: 300, // 5 minutes
  },

  // API endpoint paths
  ENDPOINTS: {
    RPC: '/rpc',
    HEALTH: '/health',
    METRICS: '/metrics',
    OPENRPC: '/openrpc.json',
    DOCS: '/docs',
  },
} as const;

export type Config = typeof config;
