-- Analytics Database Schema for NFL Player Data
-- Optimized for time-series analysis and ML features

-- Core player information (relatively static)
CREATE TABLE players (
    player_id VARCHAR(20) PRIMARY KEY,
    sleeper_id VARCHAR(20) UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    position VARCHAR(10),
    team VARCHAR(5),
    college VARCHAR(100),
    height INTEGER, -- inches
    weight INTEGER, -- pounds
    age INTEGER,
    years_exp INTEGER,
    birth_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Season-level player stats (from historical data)
CREATE TABLE player_season_stats (
    id SERIAL PRIMARY KEY,
    player_id VARCHAR(20) REFERENCES players(player_id),
    season INTEGER,
    week INTEGER,
    team VARCHAR(5),
    position VARCHAR(10),
    
    -- Passing stats
    passing_attempts INTEGER DEFAULT 0,
    passing_completions INTEGER DEFAULT 0,
    passing_yards INTEGER DEFAULT 0,
    passing_tds INTEGER DEFAULT 0,
    passing_interceptions INTEGER DEFAULT 0,
    
    -- Rushing stats
    rushing_attempts INTEGER DEFAULT 0,
    rushing_yards INTEGER DEFAULT 0,
    rushing_tds INTEGER DEFAULT 0,
    
    -- Receiving stats
    receiving_targets INTEGER DEFAULT 0,
    receiving_receptions INTEGER DEFAULT 0,
    receiving_yards INTEGER DEFAULT 0,
    receiving_tds INTEGER DEFAULT 0,
    
    -- Fantasy stats
    fantasy_points DECIMAL(6,2) DEFAULT 0,
    ppr_points DECIMAL(6,2) DEFAULT 0,
    
    -- Game info
    games_played INTEGER DEFAULT 0,
    games_started INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, season, week)
);

-- Current player status and projections
CREATE TABLE player_current_data (
    player_id VARCHAR(20) PRIMARY KEY REFERENCES players(player_id),
    status VARCHAR(20), -- Active, Inactive, IR, etc.
    injury_status VARCHAR(100),
    depth_chart_position INTEGER,
    ownership_percentage DECIMAL(5,2),
    trending_direction VARCHAR(10), -- up, down, steady
    news_updated TIMESTAMP,
    sleeper_data JSONB, -- Raw Sleeper API data
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team information
CREATE TABLE teams (
    team_code VARCHAR(5) PRIMARY KEY,
    team_name VARCHAR(50),
    city VARCHAR(50),
    division VARCHAR(10),
    conference VARCHAR(5)
);

-- Indexes for analytics performance
CREATE INDEX idx_player_season_stats_player_season ON player_season_stats(player_id, season);
CREATE INDEX idx_player_season_stats_season_week ON player_season_stats(season, week);
CREATE INDEX idx_player_season_stats_position ON player_season_stats(position);
CREATE INDEX idx_players_position_team ON players(position, team);
CREATE INDEX idx_current_data_updated ON player_current_data(updated_at);

-- Views for common analytics queries
CREATE VIEW player_career_stats AS
SELECT 
    p.player_id,
    p.first_name,
    p.last_name,
    p.position,
    p.team,
    COUNT(DISTINCT pss.season) as seasons_played,
    SUM(pss.games_played) as total_games,
    SUM(pss.fantasy_points) as career_fantasy_points,
    AVG(pss.fantasy_points) as avg_fantasy_points_per_game,
    SUM(pss.passing_yards + pss.rushing_yards + pss.receiving_yards) as total_yards
FROM players p
LEFT JOIN player_season_stats pss ON p.player_id = pss.player_id
GROUP BY p.player_id, p.first_name, p.last_name, p.position, p.team;

CREATE VIEW current_season_leaders AS
SELECT 
    p.player_id,
    p.first_name || ' ' || p.last_name as player_name,
    p.position,
    p.team,
    SUM(pss.fantasy_points) as season_fantasy_points,
    AVG(pss.fantasy_points) as avg_fantasy_points,
    COUNT(pss.week) as games_played
FROM players p
JOIN player_season_stats pss ON p.player_id = pss.player_id
WHERE pss.season = EXTRACT(YEAR FROM CURRENT_DATE)
GROUP BY p.player_id, p.first_name, p.last_name, p.position, p.team
ORDER BY season_fantasy_points DESC;