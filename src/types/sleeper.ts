// Sleeper API TypeScript interface definitions

// Base types
export type SleeperSport = 'nfl' | 'nba' | 'mlb' | 'nhl';
export type SleeperSeason = string; // e.g., "2024"
export type SleeperWeek = number; // 1-18 for regular season
export type SleeperUserId = string;
export type SleeperLeagueId = string;
export type SleeperPlayerId = string;
export type SleeperDraftId = string;
export type SleeperRosterId = number;

// NFL State
export interface SleeperNFLState {
  season_type: 'regular' | 'pre' | 'post';
  season: SleeperSeason;
  previous_season: SleeperSeason;
  week: SleeperWeek;
  season_start_date: string;
  leg: number;
  display_week: number;
}

// User
export interface SleeperUser {
  user_id: SleeperUserId;
  username: string;
  display_name: string;
  avatar: string | null;
  metadata?: {
    avatar?: string;
    team_name?: string;
    [key: string]: any;
  };
  settings?: {
    [key: string]: any;
  };
}

// League Settings
export interface SleeperLeagueSettings {
  max_keepers: number;
  draft_rounds: number;
  trade_review_days: number;
  squads: number;
  reserve_allow_cov: number;
  capacity_override: number;
  pick_trading: number;
  taxi_years: number;
  taxi_allow_vets: number;
  taxi_slots: number;
  playoff_seed_type: number;
  daily_waivers_hour: number;
  daily_waivers_days: number;
  daily_waivers_day_of_week: number;
  waiver_type: number;
  waiver_clear_days: number;
  waiver_day_of_week: number;
  start_week: number;
  playoff_teams: number;
  playoff_weeks_per_matchup: number;
  playoff_type: number;
  playoff_round_type: number;
  leg: number;
  trade_deadline: number;
  reserve_slots: number;
  bench_lock: number;
  reserve_allow_sus: number;
  reserve_allow_out: number;
  playoff_week_start: number;
  daily_waivers: number;
  waiver_budget: number;
  reserve_allow_dnr: number;
  veto_votes_needed: number;
  reserve_allow_doubtful: number;
  playoff_bracket_manual: number;
  commissioner_direct_invite: number;
  veto_auto_poll: number;
  veto_show_votes: number;
  disable_adds: number;
  disable_trades: number;
  best_ball: number;
  last_scored_leg: number;
  scouting_report_nfl: number;
  daily_waivers_last_ran: number;
  timezone: string;
  type: number;
  pick_trading_deadline: number;
  disable_draft_standings: number;
  daily_waivers_cutoff_hour: number;
}

// League Scoring Settings
export interface SleeperScoringSettings {
  pass_yd: number;
  pass_td: number;
  pass_int: number;
  pass_2pt: number;
  rush_yd: number;
  rush_td: number;
  rush_2pt: number;
  rec_yd: number;
  rec_td: number;
  rec: number;
  rec_2pt: number;
  fum_lost: number;
  fgm_0_19: number;
  fgm_20_29: number;
  fgm_30_39: number;
  fgm_40_49: number;
  fgm_50p: number;
  fgmiss: number;
  xpm: number;
  xpmiss: number;
  def_st_td: number;
  def_st_ff: number;
  def_st_fum_rec: number;
  def_st_int: number;
  def_st_safety: number;
  def_st_sack: number;
  def_st_blk_kick: number;
  pts_allow_0: number;
  pts_allow_1_6: number;
  pts_allow_7_13: number;
  pts_allow_14_20: number;
  pts_allow_21_27: number;
  pts_allow_28_34: number;
  pts_allow_35p: number;
  [key: string]: number;
}

// League Roster Positions
export interface SleeperRosterPositions {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  K: number;
  DEF: number;
  FLEX: number;
  SUPER_FLEX: number;
  BN: number;
  IR: number;
  [key: string]: number;
}

