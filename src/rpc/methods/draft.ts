import { z } from 'zod';
import { sleeperAPI } from '../../api/client';
import { validateParams } from '../../utils/validation';

// Validation schemas
const getDraftsForUserSchema = z.object({
  userId: z.string().min(1).describe('Sleeper user ID'),
  sport: z.string().default('nfl').describe('Sport type (default: nfl)'),
  season: z
    .string()
    .regex(/^\d{4}$/)
    .describe('Season year (e.g., 2024)'),
});

const getDraftsForLeagueSchema = z.object({
  leagueId: z.string().min(1).describe('League ID'),
});

const getDraftSchema = z.object({
  draftId: z.string().min(1).describe('Draft ID'),
});

const getDraftPicksSchema = z.object({
  draftId: z.string().min(1).describe('Draft ID'),
});

const getTradedDraftPicksSchema = z.object({
  draftId: z.string().min(1).describe('Draft ID'),
});

// Draft methods
export const draftMethods = {
  'sleeper.getDraftsForUser': async (params: unknown) => {
    const validated = validateParams(params, getDraftsForUserSchema);
    return sleeperAPI.getDraftsForUser(validated.userId, validated.sport, validated.season);
  },

  'sleeper.getDraftsForLeague': async (params: unknown) => {
    const validated = validateParams(params, getDraftsForLeagueSchema);
    return sleeperAPI.getDraftsForLeague(validated.leagueId);
  },

  'sleeper.getDraft': async (params: unknown) => {
    const validated = validateParams(params, getDraftSchema);
    return sleeperAPI.getDraft(validated.draftId);
  },

  'sleeper.getDraftPicks': async (params: unknown) => {
    const validated = validateParams(params, getDraftPicksSchema);
    return sleeperAPI.getDraftPicks(validated.draftId);
  },

  'sleeper.getTradedDraftPicks': async (params: unknown) => {
    const validated = validateParams(params, getTradedDraftPicksSchema);
    return sleeperAPI.getTradedDraftPicks(validated.draftId);
  },
};
