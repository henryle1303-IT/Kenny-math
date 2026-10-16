import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../demo-dist');
const port = Number(process.env.PORT || 3211);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (url.pathname.startsWith('/api/')) { res.writeHead(404).end(); return; }
    let file = target;
    try { if (!(await fs.stat(file)).isFile()) file = path.join(root, 'index.html'); }
    catch {
      if (path.extname(url.pathname)) { res.writeHead(404).end(); return; }
      file = path.join(root, 'index.html');
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await fs.readFile(file));
  } catch { res.writeHead(500).end('Build the demo first: npm run build:demo'); }
}).listen(port, '127.0.0.1', () => console.log(`Demo: http://127.0.0.1:${port}`));
