const http = require('http');

http.get('http://127.0.0.1:3000', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status code:', res.statusCode);
    console.log('Response body preview:', data.substring(0, 200));
  });
}).on('error', err => {
  console.error('Error fetching:', err.message);
});
