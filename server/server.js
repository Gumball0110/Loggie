import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeEvent } from './event-normalizer.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.LOGGIE_PORT || 4317);
const clients = new Set();
const events = [];
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

function broadcast(event) {
  const message = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) client.write(message);
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 2_000_000) throw new Error('Event payload is too large.');
  }
  return JSON.parse(body || '{}');
}

async function serveFile(pathname, response) {
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = join(root, safePath);
  if (!filePath.startsWith(root)) return sendJson(response, 403, { error: 'Forbidden' });
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': mime[extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(filePath));
  } catch {
    sendJson(response, 404, { error: 'Not found' });
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
  if (request.method === 'GET' && url.pathname === '/api/health') return sendJson(response, 200, { ok: true, events: events.length });
  if (request.method === 'GET' && url.pathname === '/api/events') return sendJson(response, 200, events);
  if (request.method === 'GET' && url.pathname === '/api/events/stream') {
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    response.write(`data: ${JSON.stringify({ type: 'connected', events })}\n\n`);
    clients.add(response);
    request.on('close', () => clients.delete(response));
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/events') {
    try {
      const event = normalizeEvent(await readBody(request));
      events.push(event);
      if (events.length > 100) events.shift();
      broadcast(event);
      return sendJson(response, 202, { accepted: true, id: event.id });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }
  if (request.method === 'GET') return serveFile(url.pathname, response);
  sendJson(response, 405, { error: 'Method not allowed' });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Loggie is listening at http://127.0.0.1:${port}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
