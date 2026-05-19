import { exec } from 'child_process';

const cp = exec('npx tsx server.ts', (err, stdout, stderr) => {
    console.log("STDOUT:", stdout);
    console.error("STDERR:", stderr);
});

setTimeout(() => {
    cp.kill();
    console.log("Killed after 6 seconds");
}, 6000);
