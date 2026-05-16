const http = require('http');

const req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/data-sync',
  method: 'POST',
  headers: {
    'Content-Type': 'text/plain',
    'x-app-token': 'dev-api-key',
    'x-payload-encoding': 'hex'
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(res.statusCode, body));
});

const rawPayloadData = JSON.stringify({ cmd: "get_company_config", args: {} });
const bytes = new TextEncoder().encode(rawPayloadData);
const hexData = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
req.write(hexData);
req.end();
