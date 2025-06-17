export const openRPCDocument = {
  openrpc: '1.2.6',
  info: {
    title: 'MCP Sleeper Fantasy Football API',
    description:
      'Model Context Protocol server providing JSON-RPC 2.0 access to Sleeper Fantasy Football API',
    version: '1.0.0',
    contact: {
      name: 'API Support',
      email: 'support@example.com',
      url: 'https://github.com/yourusername/mcp-sleeper-server',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      name: 'Local Development',
      url: 'http://localhost:8080/rpc',
    },
    {
      name: 'Production',
      url: 'https://api.example.com/rpc',
    },
  ],
  methods: [
    // User Methods
    {
      name: 'sleeper.getUserByUsername',
      description: 'Get user information by username',
      params: [
        {
          name: 'username',
          description: 'Sleeper username',
          required: true,
          schema: { type: 'string' },
        },
      ],
      result: {
        name: 'user',
        description: 'User object',
        schema: { type: 'object' },
      },
      examples: [
        {
          name: 'Get user example',
          params: [{ name: 'username', value: 'example_user' }],
          result: {
            name: 'user',
            value: {
              user_id: '12345678',
              username: 'example_user',
              display_name: 'Example User',
              avatar: 'avatar_id',
            },
          },
        },
      ],
    },
    {
      name: 'sleeper.getUserById',
      description: 'Get user information by user ID',
      params: [
        {
          name: 'userId',
          description: 'Sleeper user ID',
          required: true,
          schema: { type: 'string' },
        },
      ],
      result: {
        name: 'user',
        description: 'User object',
        schema: { type: 'object' },
      },
    },
    // League Methods
    {
      name: 'sleeper.getLeaguesForUser',
      description: 'Get all leagues for a specific user',
      params: [
        {
          name: 'userId',
          description: 'Sleeper user ID',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'sport',
          description: 'Sport type (default: nfl)',
          required: false,
          schema: { type: 'string', default: 'nfl' },
        },
        {
          name: 'season',
          description: 'Season year (e.g., 2024)',
          required: true,
          schema: { type: 'string', pattern: '^\\d{4}$' },
        },
      ],
      result: {
        name: 'leagues',
        description: 'Array of league objects',
        schema: { type: 'array', items: { type: 'object' } },
      },
    },
    {
      name: 'sleeper.getLeague',
      description: 'Get league information',
      params: [
        {
          name: 'leagueId',
          description: 'League ID',
          required: true,
          schema: { type: 'string' },
        },
      ],
      result: {
        name: 'league',
        description: 'League object',
        schema: { type: 'object' },
      },
    },
    {
      name: 'sleeper.getRosters',
      description: 'Get all rosters in a league',
      params: [
        {
          name: 'leagueId',
          description: 'League ID',
          required: true,
          schema: { type: 'string' },
        },
      ],
      result: {
        name: 'rosters',
        description: 'Array of roster objects',
        schema: { type: 'array', items: { type: 'object' } },
      },
    },
    {
      name: 'sleeper.getUsers',
      description: 'Get all users in a league',
      params: [
        {
          name: 'leagueId',
          description: 'League ID',
          required: true,
          schema: { type: 'string' },
        },
      ],
      result: {
        name: 'users',
        description: 'Array of user objects',
        schema: { type: 'array', items: { type: 'object' } },
      },
    },
    {
      name: 'sleeper.getMatchups',
      description: 'Get matchups for a specific week',
      params: [
        {
          name: 'leagueId',
          description: 'League ID',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'week',
          description: 'Week number (1-18)',
          required: true,
          schema: { type: 'integer', minimum: 1, maximum: 18 },
        },
      ],
      result: {
        name: 'matchups',
        description: 'Array of matchup objects',
        schema: { type: 'array', items: { type: 'object' } },
      },
    },
    {
      name: 'sleeper.getWinnersBracket',
      description: 'Get winners playoff bracket',
      params: [
        {
          name: 'leagueId',
          description: 'League ID',
          required: true,
          schema: { type: 'string' },
        },
      ],
      result: {
        name: 'bracket',
        description: 'Winners bracket array',
        schema: { type: 'array' },
      },
    },
    {
      name: 'sleeper.getLosersBracket',
      description: 'Get losers playoff bracket',
      params: [
        {
          name: 'leagueId',
          description: 'League ID',
          required: true,
          schema: { type: 'string' },
        },
      ],
      result: {
        name: 'bracket',
        description: 'Losers bracket array',
        schema: { type: 'array' },
      },
    },
    {
      name: 'sleeper.getTransactions',
      description: 'Get transactions for a specific week',
      params: [
        {
          name: 'leagueId',
          description: 'League ID',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'week',
          description: 'Week number (1-18)',
          required: true,
          schema: { type: 'integer', minimum: 1, maximum: 18 },
        },
      ],
      result: {
        name: 'transactions',
        description: 'Array of transaction objects',
        schema: { type: 'array', items: { type: 'object' } },
      },
    },
    {
      name: 'sleeper.getTradedPicks',
      description: 'Get all traded draft picks in a league',
      params: [
        {
          name: 'leagueId',
          description: 'League ID',
          required: true,
          schema: { type: 'string' },
        },
      ],
      result: {
        name: 'tradedPicks',
        description: 'Array of traded pick objects',
        schema: { type: 'array', items: { type: 'object' } },
      },
    },
    // Player Methods
    {
      name: 'sleeper.getAllPlayers',
      description: 'Get all players for a sport',
      params: [
        {
          name: 'sport',
          description: 'Sport type (default: nfl)',
          required: false,
          schema: { type: 'string', default: 'nfl' },
        },
      ],
      result: {
        name: 'players',
        description: 'Object with player IDs as keys',
        schema: { type: 'object' },
      },
    },
    {
      name: 'sleeper.getTrendingPlayers',
      description: 'Get trending players (adds/drops)',
      params: [
        {
          name: 'sport',
          description: 'Sport type (default: nfl)',
          required: false,
          schema: { type: 'string', default: 'nfl' },
        },
        {
          name: 'type',
          description: 'Trending type: add or drop',
          required: false,
          schema: { type: 'string', enum: ['add', 'drop'], default: 'add' },
        },
        {
          name: 'lookback',
          description: 'Lookback hours (1-48)',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 48 },
        },
        {
          name: 'limit',
          description: 'Result limit (1-200)',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 200 },
        },
      ],
      result: {
        name: 'players',
        description: 'Array of trending player objects',
        schema: { type: 'array', items: { type: 'object' } },
      },
    },
    // Draft Methods
    {
      name: 'sleeper.getDraftsForUser',
      description: 'Get all drafts for a user',
      params: [
        {
          name: 'userId',
          description: 'Sleeper user ID',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'sport',
          description: 'Sport type (default: nfl)',
          required: false,
          schema: { type: 'string', default: 'nfl' },
        },
        {
          name: 'season',
          description: 'Season year (e.g., 2024)',
          required: true,
          schema: { type: 'string', pattern: '^\\d{4}$' },
        },
      ],
      result: {
        name: 'drafts',
        description: 'Array of draft objects',
        schema: { type: 'array', items: { type: 'object' } },
      },
    },
    {
      name: 'sleeper.getDraftsForLeague',
      description: 'Get all drafts for a league',
      params: [
        {
          name: 'leagueId',
          description: 'League ID',
          required: true,
          schema: { type: 'string' },
        },
      ],
      result: {
        name: 'drafts',
        description: 'Array of draft objects',
        schema: { type: 'array', items: { type: 'object' } },
      },
    },
    {
      name: 'sleeper.getDraft',
      description: 'Get draft information',
      params: [
        {
          name: 'draftId',
          description: 'Draft ID',
          required: true,
          schema: { type: 'string' },
        },
      ],
      result: {
        name: 'draft',
        description: 'Draft object',
        schema: { type: 'object' },
      },
    },
    {
      name: 'sleeper.getDraftPicks',
      description: 'Get all picks for a draft',
      params: [
        {
          name: 'draftId',
          description: 'Draft ID',
          required: true,
          schema: { type: 'string' },
        },
      ],
      result: {
        name: 'picks',
        description: 'Array of draft pick objects',
        schema: { type: 'array', items: { type: 'object' } },
      },
    },
    {
      name: 'sleeper.getTradedDraftPicks',
      description: 'Get traded picks for a draft',
      params: [
        {
          name: 'draftId',
          description: 'Draft ID',
          required: true,
          schema: { type: 'string' },
        },
      ],
      result: {
        name: 'tradedPicks',
        description: 'Array of traded pick objects',
        schema: { type: 'array', items: { type: 'object' } },
      },
    },
    // State Methods
    {
      name: 'sleeper.getNFLState',
      description: 'Get current NFL state (week, season, etc.)',
      params: [],
      result: {
        name: 'state',
        description: 'NFL state object',
        schema: { type: 'object' },
      },
      examples: [
        {
          name: 'Get NFL state example',
          params: [],
          result: {
            name: 'state',
            value: {
              week: 10,
              season_type: 'regular',
              season_start_date: '2024-09-05',
              season: '2024',
              leg: 10,
              league_season: '2024',
              league_create_season: '2024',
              display_week: 10,
            },
          },
        },
      ],
    },
  ],
  components: {
    schemas: {},
  },
};
