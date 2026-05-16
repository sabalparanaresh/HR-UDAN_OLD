const http = require('http');

const payload = '7b22636d64223a226765745f636f6e6e656374696f6e5f737461747573222c2261726773223a7b7d7d'; // {"cmd":"get_connection_status","args":{}}

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/data-sync',
  method: 'POST',
  headers: {
    'Content-Type': 'text/plain',
    'x-app-token': 'dev-api-key',
    'x-payload-encoding': 'hex'
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

req.write(payload);
req.end();
