import fs from 'fs';
import path from 'path';

const content = fs.readFileSync('src/pages/employee/EmployeeMaster.tsx', 'utf-8');

// We know the file is massive. Let's just create an empty hook file and an empty schema file to start.
// This allows us to gradually move stuff.
fs.mkdirSync('src/pages/employee/hooks', { recursive: true });
fs.mkdirSync('src/pages/employee/components', { recursive: true });
fs.mkdirSync('src/pages/employee/types', { recursive: true });

console.log("Directories created.");
