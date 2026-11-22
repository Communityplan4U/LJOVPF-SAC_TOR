import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdtemp,mkdir,readFile,rm,writeFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

const source=fileURLToPath(new URL('../',import.meta.url));
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'sac-build-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 await Promise.all(['public','data','package.json'].map(path=>cp(join(source,path),join(root,path),{recursive:true})));
 await mkdir(join(root,'scripts'));
 await cp(join(source,'scripts/build.mjs'),join(root,'scripts/build.mjs'));
 return root;
}
function build(root){return execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root,encoding:'utf8',stdio:'pipe'});}

test('Built page loads complete source data safely without duplicate CSS or JSON assets',async t=>{
 const root=await fixture(t);
 const assessment=JSON.parse(await readFile(join(root,'data/assessment.json'),'utf8'));
 const methodology=JSON.parse(await readFile(join(root,'data/methodology.json'),'utf8'));
 assessment.assessment_scope='Written TOR text: </script><script>bad()</script>\u2028\u2029';
 await writeFile(join(root,'data/assessment.json'),JSON.stringify(assessment));
 // A rebuild must discard old output, including the former copied JSON asset.
 await mkdir(join(root,'dist/data'),{recursive:true});
 await writeFile(join(root,'dist/data/assessment.json'),'stale');
 build(root);
 const script=await readFile(join(root,'dist/js/data.js'),'utf8');
 assert.doesNotMatch(script,/[<\u2028\u2029]/);
 const context={window:{}};
 vm.runInNewContext(script,context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.window.LJOV_ASSESSMENT)),assessment);
 assert.deepEqual(JSON.parse(JSON.stringify(context.window.LJOV_METHODOLOGY)),methodology);
 const html=await readFile(join(root,'dist/index.html'),'utf8');
 const scripts=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match=>match[1]);
 assert.ok(scripts.indexOf('js/data.js')>=0 && scripts.indexOf('js/data.js')<scripts.indexOf('js/app.js'));
 for(const path of scripts)await access(join(root,'dist',path));
 assert.equal(await readFile(join(root,'dist/css/survey.css'),'utf8'),await readFile(join(root,'public/css/survey.css'),'utf8'));
 for(const path of ['public/data/assessment.json','dist/data/assessment.json','public/css/style.css','dist/css/style.css']){
  await assert.rejects(access(join(root,path)),{code:'ENOENT'});
 }
});

test('Build rejects methodology weights that disagree with SAC scoring',async t=>{
 const root=await fixture(t);
 const path=join(root,'data/methodology.json');
 const methodology=JSON.parse(await readFile(path,'utf8'));
 methodology.position_weights=[40,25,15,10,10];
 await writeFile(path,JSON.stringify(methodology));
 assert.throws(()=>build(root),/Governance rank weights mismatch/);
});
