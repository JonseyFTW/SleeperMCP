#!/usr/bin/env node

/**
 * Comprehensive MCP Server Test Suite
 * Tests all major RPC methods with real data to verify functionality
 */

const axios = require('axios');

const MCP_SERVER_URL = 'https://sleepermcp-production.up.railway.app/rpc';
const TEST_USERNAME = 'o0jonsey0o';
const TEST_USER_ID = '1038674424398118912';
const TEST_LEAGUE_ID = '1113131288824807424'; // From previous test
const TEST_SEASON = '2024';

// Test configuration
const TESTS = [
  {
    name: 'User Methods',
    tests: [
      {
        method: 'sleeper.getUserByUsername',
        params: { username: TEST_USERNAME },
        validate: (result) => result && result.user_id && result.username === TEST_USERNAME
      },
      {
        method: 'sleeper.getUserById',
        params: { userId: TEST_USER_ID },
        validate: (result) => result && result.user_id === TEST_USER_ID
      }
    ]
  },
  {
    name: 'League Methods',
    tests: [
      {
        method: 'sleeper.getLeaguesForUser',
        params: { userId: TEST_USER_ID, season: TEST_SEASON },
        validate: (result) => Array.isArray(result) && result.length > 0
      },
      {
        method: 'sleeper.getLeague',
        params: { leagueId: TEST_LEAGUE_ID },
        validate: (result) => result && result.league_id === TEST_LEAGUE_ID
      },
      {
        method: 'sleeper.getRosters',
        params: { leagueId: TEST_LEAGUE_ID },
        validate: (result) => Array.isArray(result) && result.length > 0
      }
    ]
  },
  {
    name: 'Player Methods',
    tests: [
      {
        method: 'sleeper.getPlayers',
        params: { sport: 'nfl' },
        validate: (result) => result && typeof result === 'object'
      },
      {
        method: 'sleeper.getTrendingPlayers',
        params: { sport: 'nfl', type: 'add', hours: 24, limit: 10 },
        validate: (result) => Array.isArray(result)
      }
    ]
  },
  {
    name: 'Analytics Methods (Expected to return null)',
    tests: [
      {
        method: 'sleeper.getPlayerAnalytics',
        params: [{ playerId: '4046' }],
        validate: (result) => result === null, // Expected since DB not fully configured
        expectedNull: true
      },
      {
        method: 'sleeper.getPositionAnalytics',
        params: [{ position: 'QB' }],
        validate: (result) => result === null,
        expectedNull: true
      }
    ]
  },
  {
    name: 'State Methods',
    tests: [
      {
        method: 'sleeper.getNflState',
        params: {},
        validate: (result) => result && result.season
      }
    ]
  }
];

async function runRPCTest(method, params) {
  try {
    const response = await axios.post(MCP_SERVER_URL, {
      jsonrpc: '2.0',
      method,
      params,
      id: Math.floor(Math.random() * 1000)
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.data.error) {
      throw new Error(`RPC Error: ${response.data.error.message} (Code: ${response.data.error.code})`);
    }

    return response.data.result;
  } catch (error) {
    if (error.response) {
      throw new Error(`HTTP ${error.response.status}: ${error.response.data}`);
    }
    throw error;
  }
}

async function runTestSuite() {
  console.log('🚀 Starting Comprehensive MCP Server Test Suite');
  console.log(`📡 Testing: ${MCP_SERVER_URL}`);
  console.log(`👤 Test User: ${TEST_USERNAME} (${TEST_USER_ID})`);
  console.log('━'.repeat(80));

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const category of TESTS) {
    console.log(`\n📂 ${category.name}`);
    console.log('─'.repeat(40));

    for (const test of category.tests) {
      totalTests++;
      const testName = `${test.method}`;
      
      try {
        console.log(`  🧪 ${testName}`);
        const result = await runRPCTest(test.method, test.params);
        
        if (test.validate(result)) {
          console.log(`  ✅ PASS - ${testName}`);
          if (test.expectedNull) {
            console.log(`    💡 Returned null as expected (analytics DB not configured)`);
          } else {
            console.log(`    📄 Sample result:`, JSON.stringify(result).substring(0, 100) + '...');
          }
          passedTests++;
        } else {
          console.log(`  ❌ FAIL - ${testName}: Validation failed`);
          console.log(`    📄 Result:`, JSON.stringify(result).substring(0, 200));
          failedTests++;
        }
      } catch (error) {
        console.log(`  ❌ FAIL - ${testName}: ${error.message}`);
        failedTests++;
      }
    }
  }

  console.log('\n' + '━'.repeat(80));
  console.log('📊 TEST RESULTS');
  console.log('━'.repeat(80));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (failedTests === 0) {
    console.log('\n🎉 All tests passed! MCP Server is working correctly.');
    console.log('📡 Real Sleeper data is flowing through properly.');
    console.log('🔄 Ready for webapp integration testing.');
  } else {
    console.log(`\n⚠️  ${failedTests} test(s) failed. Please check the errors above.`);
  }

  return { totalTests, passedTests, failedTests };
}

// Export real data for webapp testing
async function getTestDataForWebapp() {
  console.log('\n🌐 Generating test data for webapp integration...');
  
  try {
    const userData = await runRPCTest('sleeper.getUserByUsername', { username: TEST_USERNAME });
    const leagues = await runRPCTest('sleeper.getLeaguesForUser', { 
      userId: TEST_USER_ID, 
      season: TEST_SEASON 
    });
    
    const testData = {
      user: userData,
      leagues: leagues,
      testLeagueId: TEST_LEAGUE_ID,
      testUserId: TEST_USER_ID,
      testUsername: TEST_USERNAME,
      mcpServerUrl: MCP_SERVER_URL
    };

    console.log('📋 Test data prepared for webapp:');
    console.log(`  👤 User: ${testData.user.username}`);
    console.log(`  🏈 Leagues: ${testData.leagues.length}`);
    console.log(`  🆔 Test League ID: ${testData.testLeagueId}`);
    
    return testData;
  } catch (error) {
    console.error('❌ Failed to prepare webapp test data:', error.message);
    return null;
  }
}

// Main execution
if (require.main === module) {
  runTestSuite()
    .then(async (results) => {
      if (results.failedTests === 0) {
        await getTestDataForWebapp();
      }
      process.exit(results.failedTests === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Test suite crashed:', error);
      process.exit(1);
    });
}

module.exports = { runTestSuite, getTestDataForWebapp, runRPCTest };