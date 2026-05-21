import fs from 'fs';

let content = fs.readFileSync('src-server/domains/rpc/routes.ts', 'utf8');

// Fix duplicate variable declarations
content = content.replace(/(const primaryDb = \(req as any\)\.primaryDb;\n  const statutoryDb = \(req as any\)\.statutoryDb;\n  const dbState = \(req as any\)\.dbState;\n)+/g, "  const primaryDb = (req as any).primaryDb;\n  const statutoryDb = (req as any).statutoryDb;\n  const dbState = (req as any).dbState;\n");

// Add missing imports
if (!content.includes('import jwt')) {
  content = "import jwt from 'jsonwebtoken';\n" + content;
}
if (!content.includes('import { CONFIG }')) {
  content = "import { CONFIG } from '../../config.js';\n" + content;
}
if (!content.includes('import { CommandContext }')) {
  content = "import { CommandContext } from '../../commands/types.js';\n" + content;
}

fs.writeFileSync('src-server/domains/rpc/routes.ts', content);
