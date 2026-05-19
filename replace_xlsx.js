import fs from 'fs';
import path from 'path';

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Revert await XLSX.writeFile to just XLSX.writeFile
    content = content.replace(/await\s+XLSX\.writeFile\(/g, 'XLSX.writeFile(');
    
    fs.writeFileSync(filePath, content, 'utf8');
}

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            if (fs.readFileSync(fullPath, 'utf8').includes('XLSX.writeFile')) {
                console.log('Processing', fullPath);
                replaceInFile(fullPath);
            }
        }
    }
}

processDirectory('src');
console.log('Done');
