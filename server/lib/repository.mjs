/* Data access is server-only. Nothing in this file is bundled into public JS. */
const COLS='id,token_hash,version,ranking,connections,email,newsletter_opt_in,planning_opt_in,feedback,revision,created_at,updated_at';

export class SupabaseRepository {
  constructor(url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (!url || !key) throw new Error('Storage not configured');
    this.endpoint=url.replace(/\/$/,'')+'/rest/v1';
    this.key=key;
  }
  async request(path,method='GET',body,extra={}) {
    const headers={apikey:this.key,Authorization:'Bearer '+this.key,Accept:'application/json',...extra};
    if (body!==undefined) headers['Content-Type']='application/json';
    const res=await fetch(this.endpoint+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(8000)});
    if(!res.ok){const err=new Error('Storage request failed: '+res.status);err.status=res.status;throw err;}
    return res.status===204?null:res.json();
  }
  async insert(row){return (await this.request('/ljovsac_responses','POST',row,{'Prefer':'return=representation'}))[0];}
  async get(id){const list=await this.request('/ljovsac_responses?id=eq.'+encodeURIComponent(id)+'&select='+COLS+'&limit=1');return list[0]||null;}
  async update(id,revision,row){const list=await this.request('/ljovsac_responses?id=eq.'+encodeURIComponent(id)+'&revision=eq.'+revision,'PATCH',row,{'Prefer':'return=representation'});return list[0]||null;}
  async delete(id){await this.request('/ljovsac_responses?id=eq.'+encodeURIComponent(id),'DELETE',undefined,{'Prefer':'return=minimal'});}
  async aggregates(){const x=await this.request('/rpc/ljovsac_public_average','POST',{});return x;}
  async all(){let all=[],offset=0;while(true){const data=await this.request('/ljovsac_responses?select='+COLS+'&order=created_at.asc&limit=500&offset='+offset);all.push(...data);if(data.length<500)break;offset+=500;if(offset>100000)throw new Error('Export exceeded limit');}return all;}
}

export class MemoryRepository {
  constructor(){this.rows=new Map();}
  async insert(row){const now=new Date().toISOString(),record={...row,created_at:now,updated_at:now};this.rows.set(row.id,record);return {...record};}
  async get(id){return this.rows.has(id)?{...this.rows.get(id)}:null;}
  async update(id,revision,changes){const old=this.rows.get(id);if(!old || old.revision!==revision)return null;const row={...old,...changes};this.rows.set(id,row);return {...row};}
  async delete(id){this.rows.delete(id);}
  async aggregates(){const rows=Array.from(this.rows.values());const averages={G1:0,G2:0,G3:0,G5:0,G4:0};const weights=[30,25,20,15,10];for(const row of rows)row.ranking.forEach((id,i)=>{averages[id]+=weights[i];});if(rows.length)for(const id in averages)averages[id]=Math.round(averages[id]/rows.length*100)/100;return {count:rows.length,averages};}
  async all(){return Array.from(this.rows.values()).map(row=>({...row}));}
}
export function createRepository({local=false}={}){
  if(local)return new MemoryRepository();
  return new SupabaseRepository();
}
