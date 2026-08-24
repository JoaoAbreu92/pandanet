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
files.push('c:/Users/ultim/Music/intranet/PandaNet/components/WhatsPanda.tsx');

files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/tracking-tighter/g, 'tracking-tight');
    content = content.replace(/font-black/g, 'font-bold');
    
    // Add scroll to large WhatsPanda forms/modals
    content = content.replace(
        /w-full max-w-(2xl|xl) mx-auto border border-white\/20 dark:border-white\/5 animate-in fade-in zoom-in duration-500/g,
        "w-full max-w-$1 mx-auto border border-white/20 dark:border-white/5 animate-in fade-in zoom-in duration-500 max-h-[85vh] overflow-y-auto custom-scrollbar"
    );

    // Don't add it multiple times if run twice
    content = content.replace(/(max-h-\[85vh\] overflow-y-auto custom-scrollbar )+max-h-\[85vh\] overflow-y-auto custom-scrollbar/g, 'max-h-[85vh] overflow-y-auto custom-scrollbar');

    fs.writeFileSync(f, content);
});
console.log('done');
