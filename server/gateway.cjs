'use strict';
// Vercel adapter for the restricted Supabase Edge gateway. Only Supabase holds
// database service-role credentials. The browser never receives gateway tokens.
const URL_PATTERN=/^https:\/\/[a-z0-9-]+\.supabase\.co$/;
const TOKEN_PATTERN=/^[A-Za-z0-9_-]{64,128}$/;
const CODES=['G1','G2','G3','G5','G4'],WEIGHTS=[30,25,20,15,10];
const ALLOWED=new Set(['insert_response','get_response','update_response','delete_response','community_average']);
function configured(){return URL_PATTERN.test(process.env.SUPABASE_URL||'')&&TOKEN_PATTERN.test(process.env.SURVEY_GATEWAY_TOKEN||'');}
class GatewayRepository {
 constructor() {if(!configured())throw new Error('Storage not configured');}
 async call(name,args){
  if(!ALLOWED.has(name))throw new Error('Unsupported storage operation');
  const token=process.env.SURVEY_GATEWAY_TOKEN;
  const r=await fetch(process.env.SUPABASE_URL+'/functions/v1/survey-storage',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({name,args}),signal:AbortSignal.timeout(8500),redirect:'error'});
  const payload=await r.json().catch(()=>null);
  if(!r.ok){const e=new Error('Storage gateway error');e.status=r.status===409?409:503;throw e;}
  return payload;
 }
 insert(row){return this.call('insert_response',{row});}
 get(id){return this.call('get_response',{id});}
 update(id,revision,changes){return this.call('update_response',{id,revision,changes});}
 delete(id){return this.call('delete_response',{id});}
 aggregates(){return this.call('community_average',{});}
}
// Local-only ephemeral store for development and deterministic automated tests.
class MemoryRepository {
 constructor(){this.rows=new Map();}
 async insert(row){const now=new Date().toISOString(),record={...row,created_at:now,updated_at:now};this.rows.set(row.id,record);return {...record};}
 async get(id){return this.rows.has(id)?{...this.rows.get(id)}:null;}
 async update(id,revision,changes){const old=this.rows.get(id);if(!old||old.revision!==revision)return null;const row={...old,...changes};this.rows.set(id,row);return {...row};}
 async delete(id){this.rows.delete(id);}
 async aggregates(){const rows=[...this.rows.values()],averages=Object.fromEntries(CODES.map(id=>[id,0]));for(const row of rows)row.ranking.forEach((id,i)=>{averages[id]+=WEIGHTS[i];});if(rows.length)for(const id of CODES)averages[id]=Math.round(averages[id]/rows.length*100)/100;return {count:rows.length,averages};}
}
function createRepository({local=false}={}){return local?new MemoryRepository():new GatewayRepository();}
module.exports={configured,GatewayRepository,MemoryRepository,createRepository};
