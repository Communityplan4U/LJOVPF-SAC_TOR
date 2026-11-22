import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import statusHandler from '../api/status.js';

const saved={SUPABASE_URL:process.env.SUPABASE_URL,SURVEY_GATEWAY_TOKEN:process.env.SURVEY_GATEWAY_TOKEN};
const originalFetch=globalThis.fetch;
after(()=>{
  globalThis.fetch=originalFetch;
  for(const [key,value] of Object.entries(saved)){
    if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
});
async function status(method='GET'){
  const response={headers:{},setHeader(name,value){this.headers[name]=value;},end(body){this.body=JSON.parse(body);}};
  await statusHandler({method},response);
  return response;
}
test('status rejects non-GET requests and reports missing configuration without a storage call',async()=>{
  delete process.env.SUPABASE_URL;delete process.env.SURVEY_GATEWAY_TOKEN;
  globalThis.fetch=()=>{throw new Error('Storage should not be contacted');};
  assert.equal((await status('POST')).statusCode,405);
  const response=await status();
  assert.equal(response.statusCode,200);
  assert.equal(response.body.configured,false);
  assert.equal(response.body.storageAvailable,false);
  assert.equal(response.headers['Cache-Control'],'no-store');
});
test('status confirms storage through the gateway without exposing response data or credentials',async()=>{
  process.env.SUPABASE_URL='https://example.supabase.co';
  process.env.SURVEY_GATEWAY_TOKEN='s'.repeat(64);
  const calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push({url,options});
    return Response.json({count:42,averages:{G1:30,G2:25,G3:20,G5:15,G4:10}});
  };
  const response=await status();
  assert.equal(response.statusCode,200);
  assert.equal(response.body.configured,true);
  assert.equal(response.body.storageAvailable,true);
  assert.deepEqual(JSON.parse(calls[0].options.body),{name:'community_average',args:{}});
  assert.equal(calls[0].url,'https://example.supabase.co/functions/v1/survey-storage');
  assert.equal('count' in response.body,false);
  assert.equal(JSON.stringify(response.body).includes(process.env.SURVEY_GATEWAY_TOKEN),false);
});
test('status reports backend errors and malformed responses as unavailable',async()=>{
  process.env.SUPABASE_URL='https://example.supabase.co';
  process.env.SURVEY_GATEWAY_TOKEN='s'.repeat(64);
  globalThis.fetch=async()=>new Response('upstream detail',{status:500});
  const failed=await status();
  assert.equal(failed.statusCode,503);
  assert.equal(failed.body.storageAvailable,false);
  assert.equal(JSON.stringify(failed.body).includes('upstream detail'),false);
  globalThis.fetch=async()=>Response.json({});
  assert.equal((await status()).statusCode,503);
});
test('local routes preserve checkpoint, resume and deletion while retiring health and admin export',async()=>{
  globalThis.fetch=originalFetch;
  const child=spawn(process.execPath,['server/dev.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  let output='';
  try{
    const origin=await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Development server did not start')),5000);
      child.stdout.on('data',chunk=>{
        output+=chunk;
        const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);
        if(match){clearTimeout(timeout);resolve(match[0]);}
      });
      child.on('error',error=>{clearTimeout(timeout);reject(error);});
      child.on('exit',code=>{clearTimeout(timeout);reject(new Error('Development server exited '+code));});
    });
    let response=await fetch(origin+'/api/status');
    const readiness=await response.json();
    assert.equal(readiness.storage,'memory');assert.equal(readiness.development,true);
    assert.equal(readiness.configured,false);assert.equal(readiness.storageAvailable,true);
    assert.equal((await fetch(origin+'/api/status',{method:'POST'})).status,405);
    assert.equal((await fetch(origin+'/api/health')).status,404);
    assert.equal((await fetch(origin+'/api/admin/export')).status,404);
    response=await fetch(origin+'/api/checkpoint',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ranking:['G1','G2','G3','G5','G4'],connections:[],email:'',newsletterOptIn:false,planningOptIn:false,feedback:''})});
    assert.equal(response.status,201);
    const saved=await response.json();
    const headers={Authorization:'Bearer '+saved.token};
    response=await fetch(origin+'/api/resume?id='+saved.id,{headers});
    assert.equal(response.status,200);assert.equal((await response.json()).id,saved.id);
    response=await fetch(origin+'/api/response?id='+saved.id,{method:'DELETE',headers});
    assert.equal(response.status,200);
    assert.equal((await fetch(origin+'/api/resume?id='+saved.id,{headers})).status,404);
  }finally{
    if(child.exitCode===null){child.kill();await once(child,'exit');}
  }
});
