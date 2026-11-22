import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('public/data',{recursive:true});
await copyFile('data/assessment.json','public/data/assessment.json');
console.log('Copied the authoritative assessment matrix into public assets.');
