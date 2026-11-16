import {createReadStream, existsSync} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, normalize, resolve} from 'node:path';
import {handleApi} from '../server/api.mjs';

const root = resolve('dist');
const port = Number(process.env.PORT || 3000);
const mime = {
    '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

if (!existsSync(root)) throw new Error('Сначала выполните npm run build.');

const server = createServer(async (req, res) => {
    if (await handleApi(req, res) !== false) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405).end();
        return;
    }

    const urlPath = new URL(req.url, 'http://localhost').pathname;
    const candidate = resolve(root, `.${normalize(urlPath)}`);
    const file = candidate.startsWith(`${root}/`) ? candidate : resolve(root, 'index.html');
    const target = existsSync(file) && (await stat(file)).isFile() ? file : resolve(root, 'index.html');
    res.writeHead(200, {'Content-Type': mime[extname(target)] || 'application/octet-stream'});
    if (req.method === 'HEAD') return res.end();
    createReadStream(target).pipe(res);
});

server.listen(port, '0.0.0.0', () => console.log(`Passport: http://0.0.0.0:${port}`));
