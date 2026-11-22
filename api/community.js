import {communityHandler,json} from '../server/lib/handlers.mjs';
import {createRepository} from '../server/lib/repository.mjs';
export default async function handler(req,res){
  try {await communityHandler(req,res,createRepository());}
  catch {json(res,503,{error:'Community comparison is not configured'});}
}
