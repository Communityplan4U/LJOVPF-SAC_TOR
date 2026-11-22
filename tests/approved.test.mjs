import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {comparison,totalScore,weightsFor,validateAssessment} from '../public/js/scoring.js';
const data=JSON.parse(readFileSync(new URL('../data/assessment.json',import.meta.url),'utf8'));
const methodology=JSON.parse(readFileSync(new URL('../data/methodology.json',import.meta.url),'utf8'));
const expected={ljovpf:[0,11],comp1:[5.2,7],comp2:[4.4,10],comp3:[6,5],comp4:[5.9,6],comp5:[8.6,4],comp6:[11.2,1],comp7:[4.9,8],comp8:[9.4,2],comp9:[9.4,2],comp10:[4.8,9]};
test('approved workbook scores and ranks are reproduced exactly',()=>{
  assert.deepEqual(validateAssessment(data,true),[]);
  assert.equal(data.assessment_revision,'tor12-approved-20261122-120rows');
  for(const c of comparison(data)){
    assert.ok(Math.abs(c.score-expected[c.id][0])<1e-9,`${c.id} score`);
    assert.equal(c.rank,expected[c.id][1],`${c.id} rank`);
  }
});
test('governance default is 30/25/20/15/10 and governed by ranked positions',()=>{
 assert.deepEqual(data.areas.map(x=>[x.id,x.rank,x.weight]),[['G1',1,30],['G2',2,25],['G3',3,20],['G5',4,15],['G4',5,10]]);
 assert.deepEqual(methodology.governance_areas,data.areas);
 const reordered=weightsFor(['G4','G5','G3','G2','G1']);
 assert.deepEqual(reordered,{G4:30,G5:25,G3:20,G2:15,G1:10});
 assert.notEqual(totalScore(data,'comp1',['G4','G5','G3','G2','G1']),totalScore(data,'comp1'));
});
test('Weston verified PDF matches the approved source hash and every rating has citations',()=>{
 const document=data.comparators.find(x=>x.id==='comp2');
 assert.equal(document.source_state,'document-supplied');
 const tor=readFileSync(new URL('../public/'+document.url,import.meta.url));
 assert.equal(createHash('sha256').update(tor).digest('hex'),document.source_sha256);
 for(const body of data.comparators.filter(x=>x.id!=='ljovpf'))for(const c of data.components){
  const j=data.judgments[body.id][c.id];
  assert.match(j.approval_reference,/^Assessment Approval!A\d+:L\d+$/);
  for(const key of ['ljovpf_excerpt','comparator_excerpt','rationale','source_section'])assert.ok(j[key].trim().length>0,`${body.id}/${c.id}/${key}`);
  assert.equal(j.evidence_format,'TOR provision summaries, not verbatim quotations');
 }
});
test('an assessment with a missing approved judgment is rejected',()=>{
 const incomplete=structuredClone(data);
 incomplete.judgments.comp2['G4-03'].rating=null;
 assert.ok(validateAssessment(incomplete,true).some(x=>x.includes('Unrated comp2/G4-03')));
 assert.equal(comparison(incomplete).find(x=>x.id==='comp2').score,null);
});
