import crypto from 'node:crypto';
import {validOrder,AREA_IDS} from '../../public/js/scoring.js';
import {sendPrivateReturnLink} from './mailer.mjs';

const MAX_BYTES=13000;
const CONNECTIONS=new Set(['resident','former','business','worker','visit','representation','other']);
const isEmail=v=>!v||(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<=254);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const sha=token=>crypto.createHash('sha256').update(token).digest('hex');
const hashMatches=(hash,token)=>typeof hash==='string'&&hash.length===64&&crypto.timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(sha(token),'hex'));
const errorJson=(res,status,message)=>json(res,status,{error:message});
export function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(body));}
export function reqToken(req){const raw=String(req.headers.authorization||'');return raw.startsWith('Bearer ')?raw.slice(7).trim():'';}
async function parseBody(req){
  if(req.body && typeof req.body==='object')return req.body;
  if(typeof req.body==='string')return JSON.parse(req.body);
  const chunks=[];let size=0;
  for await (const c of req){size+=c.length;if(size>MAX_BYTES)throw Object.assign(new Error('Payload too large'),{status:413});chunks.push(c);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function validatePayload(data){
  if(!data||!validOrder(data.ranking))throw Object.assign(new Error('Select all five governance areas in order.'),{status:422});
  if(!Array.isArray(data.connections)||data.connections.length>7||data.connections.some(x=>!CONNECTIONS.has(x)))throw Object.assign(new Error('Invalid neighbourhood connection choices.'),{status:422});
  const email=typeof data.email==='string'?data.email.trim():'';
  if(!isEmail(email))throw Object.assign(new Error('Please enter a valid email address.'),{status:422});
  const newsletter=data.newsletterOptIn===true, planning=data.planningOptIn===true;
  if((newsletter||planning)&&!email)throw Object.assign(new Error('An email address is required to receive updates.'),{status:422});
  const feedback=typeof data.feedback==='string'?data.feedback.trim():'';
  if(feedback.length>1500)throw Object.assign(new Error('Comments must be 1,500 characters or less.'),{status:422});
  return {version:'tor12-v1',ranking:data.ranking,connections:[...new Set(data.connections)],email:email||null,newsletter_opt_in:newsletter,planning_opt_in:planning,feedback:feedback||null};
}
function allowWrite(req){
  const origin=req.headers.origin;
  if(!origin)return true; // nonbrowser integrations still require the private token for edits
  try {
    const url=new URL(origin);
    const permitted=String(process.env.PUBLIC_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
    return ['https:','http:'].includes(url.protocol)&&(url.host===req.headers.host||url.host===req.headers['x-forwarded-host']||permitted.includes(url.origin));
  } catch{return false;}
}
function publicRow(row){return {id:row.id,revision:row.revision,ranking:row.ranking,connections:row.connections,email:row.email||'',newsletterOptIn:row.newsletter_opt_in,planningOptIn:row.planning_opt_in,feedback:row.feedback||'',updatedAt:row.updated_at};}
export async function responseHandler(req,res,repo){
  try{
    if(!['GET','POST','DELETE'].includes(req.method))return errorJson(res,405,'Method not allowed');
    if(req.method==='GET'){
      const id=new URL(req.url,'http://localhost').searchParams.get('id');
      const token=reqToken(req);
      if(!uuid(id)||token.length<36)return errorJson(res,401,'Private return link required');
      const row=await repo.get(id);
      if(!row||!hashMatches(row.token_hash,token))return errorJson(res,404,'Response not found');
      return json(res,200,publicRow(row));
    }
    if(!allowWrite(req))return errorJson(res,403,'Request origin not allowed');
    if(req.method==='DELETE'){
      const id=new URL(req.url,'http://localhost').searchParams.get('id');
      const token=reqToken(req);
      if(!uuid(id)||token.length<36)return errorJson(res,401,'Private return link required');
      const row=await repo.get(id);
      if(!row||!hashMatches(row.token_hash,token))return errorJson(res,404,'Response not found');
      await repo.delete(id);
      return json(res,200,{deleted:true});
    }
    if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return errorJson(res,415,'JSON body required');
    const body=await parseBody(req);
    const values=validatePayload(body);
    if(body.id){
      const id=body.id, token=reqToken(req);
      if(!uuid(id)||token.length<36)return errorJson(res,401,'Private return link required');
      const row=await repo.get(id);
      if(!row||!hashMatches(row.token_hash,token))return errorJson(res,404,'Response not found');
      if(!Number.isInteger(body.revision)||body.revision!==row.revision)return errorJson(res,409,'Response changed in another session. Reload your private return link.');
      const result=await repo.update(id,row.revision,{...values,revision:row.revision+1,updated_at:new Date().toISOString()});
      if(!result)return errorJson(res,409,'Response changed in another session. Reload your private return link.');
      return json(res,200,publicRow(result));
    }
    const token=crypto.randomBytes(32).toString('base64url');
    const inserted=await repo.insert({id:crypto.randomUUID(),token_hash:sha(token),...values,revision:1});
    // A return-link email is best-effort. The database response is authoritative
    // even when the optional email provider has not been configured.
    if(values.email) await sendPrivateReturnLink(values.email,inserted.id,token);
    return json(res,201,{...publicRow(inserted),token});
  }catch(err){return errorJson(res,err.status>=400&&err.status<500?err.status:503,err.status?'Invalid response: '+err.message:'Response saving is temporarily unavailable');}
}
export async function communityHandler(req,res,repo){
  if(req.method!=='GET')return errorJson(res,405,'Method not allowed');
  try {
    const result=await repo.aggregates();
    const count=Number(result?.count)||0;
    const averages=result?.averages||{};
    if(Object.keys(averages).some(id=>!AREA_IDS.includes(id)))throw Error('Bad averages');
    return json(res,200,{available:count>=1,count,averages:count>=1?averages:null});
  }catch{return errorJson(res,503,'Community comparison is temporarily unavailable');}
}
function preventSpreadsheetFormula(v){const s=String(v??'');return /^[\s]*[=+\-@\t\r]/.test(s)?"'"+s:s;}
function csvCell(v){const text=preventSpreadsheetFormula(v);return '"'+text.replaceAll('"','""')+'"';}
export async function adminExportHandler(req,res,repo){
  if(req.method!=='GET')return errorJson(res,405,'Method not allowed');
  const expected=process.env.ADMIN_EXPORT_KEY||'';
  const token=reqToken(req);
  if(expected.length<32)return errorJson(res,503,'Administrator export is not configured');
  const a=Buffer.from(expected),b=Buffer.from(token);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return errorJson(res,401,'Unauthorized');
  try{
    const rows=await repo.all();
    const columns=['id','created_at','updated_at','revision','ranking','connections','email','newsletter_opt_in','planning_opt_in','feedback'];
    const csv=[columns.join(','),...rows.map(r=>columns.map(col=>csvCell(['ranking','connections'].includes(col)?JSON.stringify(r[col]):r[col])).join(','))].join('\r\n')+'\r\n';
    res.statusCode=200;res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Disposition','attachment; filename="ljovsac-responses.csv"');res.end(csv);
  }catch{return errorJson(res,503,'Export unavailable');}
}
