import {createServer} from 'node:http';

class HttpError extends Error {
  constructor(status, message) {super(message); this.status = status;}
}

function send(res, status, body) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  res.end(JSON.stringify(body));
}

async function readTask(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new HttpError(415, 'Gunakan Content-Type application/json.');
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) throw new HttpError(413, 'Body maksimal 16 KiB.');
    chunks.push(chunk);
  }
  let body;
  try {body = JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch {throw new HttpError(400, 'JSON tidak valid.');}
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 200) {
    throw new HttpError(400, 'title harus string sepanjang 1-200 karakter.');
  }
  const description = body.description === undefined ? '' : body.description;
  if (typeof description !== 'string' || description.length > 1000) {
    throw new HttpError(400, 'description harus string maksimal 1000 karakter.');
  }
  return {title: body.title.trim(), description};
}

export function createApp(store) {
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/health' && req.method === 'GET') {
        await store.health();
        return send(res, 200, {status: 'ok', database: 'connected'});
      }
      if (path === '/tasks') {
        if (req.method === 'POST') return send(res, 201, {data: await store.create(await readTask(req))});
        if (req.method === 'GET') return send(res, 200, {data: await store.list()});
        res.setHeader('Allow', 'GET, POST');
        throw new HttpError(405, 'Method tidak didukung.');
      }
      const match = /^\/tasks\/([^/]+)$/.exec(path);
      if (match && req.method === 'GET') {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match[1])) {
          throw new HttpError(400, 'ID tugas harus UUID.');
        }
        const data = await store.get(match[1]);
        if (!data) throw new HttpError(404, 'Tugas tidak ditemukan.');
        return send(res, 200, {data});
      }
      throw new HttpError(404, 'Endpoint tidak ditemukan.');
    } catch (error) {
      send(res, error instanceof HttpError ? error.status : 503,
        {error: error instanceof HttpError ? error.message : 'Database tidak tersedia. Cek service db.'});
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}
