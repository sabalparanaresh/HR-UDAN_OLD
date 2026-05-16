const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/data-sync',
  method: 'POST',
  headers: {
    'Content-Type': 'text/plain',
    'x-app-token': 'dev-api-key'
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(`BODY: ${data.substring(0, 300)}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write('{"cmd":"get_company_config"}');
req.end();
