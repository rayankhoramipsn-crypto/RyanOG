import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const html = readFileSync('index.html','utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(Boolean);
const temp = mkdtempSync(join(tmpdir(),'triso-qa-'));
let failures = 0;
try {
 for (let i = 0; i < scripts.length; i++) {
   const path = join(temp, 'inline-' + i + '.js');
   writeFileSync(path, scripts[i]);
   try { execFileSync(process.execPath, ['--check',path], {stdio:'pipe'}); }
   catch (e) { console.error('Invalid inline script',i, e.stderr?.toString()); failures++; }
 }
 const forbidden = [/sb_secret_[a-zA-Z0-9_-]+/, /service_role['"\s:=]+eyJ[a-zA-Z0-9._-]+/];
 for(const pattern of forbidden) if(pattern.test(html)) { console.error('Possible privileged API key exposed'); failures++; }
 console.log('Checked',scripts.length,'inline scripts; failures:',failures);
} finally { rmSync(temp,{recursive:true,force:true}); }
if (failures) process.exit(1);
