import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AREA_IDS,POSITION_WEIGHTS,areaResult,comparison,validOrder,validateAssessment,weightsFor,totalScore} from '../public/js/scoring.js';
const data=JSON.parse(readFileSync(new URL('../data/assessment.json',import.meta.url),'utf8'));
function fixture(){return structuredClone(data);}
function approveFixture(f){
 f.published=true;f.assessment_status='approved';
 for(const body of f.comparators.filter(x=>x.url&&x.id!=='ljovpf'))
  for(const c of f.components) f.judgments[body.id][c.id]={rating:0,rationale:'Test-only fixture, not a published assessment',ljovpf_excerpt:'TEST',comparator_excerpt:'TEST',source_section:'TEST'};
 return f;
}
test('exact agreed five positions and weights',()=>{
 assert.deepEqual(POSITION_WEIGHTS,[30,25,20,15,10]);
 assert.deepEqual(Object.values(weightsFor(AREA_IDS)),POSITION_WEIGHTS);
 assert.equal(Object.values(weightsFor(AREA_IDS)).reduce((a,b)=>a+b,0),100);
 assert.equal(validOrder(['G1','G2','G3','G3','G4']),false);
});
test('source has exactly 12 TOR-only components; Weston unverified and unrated',()=>{
 assert.equal(data.components.length,12);
 assert.equal(data.areas.length,5);
 assert.equal(data.comparators.length,11);
 assert.equal(data.comparators.find(x=>x.id==='comp2').url,null);
 assert.equal(validateAssessment(data).length,0);
 assert.equal(data.published,false);
 assert.ok(comparison(data).every(c=>c.score===null&&c.rank===null));
});
test('no fabricated ratings appear: missing cells cannot be counted as zero',()=>{
 const f=approveFixture(fixture());
 f.judgments.comp1['G1-01'].rating=null;
 assert.equal(totalScore(f,'comp1'),null);
 assert.equal(comparison(f).find(c=>c.id==='comp1').rank,null);
 assert.ok(validateAssessment(f).some(x=>x.includes('Unrated comp1/G1-01')));
});
test('baseline returns zero for equal terms and excludes Weston',()=>{
 const f=approveFixture(fixture());
 assert.equal(totalScore(f,'ljovpf'),0);
 assert.equal(totalScore(f,'comp1'),0);
 const ranked=comparison(f);
 assert.equal(ranked.filter(x=>x.rank!==null).length,10);
 assert.equal(ranked.find(x=>x.id==='comp2').rank,null);
 assert.equal(ranked.filter(x=>x.rank===1).length,10);
});
test('one area advantage receives exactly that area share of the 12-point scale',()=>{
 const f=approveFixture(fixture());
 for(const c of f.components.filter(c=>c.area==='G1'))f.judgments.comp1[c.id].rating=1;
 assert.ok(Math.abs(totalScore(f,'comp1')-3.6)<1e-9);
 assert.equal(areaResult(f,'comp1','G1',AREA_IDS,false),2);
 const revised=['G2','G3','G5','G4','G1'];
 assert.ok(Math.abs(totalScore(f,'comp1',revised)-1.2)<1e-9);
 assert.equal(totalScore(f,'ljovpf',revised),0);
});
test('an overall -1 across 12 components stays -12 with any rankings',()=>{
 const f=approveFixture(fixture());
 for(const c of f.components)f.judgments.comp1[c.id].rating=-1;
 assert.ok(Math.abs(totalScore(f,'comp1')+12)<1e-8);
 assert.ok(Math.abs(totalScore(f,'comp1',['G4','G5','G3','G2','G1'])+12)<1e-8);
});
test('Background & origin contributes through G5-02 only; no independent fixed term',()=>{
 const f=approveFixture(fixture());
 f.judgments.comp1['G5-02'].rating=1;
 const score=totalScore(f,'comp1');
 assert.ok(Math.abs(score - 12*0.15/3)<1e-9);
 assert.ok(Math.abs(totalScore(f,'comp1',['G4','G3','G2','G1','G5']) - 12*0.10/3)<1e-9);
});
