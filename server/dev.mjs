import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRepository} from './lib/repository.mjs';
import {responseHandler,communityHandler,adminExportHandler,json} from './lib/handlers.mjs';
const root=resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const repo=createRepository({local:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/response')return await responseHandler(req,res,repo);
    if(url.pathname==='/api/community')return await communityHandler(req,res,repo);
    if(url.pathname==='/api/admin/export')return await adminExportHandler(req,res,repo);
    if(url.pathname==='/api/health')return json(res,200,{app:'ljov-sac-tor',development:true,storageConfigured:true});
    if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed'});
    const local=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(local!==root&&!local.startsWith(root+sep))return json(res,403,{error:'Forbidden'});
    const body=await readFile(local);
    res.statusCode=200;res.setHeader('Content-Type',mime[extname(local)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.end(req.method==='HEAD'?undefined:body);
  }catch{return json(res,404,{error:'Not found'});}
});
const port=Number(process.env.PORT||4177);
server.listen(port,'127.0.0.1',()=>{console.log(`Local SAC TOR app: http://127.0.0.1:${port}`);console.log('Development memory storage only: local responses reset when the server stops.');});
