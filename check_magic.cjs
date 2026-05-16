const fs = require('fs');
const buffer = fs.readFileSync('statutory.db');
console.log(buffer.toString('utf8', 0, 16));