// League
export interface SleeperLeague {
  total_rosters: number;
  status: 'complete' | 'drafting' | 'in_season' | 'pre_draft';
  sport: SleeperSport;
  settings: SleeperLeagueSettings;
  season_type: 'regular' | 'pre' | 'post';
  season: SleeperSeason;
  scoring_settings: SleeperScoringSettings;
  roster_positions: (keyof SleeperRosterPositions)[];
  previous_league_id: SleeperLeagueId | null;
  name: string;
  league_id: SleeperLeagueId;
  draft_id: SleeperDraftId;
  avatar: string | null;
  bracket_id: string | null;
  loser_bracket_id: string | null;
  company_id: string | null;
  group_id: string | null;
  metadata?: {
    [key: string]: any;
  };
}

// Roster
export interface SleeperRoster {
  starters: SleeperPlayerId[];
  settings: {
    wins: number;
    waiver_position: number;
    waiver_budget_used: number;
    total_moves: number;
    ties: number;
    losses: number;
    fpts: number;
    fpts_decimal: number;
    fpts_against: number;
    fpts_against_decimal: number;
    division?: number;
  };
  roster_id: SleeperRosterId;
  reserve: SleeperPlayerId[] | null;
  players: SleeperPlayerId[];
  player_map: Record<SleeperPlayerId, any> | null;
  owner_id: SleeperUserId;
  league_id: SleeperLeagueId;
  keepers: SleeperPlayerId[] | null;
  taxi: SleeperPlayerId[] | null;
  metadata?: {
    [key: string]: any;
  };
  co_owners?: SleeperUserId[] | null;
}

// Player
export interface SleeperPlayer {
  player_id: SleeperPlayerId;
  position: string;
  team: string | null;
  first_name: string;
  last_name: string;
  full_name?: string;
  age?: number;
  height?: string;
  weight?: string;
  years_exp?: number;
  college?: string;
  status?:
    | 'Active'
    | 'Inactive'
    | 'Reserve'
    | 'Injured Reserve'
    | 'Non Football Injury'
    | 'Physically Unable to Perform'
    | 'Practice Squad'
    | 'Exempt'
    | 'Suspended'
    | 'Reserve/Future';
  birth_date?: string;
  gsis_id?: string;
  espn_id?: string;
  yahoo_id?: string;
  rotowire_id?: string;
  rotoworld_id?: string;
  fantasy_data_id?: string;
  sleeper_id?: string;
  injury_status?: 'Questionable' | 'Doubtful' | 'Out' | 'IR' | 'PUP' | 'COV' | 'SUS';
  injury_body_part?: string;
  injury_notes?: string;
  news_updated?: number;
  fantasy_positions?: string[];
  number?: number;
  depth_chart_position?: number;
  depth_chart_order?: number;
  search_rank?: number;
  search_full_name?: string;
  search_first_name?: string;
  search_last_name?: string;
  sport?: SleeperSport;
  metadata?: {
    [key: string]: any;
  };
}

// Trending Players
export interface SleeperTrendingPlayer {
  player_id: SleeperPlayerId;
  count: number;
}

export interface SleeperTrendingPlayers {
  [type: string]: SleeperTrendingPlayer[];
}

// Matchup
export interface SleeperMatchup {
  starters: SleeperPlayerId[];
  roster_id: SleeperRosterId;
  players: SleeperPlayerId[];
  matchup_id: number;
  points: number;
  custom_points?: number | null;
  starters_points?: number[];
  players_points?: Record<SleeperPlayerId, number>;
}

// Transaction Types
export type SleeperTransactionType = 'trade' | 'waiver' | 'free_agent';
export type SleeperTransactionStatus = 'complete' | 'failed';

// Transaction
export interface SleeperTransaction {
  type: SleeperTransactionType;
  transaction_id: string;
  status: SleeperTransactionStatus;
  settings: Record<string, any> | null;
  roster_ids: SleeperRosterId[];
  metadata: Record<string, any> | null;
  leg: number;
  drops: Record<SleeperUserId, SleeperPlayerId> | null;
  draft_picks: any[];
  creator: SleeperUserId;
  created: number;
  consenter_ids: SleeperUserId[];
  adds: Record<SleeperUserId, SleeperPlayerId> | null;
  waiver_budget?: Array<{
    sender: SleeperRosterId;
    receiver: SleeperRosterId;
    amount: number;
  }>;
}

