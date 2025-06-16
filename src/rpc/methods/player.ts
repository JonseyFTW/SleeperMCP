import { z } from 'zod';
import { sleeperAPI } from '../../api/client';
import { validateParams } from '../../utils/validation';

// Validation schemas
const getAllPlayersSchema = z.object({
  sport: z.string().default('nfl').describe('Sport type (default: nfl)'),
});

const getTrendingPlayersSchema = z.object({
  sport: z.string().default('nfl').describe('Sport type (default: nfl)'),
  type: z.enum(['add', 'drop']).default('add').describe('Trending type: add or drop'),
  lookback: z.number().int().min(1).max(48).optional().describe('Lookback hours (1-48)'),
  limit: z.number().int().min(1).max(200).optional().describe('Result limit (1-200)'),
});

// Player methods
export const playerMethods = {
  'sleeper.getAllPlayers': async (params: unknown) => {
    const validated = validateParams(params, getAllPlayersSchema);
    return sleeperAPI.getAllPlayers(validated.sport);
  },

  'sleeper.getTrendingPlayers': async (params: unknown) => {
    const validated = validateParams(params, getTrendingPlayersSchema);
    return sleeperAPI.getTrendingPlayers(
      validated.sport,
      validated.type,
      validated.lookback,
      validated.limit
    );
  },
};