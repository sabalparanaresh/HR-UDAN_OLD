const fs = require('fs');
let router = fs.readFileSync('src-server/legacyRouter.ts', 'utf8');

const regex = /switch \(cmd\) \{[\s\S]*?default:\s*break;\s*\}/;
const match = router.match(regex);

if (match) {
   console.log("Found HUGE switch, length:", match[0].length);
} else {
   console.log("Not found with default: break;");
}