// Draft Pick
export interface SleeperDraftPick {
  player_id: SleeperPlayerId;
  picked_by: SleeperUserId;
  roster_id: SleeperRosterId;
  round: number;
  draft_slot: number;
  pick_no: number;
  metadata: {
    years_exp?: string;
    team?: string;
    status?: string;
    sport?: string;
    position?: string;
    player_id?: string;
    number?: string;
    news_updated?: string;
    last_name?: string;
    injury_status?: string;
    first_name?: string;
    amount?: string;
    [key: string]: any;
  };
  is_keeper?: boolean;
  draft_id: SleeperDraftId;
}

// Draft Settings
export interface SleeperDraftSettings {
  teams: number;
  slots_wr: number;
  slots_te: number;
  slots_rb: number;
  slots_qb: number;
  slots_k: number;
  slots_flex: number;
  slots_def: number;
  slots_bn: number;
  rounds: number;
  reversal_round: number;
  playoff_teams: number;
  pick_timer: number;
  nomination_timer?: number;
  enforce_position_limits: number;
  cpu_autopick: number;
  alpha_sort: number;
  [key: string]: any;
}

// Draft Metadata
export interface SleeperDraftMetadata {
  scoring_type: string;
  name: string;
  description: string;
  [key: string]: any;
}

// Draft
export interface SleeperDraft {
  type: 'snake' | 'auction' | 'linear';
  status: 'pre_draft' | 'drafting' | 'paused' | 'complete';
  start_time: number;
  sport: SleeperSport;
  settings: SleeperDraftSettings;
  season_type: 'regular' | 'pre' | 'post';
  season: SleeperSeason;
  metadata: SleeperDraftMetadata;
  league_id: SleeperLeagueId;
  last_picked: number;
  draft_order: Record<SleeperUserId, number> | null;
  draft_id: SleeperDraftId;
  creators: SleeperUserId[] | null;
  created: number;
  slot_to_roster_id: Record<string, SleeperRosterId>;
}

// Traded Draft Pick
export interface SleeperTradedDraftPick {
  season: SleeperSeason;
  round: number;
  roster_id: SleeperRosterId;
  previous_owner_id: SleeperRosterId;
  owner_id: SleeperRosterId;
}

// Playoff Bracket
export interface SleeperPlayoffMatchup {
  r: number; // round
  m: number; // matchup id
  t1: SleeperRosterId; // team 1 roster id
  t2: SleeperRosterId; // team 2 roster id
  w?: SleeperRosterId; // winner roster id
  l?: SleeperRosterId; // loser roster id
  t1_from?: {
    w?: number;
    l?: number;
  };
  t2_from?: {
    w?: number;
    l?: number;
  };
  p?: number; // points for winner
}

// API Response wrapper types for better type safety
export type SleeperApiResponse<T> = T;
export type SleeperUserResponse = SleeperApiResponse<SleeperUser>;
export type SleeperLeagueResponse = SleeperApiResponse<SleeperLeague>;
export type SleeperRosterResponse = SleeperApiResponse<SleeperRoster[]>;
export type SleeperUsersResponse = SleeperApiResponse<SleeperUser[]>;
export type SleeperPlayersResponse = SleeperApiResponse<Record<SleeperPlayerId, SleeperPlayer>>;
export type SleeperMatchupsResponse = SleeperApiResponse<SleeperMatchup[]>;
export type SleeperTransactionsResponse = SleeperApiResponse<SleeperTransaction[]>;
export type SleeperDraftResponse = SleeperApiResponse<SleeperDraft>;
export type SleeperDraftPicksResponse = SleeperApiResponse<SleeperDraftPick[]>;
export type SleeperTradedPicksResponse = SleeperApiResponse<SleeperTradedDraftPick[]>;
export type SleeperNFLStateResponse = SleeperApiResponse<SleeperNFLState>;
export type SleeperTrendingPlayersResponse = SleeperApiResponse<SleeperTrendingPlayers>;
export type SleeperPlayoffBracketResponse = SleeperApiResponse<SleeperPlayoffMatchup[]>;

// Error types
export interface SleeperApiError {
  error: string;
  message: string;
  status: number;
}
