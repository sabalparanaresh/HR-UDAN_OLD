import fs from 'fs';

const content = fs.readFileSync('src/pages/employee/EmployeeMaster.tsx', 'utf-8');
const lines = content.split('\n');

// Types and Schema are roughly from line 64 (after imports) to 257 (before default export)
let schemaStartIndex = lines.findIndex(l => l.includes('const employeeSchema = z.object({'));
let schemaEndIndex = lines.findIndex(l => l.includes('interface SalaryHead {'));

if (schemaStartIndex !== -1 && schemaEndIndex !== -1) {
    const typesAndSchema = lines.slice(schemaStartIndex, schemaEndIndex + 4).join('\n'); // +4 to capture the SalaryHead block
    
    // Create new file
    const newFileContent = `import { z } from 'zod';\n\n` + typesAndSchema + `\n\nexport type { EmployeeData, SelectOption, SlabComponent, SalarySlab, SalaryHead };\nexport { employeeSchema };\n`;
    
    fs.writeFileSync('src/pages/employee/types/index.ts', newFileContent);
    console.log("Types and schema extracted successfully");
    
    // Now remove it from original and add import
    const newOriginalLines = [
        ...lines.slice(0, schemaStartIndex),
        `import { employeeSchema, type EmployeeData, type SelectOption, type SlabComponent, type SalarySlab, type SalaryHead } from './types';`,
        ...lines.slice(schemaEndIndex + 4) // Skipping the block
    ];
    
    fs.writeFileSync('src/pages/employee/EmployeeMaster.tsx', newOriginalLines.join('\n'));
    console.log("Original file modified.");
} else {
    console.log("Could not find boundaries", schemaStartIndex, schemaEndIndex);
}
