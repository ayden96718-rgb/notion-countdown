import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const directory = process.argv[2] ?? '.';
if (!['.', 'dist'].includes(directory)) throw new Error('Serve only project root or dist');
const root = path.join(project, directory);
const port = Number(process.env.PORT ?? 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // Tests exercise a Pages-style project subdirectory as well as the root URL.
    if (pathname.startsWith('/susuan-trainer/')) pathname = pathname.slice('/susuan-trainer'.length);
    if (pathname.split('/').some(part => part.startsWith('.') && part !== '.nojekyll')) throw new Error('Forbidden');
    let filename = path.resolve(root, '.' + pathname);
    if (!filename.startsWith(root + path.sep) && filename !== root) throw new Error('Forbidden');
    if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
    const bytes = await readFile(filename);
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '0.0.0.0', () => console.log(`速算 preview: http://localhost:${port}/susuan-trainer/ (${directory})`));
