import fs from 'fs';

let content = fs.readFileSync('src-server/domains/rpc/routes.ts', 'utf8');

// Fix duplicate variable declarations globally
content = content.replace(/(const primaryDb = \(req as any\)\.primaryDb;\s*?const statutoryDb = \(req as any\)\.statutoryDb;\s*?const dbState = \(req as any\)\.dbState;\s*?\n)+/g, "  const primaryDb = (req as any).primaryDb;\n  const statutoryDb = (req as any).statutoryDb;\n  const dbState = (req as any).dbState;\n");

fs.writeFileSync('src-server/domains/rpc/routes.ts', content);
