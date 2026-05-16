const http = require('http');

http.get('http://127.0.0.1:3000/api/master-data', res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(res.statusCode, body));
});
