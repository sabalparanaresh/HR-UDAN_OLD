import fs from 'fs';
import path from 'path';

function getCommands(dir) {
  let cmds = new Set();
  fs.readdirSync(dir).forEach(f => {
    let p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      getCommands(p).forEach(c => cmds.add(c));
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      let m = fs.readFileSync(p, 'utf8').match(/invoke(?:Command)?(?:<[^>]+>)?\(['"]([a-zA-Z_]+)['"]/g);
      if (m) m.forEach(x => cmds.add(x.match(/['"]([a-zA-Z_]+)['"]/)[1]));
    }
  });
  return cmds;
}

console.log(Array.from(getCommands('src')).join('\n'));
