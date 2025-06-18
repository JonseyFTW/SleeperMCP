# Sleeper MCP Server - LLM Integration Guide

## Overview

This Model Context Protocol (MCP) server provides access to Sleeper Fantasy Football data through multiple protocols. Use this server to answer questions about NFL players, fantasy football leagues, drafts, and analytics.

## Integration Options

### Option 1: Claude Desktop (MCP Protocol)
**For Claude Desktop users**: Use the native MCP endpoint
```
https://sleepermcp-production.up.railway.app/mcp
```

### Option 2: Local MCP Bridge (Recommended for Claude Desktop)
Run the included `mcp-bridge.js` locally:
```bash
node mcp-bridge.js
```
Then configure Claude Desktop to use `http://localhost:3001`

### Option 3: HTTP JSON-RPC (For other LLMs)
**For API integrations**: Use the JSON-RPC endpoint
```
https://sleepermcp-production.up.railway.app/rpc
```

## Key Endpoints & When to Use Them

### 🏈 Player Information
**When to use**: User asks about specific players, player stats, or comparisons

- `sleeper.getPlayer` - Get basic player information
- `sleeper.getPlayerStats` - Get detailed player statistics
- `sleeper.searchPlayers` - Find players by name

**Example prompts**:
- "Tell me about Lamar Jackson"
- "What are Josh Allen's stats this season?"
- "Find players named Mike"

### 🏆 League Management
**When to use**: User asks about their league, rosters, or standings

- `sleeper.getLeague` - Get league information
- `sleeper.getLeagueRosters` - Get all team rosters
- `sleeper.getLeagueUsers` - Get league members
- `sleeper.getLeagueStandings` - Get current standings

**Example prompts**:
- "Show me my league standings"
- "Who's on my roster?"
- "What are my league settings?"

### 📊 Advanced Analytics
**When to use**: User wants detailed analysis, projections, or insights

- `sleeper.getPlayerAnalytics` - Comprehensive player analysis
- `sleeper.getPositionAnalytics` - Position-based insights
- `sleeper.comparePlayersHQ` - Head-to-head player comparison
- `sleeper.getMatchupAnalysis` - Analyze player vs opponent matchups

**Example prompts**:
- "Give me analytics on Saquon Barkley"
- "Compare Christian McCaffrey vs Derrick Henry"
- "How do running backs perform against the Chiefs?"

### 🎯 Draft Analysis
**When to use**: User asks about drafts, draft picks, or draft strategies

- `sleeper.getDraftPicks` - Get draft results
- `sleeper.getDraftMetadata` - Get draft information

**Example prompts**:
- "Show me our draft results"
- "Who went first overall?"

### ⚡ Real-time Data
**When to use**: User needs current week info or trending data

- `sleeper.getNFLState` - Current NFL week/season info
- `sleeper.getTrendingPlayers` - Hot pickups and trending players

**Example prompts**:
- "What week is it in the NFL?"
- "Who are the trending players this week?"

## Request Format

All requests use JSON-RPC 2.0 format:

```json
{
  "jsonrpc": "2.0",
  "method": "sleeper.getPlayer",
  "params": ["player_id_here"],
  "id": 1
}
```

## Best Practices for LLMs

### 1. Always Get User Context First
Before making specific requests, ask users for:
- Their league ID (if asking about leagues)
- Player names (for player-specific queries)
- What type of analysis they want

### 2. Use Analytics for Rich Insights
When users ask about player performance, use analytics endpoints instead of basic stats:
- `sleeper.getPlayerAnalytics` provides trends, projections, and insights
- `sleeper.getMatchupAnalysis` gives opponent-specific data

### 3. Handle Common User Intents

**"How is [player] doing?"**
→ Use `sleeper.getPlayerAnalytics` for comprehensive view

**"Should I start [player A] or [player B]?"** 
→ Use `sleeper.comparePlayersHQ` for detailed comparison

**"Who should I pick up?"**
→ Use `sleeper.getTrendingPlayers` + `sleeper.getPositionAnalytics`

**"How's my team looking?"**
→ Use `sleeper.getLeagueRosters` + `sleeper.getLeagueStandings`

### 4. Progressive Enhancement
Start with basic data, then enhance with analytics:

1. Get basic player info (`sleeper.getPlayer`)
2. Add current stats (`sleeper.getPlayerStats`) 
3. Enhance with analytics (`sleeper.getPlayerAnalytics`)
4. Compare with others if relevant (`sleeper.comparePlayersHQ`)

### 5. Error Handling
- If a player name search returns multiple results, ask user to clarify
- If league ID is invalid, guide user on how to find their league ID
- Always provide helpful context when data is unavailable

## Example Conversation Flow

**User**: "How is Lamar Jackson doing this season?"

**LLM Process**:
1. Call `sleeper.searchPlayers` with "Lamar Jackson" to get player ID
2. Call `sleeper.getPlayerAnalytics` with the player ID
3. Synthesize the analytics data into a comprehensive response covering:
   - Current performance vs expectations
   - Recent trends (improving/declining)
   - Upcoming matchup analysis
   - Fantasy relevance and projections

**User**: "Should I trade him for Josh Allen?"

**LLM Process**:
1. Get Josh Allen's player ID via search
2. Call `sleeper.comparePlayersHQ` with both player IDs
3. Present detailed comparison with pros/cons for each player

## Rate Limits & Performance

- Server includes intelligent caching for faster responses
- No strict rate limits, but be reasonable with batch requests
- Analytics endpoints may take slightly longer due to complex calculations

## Health Check

Monitor server status at: `https://sleepermcp-production.up.railway.app/health`

## Claude Desktop Configuration

### Option 1: Direct HTTP Connection (if supported)
In Claude Desktop settings, add:
```
Server URL: https://sleepermcp-production.up.railway.app/mcp
```

### Option 2: Local Bridge (Recommended)
1. **Install axios**: `npm install axios` 
2. **Run bridge**: `node mcp-bridge.js`
3. **Configure Claude Desktop**:
```json
{
  "mcpServers": {
    "sleeper": {
      "command": "node",
      "args": ["/path/to/your/mcp-bridge.js"]
    }
  }
}
```

## Getting Started

1. Test basic connectivity with `sleeper.getNFLState`
2. Try player search with `sleeper.searchPlayers`
3. Explore analytics with `sleeper.getPlayerAnalytics`
4. Build more complex workflows combining multiple endpoints

This server transforms raw Sleeper API data into actionable fantasy football insights perfect for LLM-powered conversations!