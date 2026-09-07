#!/usr/bin/env node
// Publish the built website only. Keep project linking and local credentials outside output.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
if(!fs.existsSync(path.join(dist,'index.html')))throw new Error('Run npm run build first');
const output=path.join(root,'.vercel/output');
fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});
fs.cpSync(dist,path.join(output,'static'),{recursive:true});
fs.writeFileSync(path.join(output,'config.json'),JSON.stringify({version:3},null,2)+'\n');
console.log('Prepared .vercel/output from dist; ready for vercel deploy --prebuilt --prod.');
