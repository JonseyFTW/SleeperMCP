const http = require('http');

// Test JSON-RPC endpoint
const testRPC = () => {
  const postData = JSON.stringify({
    jsonrpc: '2.0',
    method: 'sleeper.getNFLState',
    params: {},
    id: 1
  });

  const options = {
    hostname: 'localhost',
    port: 8086,
    path: '/rpc',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    console.log(`✅ RPC Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('✅ RPC Response received:', !!response.result);
        testCacheEndpoints();
      } catch (e) {
        console.log('❌ RPC Response parse error:', e.message);
      }
    });
  });

  req.on('error', (e) => {
    console.log('❌ RPC Request error:', e.message);
  });

  req.write(postData);
  req.end();
};

// Test cache endpoints
const testCacheEndpoints = () => {
  const endpoints = [
    '/health',
    '/cache/stats', 
    '/cache/health',
    '/cache/performance'
  ];

  endpoints.forEach((endpoint, index) => {
    setTimeout(() => {
      const req = http.request({
        hostname: 'localhost',
        port: 8086,
        path: endpoint,
        method: 'GET'
      }, (res) => {
        console.log(`✅ ${endpoint}: ${res.statusCode}`);
        
        if (index === endpoints.length - 1) {
          console.log('🎉 All tests completed!');
          process.exit(0);
        }
      });
      
      req.on('error', (e) => {
        console.log(`❌ ${endpoint}: ${e.message}`);
      });
      
      req.end();
    }, index * 500);
  });
};

console.log('🧪 Testing MCP Server...');
testRPC();