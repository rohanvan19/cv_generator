import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const origin='http://127.0.0.1:4310';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function health(){try{const r=await fetch(origin+'/api/health',{headers:{Connection:'close'},signal:AbortSignal.timeout(1200)});return r.ok&&(await r.json()).app==='cv-studio';}catch{return false;}}
async function stop(){if(await health()){const r=await fetch(origin+'/api/shutdown',{method:'POST',headers:{Origin:origin,Connection:'close'},signal:AbortSignal.timeout(3000)});if(!r.ok)throw new Error('A development preview is running. Close its terminal before starting the installed app.');for(let i=0;i<30&&await health();i++)await delay(200);}}
function openBrowser(){spawn('powershell.exe',['-NoProfile','-Command',`Start-Process '${origin}'`],{windowsHide:true,stdio:'ignore'}).unref();}
try{
 if(process.argv.includes('--stop')){await stop();process.exit(0);}
 if(process.argv.includes('--restart'))await stop();
 if(!await health()){
  if(!fs.existsSync(path.join(root,'dist/client/index.html')))throw new Error('The app has not been built. In the CV folder, run npm install and npm run build.');
  fs.mkdirSync(path.join(root,'data'),{recursive:true});const log=fs.openSync(path.join(root,'data','app.log'),'a');
  const child=spawn(process.execPath,[path.join(root,'server','start.mjs')],{cwd:root,windowsHide:true,detached:true,stdio:['ignore',log,log]});child.unref();fs.closeSync(log);
  let ready=false;for(let i=0;i<40;i++){if(await health()){ready=true;break;}await delay(250);}
  if(!ready)throw new Error('The app could not start. See data/app.log in the CV folder.');
 }
 if(!process.argv.includes('--no-open'))openBrowser();
}catch(e){fs.mkdirSync(path.join(root,'data'),{recursive:true});fs.appendFileSync(path.join(root,'data','launcher-error.log'),new Date().toISOString()+' '+e.message+'\n');console.error(e.message);if(!process.argv.includes('--no-open'))spawn('notepad.exe',[path.join(root,'data','launcher-error.log')],{windowsHide:false,stdio:'ignore'}).unref();process.exitCode=1;}
