import fs from 'node:fs';
import {validateAssessment} from '../public/js/scoring.js';
const path=process.argv[2]||'data/assessment.json';
const data=JSON.parse(fs.readFileSync(path,'utf8'));
const issues=validateAssessment(data, process.argv.includes('--publish'));
if(issues.length){console.error('Assessment not valid:\n'+issues.map(x=>' - '+x).join('\n'));process.exit(1);}
console.log('Assessment structure valid. Publication status:',data.published?'APPROVED':'PENDING APPROVAL');
