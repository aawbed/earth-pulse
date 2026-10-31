import 'dotenv/config';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const API_DIR = path.join(__dirname, 'api');
const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function enhanceRes(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify(payload));
    return res;
  };
  return res;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

const server = http.createServer(async (req, res) => {
  enhanceRes(res);
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname.startsWith('/api/')) {
    const routeName = path.basename(url.pathname).replace(/\.js$/, '');
    const modulePath = path.join(API_DIR, `${routeName}.js`);
    try {
      await fs.access(modulePath);
      req.query = Object.fromEntries(url.searchParams.entries());
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        req.body = await readBody(req);
      }
      const mod = await import(`${pathToFileURL(modulePath).href}?t=${Date.now()}`);
      return await mod.default(req, res);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'API route not found' });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  const relPath = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, relPath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.status(403).end('Forbidden');
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    res.status(200).end(content);
  } catch {
    res.status(404).end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`🌍 Earth Pulse dev server running at http://localhost:${PORT}`);
});
