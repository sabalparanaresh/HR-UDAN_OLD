fetch('http://127.0.0.1:3000/api/tauri', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cmd: 'get_connection_status', args: {} })
}).then(r=>r.json()).then(console.log).catch(console.error);
