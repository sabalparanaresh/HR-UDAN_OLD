import fs from 'fs';
import path from 'path';

function findMaps(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(findMaps(file));
    } else if (file.endsWith('.map')) {
      results.push(file);
    }
  });
  return results;
}

const maps = findMaps('dist/assets');
let found = false;

for (const mapFile of maps) {
  const data = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  if (data.sources) {
    const idx = data.sources.findIndex(s => s.includes('AttendanceEntry.tsx'));
    if (idx !== -1) {
      if (data.sourcesContent && data.sourcesContent[idx]) {
        fs.writeFileSync('src/pages/transactions/AttendanceEntry.tsx', data.sourcesContent[idx]);
        console.log('Restored from', mapFile);
        found = true;
        break;
      }
    }
  }
}
if (!found) console.log('Not found in source maps');
