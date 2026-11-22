import {adminExportHandler,json} from '../../server/lib/handlers.mjs';
import {createRepository} from '../../server/lib/repository.mjs';
export default async function handler(req,res){
  try {await adminExportHandler(req,res,createRepository());}
  catch {json(res,503,{error:'Administrator export is not configured'});}
}
