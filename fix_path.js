import fs from 'fs';
import path from 'path';

function fixPath(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/import\s+\*\s+as\s+XLSX\s+from\s+'\.\.\/\.\.\/utils\/xlsx';/g, "import * as XLSX from '../utils/xlsx';");
    fs.writeFileSync(filePath, content, 'utf8');
}

fixPath('src/components/BulkBankUpload.tsx');
fixPath('src/components/layout/MasterPage.tsx'); // oh wait, layout is inside components/layout, so it should be ../../utils/xlsx!
