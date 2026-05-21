import fs from 'fs';

const content = fs.readFileSync('src-server/legacyRouter.ts', 'utf8');

console.log("File loaded. Total length:", content.length);

const functionRegex = /function (\w+)/g;
let m;
const functions = [];
while ((m = functionRegex.exec(content)) !== null) {
  functions.push(m[1]);
}

const constRegex = /export const (\w+)/g;
while ((m = constRegex.exec(content)) !== null) {
  functions.push(m[1]);
}

console.log("Functions defined:", functions);
