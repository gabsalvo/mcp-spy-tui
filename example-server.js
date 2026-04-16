import http from 'http';

const PORT = 3000;

// This is a fake MCP target server that just echoes back a JSON-RPC response
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    // Simulate a tiny bit of processing delay (50-200ms)
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      
      let method = 'unknown';
      try {
        if (body) {
          const parsed = JSON.parse(body);
          method = parsed.method || 'unknown';
        }
      } catch(e) {}

      // Fake JSON-RPC Response
      res.end(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: { 
          status: "success",
          message: `Successfully executed: ${method}`, 
          mockData: [
            {"id": "user_1", "role": "admin"},
            {"id": "user_2", "role": "viewer"}
          ]
        }
      }));
    }, Math.floor(Math.random() * 150) + 50);
  });
});

server.listen(PORT, () => {
  console.log(`🤖 Dummy Target MCP Server listening on port ${PORT}...`);
});
