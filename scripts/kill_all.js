import fs from 'fs';
const dirs = fs.readdirSync("/proc").filter(d => /^\d+$/.test(d)); 
dirs.forEach(d => { 
  try { 
    const cmd = fs.readFileSync(`/proc/${d}/cmdline`, "utf8").split("\0").join(" "); 
    if (cmd.includes("server.ts") || (cmd.includes("tsx") && !cmd.includes("kill"))) {
      console.log("Killing:", d, cmd);
      process.kill(parseInt(d), 'SIGKILL');
    }
  } catch(e) {} 
});
