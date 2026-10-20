import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import { handleApi } from './server/api.mjs';
export default defineConfig({
 css:{postcss:{plugins:[tailwindcss()]}},
 plugins:[{name:'cv-local-api',configureServer(server){server.middlewares.use(async(req,res,next)=>{if(!await handleApi(req,res))next();});}},vinext()],
 server:{host:'127.0.0.1',port:4310,strictPort:true},
});
