import {responseHandler,json} from '../server/lib/handlers.mjs';
import gateway from '../server/gateway.cjs';
const {createRepository}=gateway;
export default async function handler(req,res){
  try {await responseHandler(req,res,createRepository());}
  catch {json(res,503,{error:'Response storage is not configured'});}
}
