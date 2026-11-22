import {json} from '../server/lib/handlers.mjs';
import gateway from '../server/gateway.cjs';

// Like the Framework status endpoint, check storage before reporting readiness.
// SAC has no collection rounds or closing date, so those fields do not apply.
export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  const status={app:'ljov-sac-tor',version:'tor12-v1',configured:gateway.configured(),storageAvailable:false};
  if(!status.configured)return json(res,200,status);
  try {
    const result=await gateway.createRepository().aggregates();
    if(!result||!Number.isSafeInteger(result.count)||result.count<0||!result.averages||typeof result.averages!=='object'||Array.isArray(result.averages))throw new Error('Invalid storage status');
    return json(res,200,{...status,storageAvailable:true});
  }catch{
    return json(res,503,{...status,error:'Survey status temporarily unavailable.'});
  }
}
