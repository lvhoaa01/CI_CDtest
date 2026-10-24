import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TaskStore, TaskValidationError } from './task-store.mjs';

const sourceDirectory = fileURLToPath(new URL('.', import.meta.url));
const defaultPublicDirectory = resolve(sourceDirectory, '../public');
const startedAt = new Date().toISOString();

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

export function createApplication(options = {}) {
  const store = options.store ?? new TaskStore();
  const publicDirectory = resolve(options.publicDirectory ?? defaultPublicDirectory);
  const version = options.version ?? process.env.APP_VERSION ?? 'local';
  const commit = options.commit ?? process.env.COMMIT_SHA ?? 'development';

  return createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');

    try {
      if (requestUrl.pathname === '/health' && request.method === 'GET') {
        return sendJson(response, 200, {
          status: 'ok',
          version,
          commit,
          startedAt,
          uptimeSeconds: Math.floor(process.uptime()),
        });
      }

      if (requestUrl.pathname === '/api/info' && request.method === 'GET') {
        return sendJson(response, 200, { version, commit });
      }

      if (requestUrl.pathname === '/api/tasks' && request.method === 'GET') {
        return sendJson(response, 200, { tasks: store.list() });
      }

      if (requestUrl.pathname === '/api/tasks' && request.method === 'POST') {
        const body = await readJsonBody(request);
        return sendJson(response, 201, { task: store.create(body.title) });
      }

      const taskMatch = requestUrl.pathname.match(/^\/api\/tasks\/([^/]+)$/);
      if (taskMatch && request.method === 'PATCH') {
        const body = await readJsonBody(request);
        const task = store.update(decodeURIComponent(taskMatch[1]), body);
        return task
          ? sendJson(response, 200, { task })
          : sendJson(response, 404, { error: 'task not found' });
      }

      if (taskMatch && request.method === 'DELETE') {
        const deleted = store.delete(decodeURIComponent(taskMatch[1]));
        if (!deleted) {
          return sendJson(response, 404, { error: 'task not found' });
        }
        response.writeHead(204);
        return response.end();
      }

      if (requestUrl.pathname.startsWith('/api/')) {
        return sendJson(response, 404, { error: 'route not found' });
      }

      return serveStatic(response, publicDirectory, requestUrl.pathname);
    } catch (error) {
      if (error instanceof TaskValidationError || error instanceof SyntaxError) {
        return sendJson(response, 400, { error: error.message });
      }

      if (error.code === 'PAYLOAD_TOO_LARGE') {
        return sendJson(response, 413, { error: error.message });
      }

      console.error(error);
      return sendJson(response, 500, { error: 'internal server error' });
    }
  });
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) {
      const error = new Error('request body is too large');
      error.code = 'PAYLOAD_TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function serveStatic(response, publicDirectory, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const decodedPath = decodeURIComponent(requestedPath);
  const filePath = resolve(publicDirectory, `.${decodedPath}`);
  const allowedPrefix = `${publicDirectory}${sep}`;

  if (!filePath.startsWith(allowedPrefix)) {
    return sendJson(response, 403, { error: 'forbidden' });
  }

  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      throw new Error('not a file');
    }

    response.writeHead(200, {
      'Cache-Control': requestedPath === '/index.html' ? 'no-cache' : 'public, max-age=3600',
      'Content-Type': mimeTypes[extname(filePath)] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    return createReadStream(filePath).pipe(response);
  } catch {
    return sendJson(response, 404, { error: 'not found' });
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const server = createApplication();

  server.listen(port, '0.0.0.0', () => {
    console.log(`CI/CD Task Board listening on http://0.0.0.0:${port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received; stopping server`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
