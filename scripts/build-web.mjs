// Yayın/mobil için dist/ klasörünü hazırlar. Hizmet çalışanının sürümü commit kimliğiyle damgalanır.
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'src', 'icons']) cpSync(f, 'dist/' + f, { recursive: true });
const version = (process.env.GITHUB_SHA || 'dev').slice(0, 7);
const sw = readFileSync('dist/sw.js', 'utf8').replace("const VERSION = 'dev';", `const VERSION = '${version}';`);
writeFileSync('dist/sw.js', sw);
console.log('dist hazır, sürüm:', version);
