import {json} from '../server/lib/handlers.mjs';
import gateway from '../server/gateway.cjs';
export default function handler(req,res){json(res,200,{app:'ljov-sac-tor',version:'tor12-v1',storageConfigured:gateway.configured(),assessmentSource:'approved static JSON'});}
