import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { GAME_IMAGES } from '../src/asset-manifest.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'wechat/dist');
await mkdir(output, { recursive: true });
const copied = [];
async function copy(source, destination) {
  await mkdir(dirname(join(output, destination)), { recursive: true });
  await copyFile(join(root, source), join(output, destination)); copied.push(destination);
}
await build({ entryPoints: [join(root,'wechat/src/entry.js')], bundle: true, format: 'iife', platform: 'neutral', target: 'es2018', charset: 'utf8', minify: true, outfile: join(output,'game.js') });
await copy('wechat/game.json','game.json');
await copy('wechat/resources-game.js','resources/game.js');
for(const path of GAME_IMAGES) await copy('assets/'+path,path==='sushi-atlas-v2.png'?'boot/'+path:'resources/assets/'+path);
await copy('assets/audio/bossa-antigua.mp3','resources/assets/audio/bossa-antigua.mp3');
await copy('assets/audio/CREDITS.md','resources/assets/audio/CREDITS.md');
copied.push('game.js');
const bytes = { main: 0, resources: 0 };
for(const file of copied) bytes[file.startsWith('resources/')?'resources':'main'] += (await stat(join(output,file))).size;
if(bytes.main > 4*1024*1024 || bytes.main+bytes.resources > 30*1024*1024) throw new Error('WeChat package exceeds size budget: '+JSON.stringify(bytes));
const bundle = await readFile(join(output,'game.js'),'utf8');
if(/\bdocument\.|\blocalStorage\b|\bwindow\./.test(bundle)) throw new Error('Browser-only API leaked into WeChat build');
await writeFile(join(root,'wechat/build-report.json'),JSON.stringify({ files: copied, bytes, testedOnDevice: false },null,2)+'\n');
console.log('WeChat build:', JSON.stringify(bytes), 'No DOM or browser storage dependencies.');
