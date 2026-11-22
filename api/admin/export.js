import {adminExportHandler,json} from '../../server/lib/handlers.mjs';
import gateway from '../../server/gateway.cjs';
const {createRepository}=gateway;
export default async function handler(req,res){
  try {await adminExportHandler(req,res,createRepository({admin:true}));}
  catch {json(res,503,{error:'Administrator export is not configured'});}
}
