import { z } from 'zod';
import { sleeperAPI } from '../../api/client';
import { validateParams } from '../../utils/validation';

// Validation schemas
const getLeaguesForUserSchema = z.object({
  userId: z.string().min(1).describe('Sleeper user ID'),
  sport: z.string().default('nfl').describe('Sport type (default: nfl)'),
  season: z.string().regex(/^\d{4}$/).describe('Season year (e.g., 2024)'),
});

const getLeagueSchema = z.object({
  leagueId: z.string().min(1).describe('League ID'),
});

const getRostersSchema = z.object({
  leagueId: z.string().min(1).describe('League ID'),
});

const getUsersSchema = z.object({
  leagueId: z.string().min(1).describe('League ID'),
});

const getMatchupsSchema = z.object({
  leagueId: z.string().min(1).describe('League ID'),
  week: z.number().int().min(1).max(18).describe('Week number (1-18)'),
});

const getBracketSchema = z.object({
  leagueId: z.string().min(1).describe('League ID'),
});

const getTransactionsSchema = z.object({
  leagueId: z.string().min(1).describe('League ID'),
  week: z.number().int().min(1).max(18).describe('Week number (1-18)'),
});

const getTradedPicksSchema = z.object({
  leagueId: z.string().min(1).describe('League ID'),
});

// League methods
export const leagueMethods = {
  'sleeper.getLeaguesForUser': async (params: unknown) => {
    const validated = validateParams(params, getLeaguesForUserSchema);
    return sleeperAPI.getLeaguesForUser(validated.userId, validated.sport, validated.season);
  },

  'sleeper.getLeague': async (params: unknown) => {
    const validated = validateParams(params, getLeagueSchema);
    return sleeperAPI.getLeague(validated.leagueId);
  },

  'sleeper.getRosters': async (params: unknown) => {
    const validated = validateParams(params, getRostersSchema);
    return sleeperAPI.getRosters(validated.leagueId);
  },

  'sleeper.getUsers': async (params: unknown) => {
    const validated = validateParams(params, getUsersSchema);
    return sleeperAPI.getUsers(validated.leagueId);
  },

  'sleeper.getMatchups': async (params: unknown) => {
    const validated = validateParams(params, getMatchupsSchema);
    return sleeperAPI.getMatchups(validated.leagueId, validated.week);
  },

  'sleeper.getWinnersBracket': async (params: unknown) => {
    const validated = validateParams(params, getBracketSchema);
    return sleeperAPI.getWinnersBracket(validated.leagueId);
  },

  'sleeper.getLosersBracket': async (params: unknown) => {
    const validated = validateParams(params, getBracketSchema);
    return sleeperAPI.getLosersBracket(validated.leagueId);
  },

  'sleeper.getTransactions': async (params: unknown) => {
    const validated = validateParams(params, getTransactionsSchema);
    return sleeperAPI.getTransactions(validated.leagueId, validated.week);
  },

  'sleeper.getTradedPicks': async (params: unknown) => {
    const validated = validateParams(params, getTradedPicksSchema);
    return sleeperAPI.getTradedPicks(validated.leagueId);
  },
};