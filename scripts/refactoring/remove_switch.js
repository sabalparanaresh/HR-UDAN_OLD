import fs from 'fs';

let router = fs.readFileSync('src-server/legacyRouter.ts', 'utf8');

const regex = /switch \(cmd\) \{[\s\S]*?default:\n\s*res\.status\(404\)\.json\(\{\s*error: \`Command \$\{cmd\} not implemented in emulator\`\s*\}\);\n\s*\}/;

const match = router.match(regex);
if (match) {
  router = router.replace(regex, `res.status(404).json({ error: \`Command \${cmd} not implemented in emulator\` });`);
  fs.writeFileSync('src-server/legacyRouter.ts', router);
  console.log("Huge switch block removed and replaced with 404!");
} else {
  console.log("Could not find the switch block to replace.");
}
