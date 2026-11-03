import { readFileSync, writeFileSync } from 'fs';
const content = readFileSync('views/index.ejs', 'utf8');
const marker = '<script src="/assets/js/core/firebase-config.js">';
const jsStart = content.indexOf(marker);
const jsPart = content.slice(jsStart);
writeFileSync('views/index_js_backup.txt', jsPart, 'utf8');
console.log('JS backup length:', jsPart.length);
