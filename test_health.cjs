const http = require('http');

http.get({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/health'
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', d => process.stdout.write(d));
});
