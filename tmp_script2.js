const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('c:/Users/ultim/Music/intranet/PandaNet/components/whatspanda');

files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/tracking-tighter/g, 'tracking-tight');
    content = content.replace(/font-black/g, 'font-bold');
    fs.writeFileSync(f, content);
});
console.log('done replacing fonts font-black -> font-bold');
