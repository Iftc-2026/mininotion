import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
export default defineConfig({base:'/mininotion/',plugins:[react(),{name:'pages-entry',enforce:'post',generateBundle(_,bundle){this.emitFile({type:'asset',fileName:'_worker.js',source:readFileSync(resolve(import.meta.dirname,'_worker.js'),'utf8')});this.emitFile({type:'asset',fileName:'_routes.json',source:JSON.stringify({version:1,include:['/api/*'],exclude:[]})});const html=bundle['app.html'];if(html){delete bundle['app.html'];html.fileName='index.html';bundle['index.html']=html;}}}],build:{outDir:'dist',emptyOutDir:true,rollupOptions:{input:resolve(import.meta.dirname,'app.html'),output:{entryFileNames:'workspace-[hash].js',chunkFileNames:'chunk-[hash].js',assetFileNames:'workspace-[hash].[ext]'}}}});
