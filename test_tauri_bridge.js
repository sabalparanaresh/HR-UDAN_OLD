import fs from 'fs';

const rawPayloadData = JSON.stringify({ cmd: "get_company_config", args: {} });
const bytes = new TextEncoder().encode(rawPayloadData);
const hexData = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

fetch('http://127.0.0.1:3000/api/data-sync', {
  method: 'POST',
  headers: { 
    'Content-Type': 'text/plain',
    'x-app-token': 'dev-api-key',
    'x-payload-encoding': 'hex'
  },
  body: hexData
}).then(async res => {
  console.log('STATUS:', res.status);
  console.log('CONTENT-TYPE:', res.headers.get('content-type'));
  const text = await res.text();
  console.log('BODY:', text.substring(0, 300));
}).catch(err => {
  console.error("FETCH ERROR:", err);
});
