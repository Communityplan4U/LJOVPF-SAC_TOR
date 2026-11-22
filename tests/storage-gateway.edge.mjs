import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import gateway from '../server/gateway.cjs';
const {GatewayRepository,configured}=gateway;
const saved={SUPABASE_URL:process.env.SUPABASE_URL,SURVEY_GATEWAY_TOKEN:process.env.SURVEY_GATEWAY_TOKEN};
const token=crypto.randomBytes(48).toString('base64url'),admin=crypto.randomBytes(48).toString('base64url');
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const vars={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'eyJ'+'.'.repeat(20)};
let edge;
globalThis.Deno={env:{get:key=>vars[key]},serve:fn=>{edge=fn;}};
// Test the deployed digest-in-source design without committing its private token.
// Substitute an ephemeral test token fingerprint into a temporary TS module.
const source=await readFile(new URL('../supabase/functions/survey-storage/index.ts',import.meta.url),'utf8');
const testSource=source.replace(/const PUBLIC_DIGEST='[a-f0-9]{64}';/,"const PUBLIC_DIGEST='"+digest(token)+"';");
if(testSource===source)throw Error('Public digest constant missing from Edge Function');
const testFolder=await mkdtemp(join(tmpdir(),'sac-gateway-edge-'));
try{
 await writeFile(join(testFolder,'index.ts'),testSource);
 await import(pathToFileURL(join(testFolder,'index.ts')).href);
}finally{await rm(testFolder,{recursive:true,force:true});}
function call(name,args,key=token){return edge(new Request('https://example.supabase.co/functions/v1/survey-storage',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({name,args})}));}
const ranking=['G1','G2','G3','G5','G4'];
const row={id:'cda6cc17-94ad-4a87-8cc6-374a09b9aa32',token_hash:crypto.createHash('sha256').update('subject').digest('hex'),version:'tor12-v1',ranking,connections:['resident'],email:null,newsletter_opt_in:false,planning_opt_in:false,feedback:'Community authority',revision:1};
const originalFetch=globalThis.fetch;
let requests=[];
async function fakeFetch(url,opts={}){
 requests.push({url:String(url),method:opts.method||'GET',headers:opts.headers,body:opts.body&&JSON.parse(opts.body)});
 let data=null,status=200;
 if(String(url).includes('/rpc/ljovsac_public_average'))data={count:1,averages:{G1:30,G2:25,G3:20,G5:15,G4:10}};
 else if(opts.method==='POST')data=[{...row,created_at:'2026-11-22T00:00:00Z',updated_at:'2026-11-22T00:00:00Z'}];
 else if(opts.method==='PATCH')data=[{...row,...JSON.parse(opts.body),created_at:'2026-11-22T00:00:00Z'}];
 else if(opts.method==='GET')data=[row];
 else if(opts.method==='DELETE'){status=204;}
 return new Response(status===204?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
}
test('Edge refuses public and unknown operations, and does not contact database',async()=>{
 requests=[];globalThis.fetch=fakeFetch;
 try{
  const unauth=await edge(new Request('https://example.supabase.co/functions/v1/survey-storage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'get_response',args:{id:row.id}})}));
  assert.equal(unauth.status,401);
  assert.equal((await call('not_a_real_operation',{})).status,400);
  assert.equal((await call('export_responses',{offset:0,limit:500})).status,400);
  assert.equal((await call('get_response',{id:'no'})).status,422);
  assert.equal(requests.length,0);
 }finally{globalThis.fetch=originalFetch;}
});
test('Edge performs bounded, authorized CRUD and aggregate operations',async()=>{
 requests=[];globalThis.fetch=fakeFetch;
 try{
  let inserted=await call('insert_response',{row});assert.equal(inserted.status,200);assert.equal((await inserted.json()).id,row.id);
  const got=await call('get_response',{id:row.id});assert.equal(got.status,200);assert.equal((await got.json()).token_hash,row.token_hash);
  const updated=await call('update_response',{id:row.id,revision:1,changes:{version:'tor12-v1',ranking,connections:[],email:null,newsletter_opt_in:false,planning_opt_in:false,feedback:null,revision:2,updated_at:new Date().toISOString()}});
  assert.equal(updated.status,200);assert.equal((await updated.json()).revision,2);
  const average=await call('community_average',{});assert.equal(average.status,200);assert.equal((await average.json()).averages.G1,30);
  assert.equal((await call('delete_response',{id:row.id})).status,200);
  assert.deepEqual(requests.map(x=>x.method),['POST','GET','PATCH','POST','DELETE']);
  assert.ok(requests.every(x=>x.url.startsWith(vars.SUPABASE_URL+'/rest/v1/')));
 }finally{globalThis.fetch=originalFetch;}
});
test('Retired administrator token cannot authorize any Edge operation',async()=>{
 requests=[];globalThis.fetch=fakeFetch;
 try{
  assert.equal((await call('export_responses',{offset:0,limit:500},admin)).status,401);
  assert.equal((await call('get_response',{id:row.id},admin)).status,401);
  assert.equal(requests.length,0);
 }finally{globalThis.fetch=originalFetch;}
});
test('Node gateway uses only the survey token and refuses raw export',async()=>{
 process.env.SUPABASE_URL=vars.SUPABASE_URL;process.env.SURVEY_GATEWAY_TOKEN=token;
 requests=[];const observed=[];globalThis.fetch=async(url,opts)=>{observed.push({url,opts});return new Response(JSON.stringify({count:0,averages:{}}),{status:200,headers:{'Content-Type':'application/json'}});};
 try{
  assert.equal(configured(),true);const repository=new GatewayRepository();await repository.aggregates();
  assert.equal(observed.length,1);assert.equal(observed[0].url,vars.SUPABASE_URL+'/functions/v1/survey-storage');
  assert.equal(observed[0].opts.headers.Authorization,'Bearer '+token);
  await assert.rejects(repository.call('export_responses',{offset:0,limit:500}),/Unsupported storage operation/);
  assert.equal(observed.length,1);
 }finally{globalThis.fetch=originalFetch;for(const k of Object.keys(saved)){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
