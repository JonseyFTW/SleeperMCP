import { userMethods } from './user';
import { sleeperAPI } from '../../api/client';
import { ValidationError } from '../../utils/errors';

// Mock the API client
jest.mock('../../api/client', () => ({
  sleeperAPI: {
    getUserByUsername: jest.fn(),
    getUserById: jest.fn(),
  },
}));

describe('User RPC Methods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sleeper.getUserByUsername', () => {
    const mockUser = {
      user_id: '12345678',
      username: 'testuser',
      display_name: 'Test User',
      avatar: 'avatar123',
    };

    it('should get user by username successfully', async () => {
      (sleeperAPI.getUserByUsername as jest.Mock).mockResolvedValue(mockUser);

      const result = await userMethods['sleeper.getUserByUsername']({
        username: 'testuser',
      });

      expect(sleeperAPI.getUserByUsername).toHaveBeenCalledWith('testuser');
      expect(result).toEqual(mockUser);
    });

    it('should validate required username parameter', async () => {
      await expect(
        userMethods['sleeper.getUserByUsername']({})
      ).rejects.toThrow(ValidationError);

      await expect(
        userMethods['sleeper.getUserByUsername']({ username: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      (sleeperAPI.getUserByUsername as jest.Mock).mockRejectedValue(error);

      await expect(
        userMethods['sleeper.getUserByUsername']({ username: 'testuser' })
      ).rejects.toThrow(error);
    });
  });

  describe('sleeper.getUserById', () => {
    const mockUser = {
      user_id: '12345678',
      username: 'testuser',
      display_name: 'Test User',
      avatar: 'avatar123',
    };

    it('should get user by ID successfully', async () => {
      (sleeperAPI.getUserById as jest.Mock).mockResolvedValue(mockUser);

      const result = await userMethods['sleeper.getUserById']({
        userId: '12345678',
      });

      expect(sleeperAPI.getUserById).toHaveBeenCalledWith('12345678');
      expect(result).toEqual(mockUser);
    });

    it('should validate required userId parameter', async () => {
      await expect(
        userMethods['sleeper.getUserById']({})
      ).rejects.toThrow(ValidationError);

      await expect(
        userMethods['sleeper.getUserById']({ userId: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      (sleeperAPI.getUserById as jest.Mock).mockRejectedValue(error);

      await expect(
        userMethods['sleeper.getUserById']({ userId: '12345678' })
      ).rejects.toThrow(error);
    });
  });
});