fetch('http://127.0.0.1:3000/api/health').then(r=>r.json()).then(console.log).catch(console.error);
