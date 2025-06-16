# LLM Integration Examples

This document shows how to integrate the MCP Sleeper Server with various LLM tools and agents.

## Basic JSON-RPC Client Example

```javascript
const axios = require('axios');

class SleeperMCPClient {
  constructor(baseUrl = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
    this.nextId = 1;
  }

  async call(method, params = {}) {
    const response = await axios.post(`${this.baseUrl}/rpc`, {
      jsonrpc: '2.0',
      method,
      params,
      id: this.nextId++,
    });

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    return response.data.result;
  }

  // Helper methods for common operations
  async getUser(username) {
    return this.call('sleeper.getUserByUsername', { username });
  }

  async getUserLeagues(userId, season) {
    return this.call('sleeper.getLeaguesForUser', { 
      userId, 
      sport: 'nfl', 
      season 
    });
  }

  async getMatchups(leagueId, week) {
    return this.call('sleeper.getMatchups', { leagueId, week });
  }

  async getTrendingPlayers(type = 'add', limit = 10) {
    return this.call('sleeper.getTrendingPlayers', { 
      sport: 'nfl', 
      type, 
      limit 
    });
  }
}

// Example usage
async function main() {
  const client = new SleeperMCPClient();
  
  try {
    // Get current NFL state
    const nflState = await client.call('sleeper.getNFLState');
    console.log('Current Week:', nflState.week);
    console.log('Season:', nflState.season);

    // Get trending players
    const trending = await client.getTrendingPlayers('add', 5);
    console.log('Top 5 trending adds:', trending);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
```

## Python Integration Example

```python
import requests
import json

class SleeperMCPClient:
    def __init__(self, base_url='http://localhost:8080'):
        self.base_url = base_url
        self.next_id = 1

    def call(self, method, params=None):
        payload = {
            'jsonrpc': '2.0',
            'method': method,
            'params': params or {},
            'id': self.next_id
        }
        self.next_id += 1

        response = requests.post(f'{self.base_url}/rpc', json=payload)
        data = response.json()

        if 'error' in data:
            raise Exception(data['error']['message'])

        return data['result']

    def get_user_fantasy_summary(self, username, season):
        """Get a complete fantasy summary for a user"""
        # Get user info
        user = self.call('sleeper.getUserByUsername', {'username': username})
        if not user:
            return None

        # Get user's leagues
        leagues = self.call('sleeper.getLeaguesForUser', {
            'userId': user['user_id'],
            'sport': 'nfl',
            'season': season
        })

        summary = {
            'user': user,
            'leagues': []
        }

        # Get details for each league
        for league in leagues[:3]:  # Limit to 3 leagues for example
            league_info = {
                'name': league['name'],
                'league_id': league['league_id'],
                'rosters': self.call('sleeper.getRosters', {
                    'leagueId': league['league_id']
                })
            }
            summary['leagues'].append(league_info)

        return summary

# Example usage
client = SleeperMCPClient()

# Get NFL state
state = client.call('sleeper.getNFLState')
print(f"NFL Week {state['week']} of {state['season']} season")

# Get user summary
summary = client.get_user_fantasy_summary('example_user', '2024')
print(json.dumps(summary, indent=2))
```

## LangChain Integration

```python
from langchain.tools import BaseTool
from typing import Optional, Type
from pydantic import BaseModel, Field
import requests

class SleeperUserInput(BaseModel):
    username: str = Field(description="Sleeper username to look up")

class SleeperUserTool(BaseTool):
    name = "sleeper_get_user"
    description = "Get Sleeper Fantasy Football user information by username"
    args_schema: Type[BaseModel] = SleeperUserInput
    
    def _run(self, username: str) -> str:
        """Get user information from Sleeper"""
        response = requests.post('http://localhost:8080/rpc', json={
            'jsonrpc': '2.0',
            'method': 'sleeper.getUserByUsername',
            'params': {'username': username},
            'id': 1
        })
        
        data = response.json()
        if 'error' in data:
            return f"Error: {data['error']['message']}"
        
        user = data['result']
        if not user:
            return f"User '{username}' not found"
        
        return f"User: {user['display_name']} (ID: {user['user_id']})"

    async def _arun(self, username: str) -> str:
        """Async version"""
        raise NotImplementedError("Async not implemented")

# Use with LangChain agent
from langchain.agents import initialize_agent, AgentType
from langchain.llms import OpenAI

llm = OpenAI(temperature=0)
tools = [SleeperUserTool()]

agent = initialize_agent(
    tools, 
    llm, 
    agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
    verbose=True
)

# Example query
result = agent.run("Who is the Sleeper user 'example_user'?")
```

## OpenAI Function Calling

