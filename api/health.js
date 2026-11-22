import {json} from '../server/lib/handlers.mjs';
export default function handler(req,res){json(res,200,{app:'ljov-sac-tor',version:'tor12-v1',storageConfigured:!!(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY),assessmentSource:'approved static JSON'});}
