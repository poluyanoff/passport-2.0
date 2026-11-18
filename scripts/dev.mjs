import * as esbuild from 'esbuild';
import { mkdir, copyFile, readFile, rm, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { handleInlineEdit, inlineEditClient } from './inline-edit.mjs';
import { createServer, request } from 'node:http';
import { installLibrary } from './library-install.mjs';
import { checkLibrary } from './library-check.mjs';
import {handleApi} from '../server/api.mjs';

await rm('dist', { recursive: true, force: true });
await mkdir('dist');
await copyFile('index.html', 'dist/index.html');
// Дополнительные флоу (npm run flow:new): screens/<адрес>/entry.js + index.html → dist/screens/<адрес>/
const entryPoints = { app: 'screens/main.js' };
const pages = (await readdir('screens', { recursive: true, withFileTypes: true }).catch(() => []))
  .filter(e => e.isFile() && e.name === 'index.html').map(e => join(e.parentPath ?? e.path, e.name)).filter(p => !p.split('/').some(part => part.startsWith('_')));
for (const page of pages) {
  const dir = dirname(page);
  await mkdir(join('dist', dir), { recursive: true });
  await copyFile(page, join('dist', page));
  entryPoints[join(dir, 'entry')] = join(dir, 'entry.js');
}
const options = { entryPoints, bundle: true, outdir: 'dist', format: 'esm', logLevel: 'info' };
if (process.argv.includes('--build')) {
  await esbuild.build({ ...options, minify: true });
} else {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: 'dist', host: '127.0.0.1', port: 8001 });
  let installing = false;
  const server = createServer(async (req, res) => {
    if (await handleApi(req, res) !== false) return;
    // Правка текстов (Alt+E): записывает новый текст в строковый литерал в screens/
    if (req.url?.split('?')[0] === '/__inline-edit') {
      if (req.method !== 'POST' || req.headers.origin !== `http://${req.headers.host}`) { res.statusCode = 403; return res.end(); }
      return handleInlineEdit(req, res);
    }
    if (req.url?.split('?')[0] !== '/api/library') {
      const proxy = request({ hostname: '127.0.0.1', port, path: req.url, method: req.method, headers: { ...req.headers, 'accept-encoding': 'identity' } }, upstream => {
        if (!String(upstream.headers['content-type']).includes('text/html')) { res.writeHead(upstream.statusCode, upstream.headers); return upstream.pipe(res); }
        const chunks = [];
        upstream.on('data', c => chunks.push(c));
        upstream.on('end', () => {
          const body = Buffer.from(Buffer.concat(chunks).toString('utf8').replace('</body>', `<script>window.libraryApi = true;${inlineEditClient}</script></body>`));
          res.writeHead(upstream.statusCode, { ...upstream.headers, 'content-length': body.length }); res.end(body);
        });
      });
      proxy.on('error', () => { res.statusCode = 502; res.end(); });
      req.pipe(proxy); return;
    }
    const reply = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    const host = req.headers.host;
    if (!/^127\.0\.0\.1:\d+$/.test(host || '')) return reply(403, {});
    if (req.method === 'GET') return reply(200, await checkLibrary());
    if (req.method !== 'POST') return reply(405, {});
    if (req.headers.origin !== `http://${host}` || req.headers['x-library-action'] !== 'install') return reply(403, {});
    if (installing) return reply(409, { message: 'Обновление уже выполняется.' });
    installing = true;
    try {
      const version = await installLibrary();
      await ctx.rebuild();
      reply(200, { version });
    } catch (error) { reply(500, { message: error.message }); }
    finally { installing = false; }
  });
  await new Promise(resolve => server.listen(8000, '127.0.0.1', resolve));
  console.log('\nПрототип: http://127.0.0.1:8000\nИзмените screens/main.js и обновите страницу.\n');
  let checking = false;
  const check = async () => {
    if (checking) return;
    checking = true;
    try { await checkLibrary(); } finally { checking = false; }
  };
  void check();
  const config = JSON.parse(await readFile('library.config.json', 'utf8'));
  const minutes = Number(config.intervalMinutes);
  const timer = setInterval(() => void check(), (Number.isFinite(minutes) && minutes >= 1 ? minutes : 15) * 60000);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
    clearInterval(timer);
    server.close();
    await ctx.dispose();
    process.exit();
  });
}
