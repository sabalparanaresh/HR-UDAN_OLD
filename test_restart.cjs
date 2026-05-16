const http = require('http');

http.get('http://127.0.0.1:3000/api/master-data', res => {
  console.log("Master-data success");
  process.exit(0);
}).on('error', () => {
  console.log("Master-data error");
});
