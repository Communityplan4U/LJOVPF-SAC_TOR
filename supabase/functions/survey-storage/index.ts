// Restricted server-to-server gateway for the SAC Terms of Reference survey.
// Modelled on the Planning Framework survey-storage Edge Function.
// The Vercel gateway token is sensitive; only its SHA-256 fingerprint is
// checked into source, exactly as in the Framework Assessment gateway.
// The Supabase service-role key stays inside Supabase.
const PUBLIC_DIGEST='ff849cb67c5667a3cd5eb43d5b2957a4fb0531a2468371b67aafc304ab77962d';
const OPS = new Set(['insert_response','get_response','update_response','delete_response','community_average']);
const encoder = new TextEncoder();
const IDS = new Set(['G1','G2','G3','G5','G4']);
const CONNECTIONS = new Set(['resident','former','business','worker','visit','representation','other']);
const COLS = 'id,token_hash,version,ranking,connections,email,newsletter_opt_in,planning_opt_in,feedback,revision,created_at,updated_at';
const uuid = (v:unknown) => typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const record = (v:unknown):v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v);
function reply(status:number,value:unknown){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
async function authorized(req:Request){
 const m=/^Bearer ([A-Za-z0-9_-]{64,128})$/.exec(req.headers.get('authorization')||'');if(!m)return false;
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(m[1])));
 const match=(hex:string|undefined)=>{if(!hex||!/^[0-9a-f]{64}$/.test(hex))return false;let diff=0;for(let i=0;i<32;i++)diff|=digest[i]^parseInt(hex.slice(i*2,i*2+2),16);return diff===0;};
 return match(PUBLIC_DIGEST);
}
async function limitedBody(req:Request){
 if(!req.body)throw Error('body');const reader=req.body.getReader();
 let bytes=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>32000){await reader.cancel();throw Error('size');}chunks.push(value);}
 const array=new Uint8Array(bytes);let i=0;for(const chunk of chunks){array.set(chunk,i);i+=chunk.length;}
 return JSON.parse(new TextDecoder().decode(array));
}
function validRanking(rank:unknown){return Array.isArray(rank)&&rank.length===5&&new Set(rank).size===5&&rank.every(x=>IDS.has(x));}
function validValues(v:unknown){
 if(!record(v))return false;
 const allowed=new Set(['version','ranking','connections','email','newsletter_opt_in','planning_opt_in','feedback','revision','updated_at']);
 if(Object.keys(v).some(k=>!allowed.has(k)))return false;
 return v.version==='tor12-v1'&&validRanking(v.ranking)&&Array.isArray(v.connections)&&v.connections.length<=7&&v.connections.every(x=>CONNECTIONS.has(x))&&
 (v.email===null||(typeof v.email==='string'&&v.email.length<=254))&&typeof v.newsletter_opt_in==='boolean'&&typeof v.planning_opt_in==='boolean'&&
 (!v.newsletter_opt_in&&!v.planning_opt_in||!!v.email)&&
 (v.feedback===null||(typeof v.feedback==='string'&&v.feedback.length<=1500))&&Number.isSafeInteger(v.revision)&&Number(v.revision)>=1;
}
function validateOperation(name:string,args:Record<string,unknown>){
 if(name==='insert_response')return record(args.row)&&uuid(args.row.id)&&typeof args.row.token_hash==='string'&&/^[0-9a-f]{64}$/.test(args.row.token_hash)&&
 Object.keys(args.row).every(x=>['id','token_hash','version','ranking','connections','email','newsletter_opt_in','planning_opt_in','feedback','revision'].includes(x))&&validValues(Object.fromEntries(Object.entries(args.row).filter(([k])=>k!=='id'&&k!=='token_hash')))&&args.row.revision===1;
 if(name==='get_response'||name==='delete_response')return uuid(args.id)&&Object.keys(args).length===1;
 if(name==='update_response')return uuid(args.id)&&Number.isSafeInteger(args.revision)&&Number(args.revision)>=1&&
 validValues(args.changes)&&record(args.changes)&&args.changes.revision===Number(args.revision)+1&&
 typeof args.changes.updated_at==='string'&&!Number.isNaN(Date.parse(args.changes.updated_at))&&Object.keys(args).length===3;
 if(name==='community_average')return Object.keys(args).length===0;
 return false;
}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply(405,{code:'method_not_allowed'});
 if(!await authorized(req))return reply(401,{code:'unauthorized'});
 if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return reply(415,{code:'json_required'});
 try{
  const body=await limitedBody(req);
  if(!record(body)||typeof body.name!=='string'||!OPS.has(body.name)||!record(body.args))return reply(400,{code:'invalid_operation'});
  if(!validateOperation(body.name,body.args))return reply(422,{code:'invalid_arguments'});
  const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
  const key=keys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),url=Deno.env.get('SUPABASE_URL');
  if(typeof key!=='string'||!key||!url)return reply(503,{code:'storage_unconfigured'});
  let path='',method='GET',data:unknown=undefined,prefer='';
  if(body.name==='insert_response'){path='/ljovsac_responses';method='POST';data=body.args.row;prefer='return=representation';}
  if(body.name==='get_response'){path='/ljovsac_responses?id=eq.'+encodeURIComponent(String(body.args.id))+'&select='+COLS+'&limit=1';}
  if(body.name==='update_response'){path='/ljovsac_responses?id=eq.'+encodeURIComponent(String(body.args.id))+'&revision=eq.'+body.args.revision;method='PATCH';data=body.args.changes;prefer='return=representation';}
  if(body.name==='delete_response'){path='/ljovsac_responses?id=eq.'+encodeURIComponent(String(body.args.id));method='DELETE';prefer='return=minimal';}
  if(body.name==='community_average'){path='/rpc/ljovsac_public_average';method='POST';data={};}
  const headers:Record<string,string>={apikey:key,Accept:'application/json'};
  if(key.startsWith('eyJ'))headers.Authorization='Bearer '+key;
  if(data!==undefined)headers['Content-Type']='application/json';
  if(prefer)headers.Prefer=prefer;
  const upstream=await fetch(url.replace(/\/$/,'')+'/rest/v1'+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(7500),redirect:'error'});
  const raw=upstream.status===204?null:await upstream.json().catch(()=>null);
  if(!upstream.ok){
   const code=record(raw)?raw.code:undefined;
   return reply(code==='23505'||code==='PT409'?409:503,{code:code==='23505'?'conflict':'storage_error'});
  }
  const result=['insert_response','get_response','update_response'].includes(body.name)?(Array.isArray(raw)?raw[0]||null:null):raw;
  return reply(200,result);
 }catch{return reply(503,{code:'storage_unavailable'});}
});
