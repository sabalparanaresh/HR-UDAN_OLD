const express = require('express');
const app = express();
app.post('/', (req, res) => {
  console.log("HEADERS:", req.headers);
  res.send('ok');
});
app.listen(3001, () => {
  console.log("listening");
  const http = require('http');
  const req = http.request({
    port: 3001,
    method: 'POST',
    headers: { 'x-payload-encoding': 'hex' }
  }, res => process.exit(0));
  req.end();
});
