import fs from 'fs';

let content = fs.readFileSync('src-server/commands/reports.ts', 'utf8');

// The code runs like:
// const runDuckDBQuery = (sql: string): Promise<any[]> => new Promise((resolve, reject) => {
//    analyticsDb.all(sql, (err, rows) => {
//      if (err) reject(err);
//      else resolve(rows);
//    });
// });
// Or: analyticsDb.all(sql, ...params, (err, rows) => {

content = content.replace(/const runDuckDBQuery = \(sql: string\): Promise<any\[\]> => new Promise\(\(resolve, reject\) => \{\s*analyticsDb\.all\(sql, \(err, rows\) => \{\s*if \(err\) reject\(err\);\s*else resolve\(rows\);\s*\}\);\s*\}\);/g, 'const runDuckDBQuery = (sql: string): Promise<any[]> => DuckDBAnalyticsRepo.runQuery(sql);');

let matchRegex = /analyticsDb\.all\(([^,]+), \.\.\.params, \(err, rows\) => {([^}]+)}\);/m;
content = content.replace(/analyticsDb\.all\(([^,]+), \.\.\.params, \(err, rows\) => \{\s*if \(err\) reject\(err\);\s*else resolve\(rows\);\s*\}\);/g, 'DuckDBAnalyticsRepo.runQuery($1, params).then(resolve).catch(reject);');

fs.writeFileSync('src-server/commands/reports.ts', content);
