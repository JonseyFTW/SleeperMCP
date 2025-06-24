#!/usr/bin/env node

/**
 * Test script for MCP endpoints
 */

const https = require('https');

const SERVER_URL = 'https://sleepermcp-staging.up.railway.app';

function makeRequest(path, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'sleepermcp-staging.up.railway.app',
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (error) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function testMCP() {
  console.log('🧪 Testing MCP endpoints...\n');

  try {
    // Test 1: Initialize
    console.log('1️⃣ Testing MCP initialize...');
    const initResponse = await makeRequest('/mcp', {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      },
      id: 1
    });
    
    console.log('   Status:', initResponse.status);
    console.log('   Response:', JSON.stringify(initResponse.data, null, 2));
    console.log('');

    // Test 2: Tools list
    console.log('2️⃣ Testing tools/list...');
    const toolsResponse = await makeRequest('/mcp', {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 2
    });
    
    console.log('   Status:', toolsResponse.status);
    console.log('   Response:', JSON.stringify(toolsResponse.data, null, 2));
    console.log('');

    // Test 3: Sample tool call
    console.log('3️⃣ Testing tool call (get_nfl_state)...');
    const toolCallResponse = await makeRequest('/mcp', {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get_nfl_state',
        arguments: {}
      },
      id: 3
    });
    
    console.log('   Status:', toolCallResponse.status);
    console.log('   Response:', JSON.stringify(toolCallResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMCP();