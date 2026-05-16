const http = require('http');

const req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/ping',
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

req.write('helloworld');
req.end();
