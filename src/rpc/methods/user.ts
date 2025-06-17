import { z } from 'zod';
import { sleeperAPI } from '../../api/client';
import { validateParams } from '../../utils/validation';

// Validation schemas
const getUserByUsernameSchema = z.object({
  username: z.string().min(1).describe('Sleeper username'),
});

const getUserByIdSchema = z.object({
  userId: z.string().min(1).describe('Sleeper user ID'),
});

// User methods
export const userMethods = {
  'sleeper.getUserByUsername': async (params: unknown) => {
    const validated = validateParams(params, getUserByUsernameSchema);
    return sleeperAPI.getUserByUsername(validated.username);
  },

  'sleeper.getUserById': async (params: unknown) => {
    const validated = validateParams(params, getUserByIdSchema);
    return sleeperAPI.getUserById(validated.userId);
  },
};
