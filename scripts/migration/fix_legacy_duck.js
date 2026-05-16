import fs from 'fs';

let router = fs.readFileSync('src-server/legacyRouter.ts', 'utf8');

router = `import { DuckDBAnalyticsRepo } from './services/DuckDBAnalytics.js';\n` + router;

const regex = /\s*const analyticsDb = new duckdb\.Database\(':memory:'\);\s*const DuckDBAnalyticsRepo = \{[\s\S]*?\n\s*\};\s*/;

router = router.replace(regex, '\n\n  ');

fs.writeFileSync('src-server/legacyRouter.ts', router);