```javascript
const OpenAI = require('openai');
const axios = require('axios');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define MCP functions for OpenAI
const mcpFunctions = [
  {
    name: 'get_user_leagues',
    description: 'Get all fantasy football leagues for a user',
    parameters: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'Sleeper username',
        },
        season: {
          type: 'string',
          description: 'Season year (e.g., 2024)',
        },
      },
      required: ['username', 'season'],
    },
  },
  {
    name: 'get_matchup_scores',
    description: 'Get matchup scores for a league week',
    parameters: {
      type: 'object',
      properties: {
        leagueId: {
          type: 'string',
          description: 'League ID',
        },
        week: {
          type: 'integer',
          description: 'Week number (1-18)',
        },
      },
      required: ['leagueId', 'week'],
    },
  },
];

// Function to call MCP server
async function callMCPFunction(functionName, args) {
  const methodMap = {
    'get_user_leagues': async (args) => {
      // First get user
      const userResponse = await axios.post('http://localhost:8080/rpc', {
        jsonrpc: '2.0',
        method: 'sleeper.getUserByUsername',
        params: { username: args.username },
        id: 1,
      });
      
      const user = userResponse.data.result;
      if (!user) return 'User not found';
      
      // Then get leagues
      const leaguesResponse = await axios.post('http://localhost:8080/rpc', {
        jsonrpc: '2.0',
        method: 'sleeper.getLeaguesForUser',
        params: {
          userId: user.user_id,
          sport: 'nfl',
          season: args.season,
        },
        id: 2,
      });
      
      return leaguesResponse.data.result;
    },
    'get_matchup_scores': async (args) => {
      const response = await axios.post('http://localhost:8080/rpc', {
        jsonrpc: '2.0',
        method: 'sleeper.getMatchups',
        params: args,
        id: 1,
      });
      return response.data.result;
    },
  };

  const handler = methodMap[functionName];
  if (!handler) {
    throw new Error(`Unknown function: ${functionName}`);
  }
  
  return handler(args);
}

// Example chat with function calling
async function chatWithFunctions(userMessage) {
  const messages = [
    {
      role: 'system',
      content: 'You are a fantasy football assistant with access to Sleeper data.',
    },
    {
      role: 'user',
      content: userMessage,
    },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages,
    functions: mcpFunctions,
    function_call: 'auto',
  });

  const message = response.choices[0].message;

  // Check if the model wants to call a function
  if (message.function_call) {
    const functionName = message.function_call.name;
    const functionArgs = JSON.parse(message.function_call.arguments);
    
    // Call the MCP function
    const functionResult = await callMCPFunction(functionName, functionArgs);
    
    // Add the function result to the conversation
    messages.push(message);
    messages.push({
      role: 'function',
      name: functionName,
      content: JSON.stringify(functionResult),
    });
    
    // Get the final response
    const finalResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
    });
    
    return finalResponse.choices[0].message.content;
  }
  
  return message.content;
}

// Example usage
async function main() {
  const response = await chatWithFunctions(
    "What leagues is the user 'example_user' in for the 2024 season?"
  );
  console.log(response);
}

main();
```

## Webhook Integration for Real-time Updates

```javascript
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Webhook endpoint for league activity monitoring
app.post('/webhook/league-activity', async (req, res) => {
  const { leagueId, week } = req.body;
  
  try {
    // Get recent transactions
    const transactions = await axios.post('http://localhost:8080/rpc', {
      jsonrpc: '2.0',
      method: 'sleeper.getTransactions',
      params: { leagueId, week },
      id: 1,
    });
    
    // Get current matchups
    const matchups = await axios.post('http://localhost:8080/rpc', {
      jsonrpc: '2.0',
      method: 'sleeper.getMatchups',
      params: { leagueId, week },
      id: 2,
    });
    
    // Process and send notifications
    const activity = {
      transactions: transactions.data.result,
      matchups: matchups.data.result,
      timestamp: new Date().toISOString(),
    };
    
    // Send to your notification service
    // await notificationService.send(activity);
    
    res.json({ status: 'processed', activity });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log('Webhook server running on port 3001');
});
```

## Best Practices

1. **Error Handling**: Always check for errors in the JSON-RPC response
2. **Rate Limiting**: Respect the 1000 requests/minute limit
3. **Caching**: Leverage the server's built-in caching for better performance
4. **Batch Requests**: Use batch JSON-RPC requests when making multiple calls
5. **Authentication**: The MCP server doesn't require auth, but implement your own if exposing publicly

## Advanced Query Example

```javascript
// Complex query to analyze league performance
async function analyzeLeaguePerformance(client, leagueId, weeks) {
  const analysis = {
    league: await client.call('sleeper.getLeague', { leagueId }),
    rosters: await client.call('sleeper.getRosters', { leagueId }),
    users: await client.call('sleeper.getUsers', { leagueId }),
    weeklyPerformance: [],
  };

  // Get matchups for each week
  for (const week of weeks) {
    const matchups = await client.call('sleeper.getMatchups', { 
      leagueId, 
      week 
    });
    
    analysis.weeklyPerformance.push({
      week,
      matchups,
      avgScore: matchups.reduce((sum, m) => sum + (m.points || 0), 0) / matchups.length,
    });
  }

  // Calculate standings
  const standings = {};
  analysis.rosters.forEach(roster => {
    standings[roster.roster_id] = {
      wins: roster.settings.wins || 0,
      losses: roster.settings.losses || 0,
      points_for: roster.settings.fpts || 0,
      roster,
      user: analysis.users.find(u => u.user_id === roster.owner_id),
    };
  });

  analysis.standings = Object.values(standings)
    .sort((a, b) => b.wins - a.wins || b.points_for - a.points_for);

  return analysis;
}
```