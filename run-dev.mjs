import { spawn } from 'child_process';

const cp = spawn('npm', ['run', 'dev']);

cp.stdout.on('data', data => console.log('STDOUT:', data.toString()));
cp.stderr.on('data', data => console.error('STDERR:', data.toString()));

setTimeout(() => {
    cp.kill();
    console.log("Killed after 5 seconds");
    process.exit(0);
}, 5000);
