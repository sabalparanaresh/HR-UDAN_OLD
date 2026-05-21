const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        let stat = fs.statSync(file);
        if (stat && stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git') && !file.includes('dist')) { 
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.recovered') || file.endsWith('.bak')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('.');
files.forEach(f => {
    fs.unlinkSync(f);
    console.log('Deleted:', f);
});
if (files.length === 0) console.log('No recovered files found.');
