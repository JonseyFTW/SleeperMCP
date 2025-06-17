import { sleeperAPI } from '../../api/client';

// State methods
export const stateMethods = {
  'sleeper.getNFLState': async () => {
    return sleeperAPI.getNFLState();
  },
};
