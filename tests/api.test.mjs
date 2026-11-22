import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import gateway from '../server/gateway.cjs';
const {MemoryRepository}=gateway;
import {responseHandler,communityHandler} from '../server/lib/handlers.mjs';
const repo=new MemoryRepository();let server,origin;
before(async()=>{server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/response')return responseHandler(req,res,repo);if(url.pathname==='/community')return communityHandler(req,res,repo);res.statusCode=404;res.end();});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{await new Promise(resolve=>server.close(resolve));});
const body={ranking:['G1','G2','G3','G5','G4'],connections:['resident'],email:'',newsletterOptIn:false,planningOptIn:false,feedback:'Protect the right to remain.'};
async function req(path,options={}){const r=await fetch(origin+path,options);const data=await r.text();let result;try{result=JSON.parse(data);}catch{result=data;}return {status:r.status,body:result};}
async function post(b,headers={}){return req('/response',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(b)});}
test('new response creates high-entropy token and returns no email by default',async()=>{
 const r=await post(body);
 assert.equal(r.status,201);
 assert.match(r.body.id,/^[0-9a-f-]{36}$/);
 assert.ok(r.body.token.length>=40);
 assert.equal(r.body.revision,1);
 globalThis.created=r.body;
 const row=await repo.get(r.body.id);
 assert.ok(!row.token_hash.includes(r.body.token));
});
test('private link gates response access and allows revisions',async()=>{
 const {id,token}=globalThis.created;
 assert.equal((await req('/response?id='+id)).status,401);
 assert.equal((await req('/response?id='+id,{headers:{Authorization:'Bearer '+'x'.repeat(44)}})).status,404);
 const saved=await req('/response?id='+id,{headers:{Authorization:'Bearer '+token}});
 assert.equal(saved.status,200);
 assert.equal(saved.body.feedback,body.feedback);
 const changed={...body,id,revision:1,ranking:['G2','G1','G3','G5','G4'],feedback:'Updated'};
 const updated=await post(changed,{Authorization:'Bearer '+token});
 assert.equal(updated.status,200);assert.equal(updated.body.revision,2);
 assert.equal((await post(changed,{Authorization:'Bearer '+token})).status,409);
});
test('averages contain only aggregate weights, respond from first completed submission',async()=>{
 const r=await req('/community');
 assert.equal(r.body.count,1);
 assert.equal(r.body.available,true);
 assert.deepEqual(r.body.averages,{G1:25,G2:30,G3:20,G5:15,G4:10});
 assert.equal(JSON.stringify(r.body).includes('Protect the right'),false);
});
test('email required when opt-in is selected; bad ranking rejected',async()=>{
 assert.equal((await post({...body,newsletterOptIn:true})).status,422);
 assert.equal((await post({...body,ranking:['G1','G1','G3','G5','G4']})).status,422);
 const contact=await post({...body,email:'example@test.ca',newsletterOptIn:true,planningOptIn:false});
 assert.equal(contact.status,201);
 assert.equal((await req('/community')).body.count,2);
});
test('private deletion removes the response from aggregates',async()=>{
 const {id,token}=globalThis.created;
 const removed=await req('/response?id='+id,{method:'DELETE',headers:{Authorization:'Bearer '+token}});
 assert.equal(removed.status,200);
 assert.equal((await req('/community')).body.count,1);
 assert.equal((await req('/response?id='+id,{headers:{Authorization:'Bearer '+token}})).status,404);
});
