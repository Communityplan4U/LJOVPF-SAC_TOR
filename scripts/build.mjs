import {readFile,writeFile,cp,rm,mkdir} from 'node:fs/promises';
import {AREA_IDS,POSITION_WEIGHTS,validateAssessment} from '../public/js/scoring.js';

const wb=JSON.parse(await readFile('data/assessment.json','utf8'));
const m=JSON.parse(await readFile('data/methodology.json','utf8'));
const issues=validateAssessment(wb);
if(issues.length)throw Error('Assessment is invalid:\n'+issues.join('\n'));
if(m.version!==wb.schema_version)throw Error('Assessment methodology version mismatch');
if(JSON.stringify(m.position_weights)!==JSON.stringify(POSITION_WEIGHTS))throw Error('Governance rank weights mismatch');
if(JSON.stringify(m.governance_areas)!==JSON.stringify(wb.areas))throw Error('Governance area methodology mismatch');
if(JSON.stringify(wb.areas.map(a=>a.id))!==JSON.stringify(AREA_IDS) || wb.areas.some((a,i)=>a.rank!==i+1 || a.weight!==POSITION_WEIGHTS[i]))throw Error('Governance area order or weights mismatch');

// Match the Framework Tool's generated browser data; source JSON stays in data/.
const safe=x=>JSON.stringify(x).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
await writeFile('dist/js/data.js',`'use strict';\nwindow.LJOV_ASSESSMENT=${safe(wb)};\nwindow.LJOV_METHODOLOGY=${safe(m)};\n`);
console.log(`Built SAC assessment: ${wb.areas.length} governance areas / ${wb.components.length} criteria and ${wb.comparators.length} advisory bodies; methodology ${m.version}; ${wb.published?'approved':'pending approval'}`);
