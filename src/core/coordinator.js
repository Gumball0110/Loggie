import http from 'node:http';
import { DomainError } from './domain.js';

export const coreProtocolVersion = 2;

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new DomainError('Request body is too large.', { status: 413 });
  }
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw new DomainError('Request body must be valid JSON.');
  }
}

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

function routeKey(method, pattern) {
  return `${method} ${pattern}`;
}

export function createCoordinator({ core }) {
  if (!core) throw new Error('Coordinator requires a core database.');
  const routes = new Map();
  const route = (method, pattern, handler) => routes.set(routeKey(method, pattern), handler);

  route('GET', '/v1/health', () => ({ ok: true, version: coreProtocolVersion, pid: process.pid }));
  route('GET', '/v1/projects', () => core.listProjects());
  route('POST', '/v1/projects', ({ body }) => core.createProject(body));
  route('GET', '/v1/projects/:id', ({ params }) => core.getProject(params.id));
  route('GET', '/v1/tasks', ({ url }) => core.listTasks({ status: url.searchParams.get('status') || undefined, projectId: url.searchParams.get('projectId') || undefined }));
  route('POST', '/v1/tasks', ({ body }) => core.createTask(body));
  route('GET', '/v1/tasks/:id', ({ params }) => core.getTask(params.id));
  route('POST', '/v1/tasks/:id/transition', ({ params, body }) => core.transitionTask(params.id, body.to, body.reason));
  route('POST', '/v1/tasks/:id/briefs', ({ params, body }) => core.createBrief(params.id, body));
  route('GET', '/v1/tasks/:id/briefs/approved', ({ params }) => core.getApprovedBriefForTask(params.id));
  route('GET', '/v1/briefs/:id', ({ params }) => core.getBrief(params.id));
  route('POST', '/v1/briefs/:id/approve', ({ params }) => core.approveBrief(params.id));
  route('POST', '/v1/sessions', ({ body }) => core.createSession(body));
  route('GET', '/v1/sessions', ({ url }) => core.listSessions({ status: url.searchParams.get('status') || undefined, taskId: url.searchParams.get('taskId') || undefined }));
  route('GET', '/v1/sessions/:id', ({ params }) => core.getSession(params.id));
  route('POST', '/v1/sessions/:id/transition', ({ params, body }) => core.transitionSession(params.id, body.to));
  route('POST', '/v1/sessions/:id/write-up', ({ params, body }) => core.createWriteUp(params.id, body));
  route('GET', '/v1/write-ups/:id', ({ params }) => core.getWriteUp(params.id));
  route('GET', '/v1/events', ({ url }) => core.listEvents({ after: Number(url.searchParams.get('after') || 0) }));

  function matchRoute(method, pathname) {
    for (const [key, handler] of routes) {
      const [routeMethod, pattern] = key.split(' ');
      if (routeMethod !== method) continue;
      const patternParts = pattern.split('/');
      const pathParts = pathname.split('/');
      if (patternParts.length !== pathParts.length) continue;
      const params = {};
      let matched = true;
      for (let index = 0; index < patternParts.length; index += 1) {
        if (patternParts[index].startsWith(':')) params[patternParts[index].slice(1)] = decodeURIComponent(pathParts[index]);
        else if (patternParts[index] !== pathParts[index]) { matched = false; break; }
      }
      if (matched) return { handler, params };
    }
    return null;
  }

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://loggie.local');
      const matched = matchRoute(request.method, url.pathname);
      if (!matched) return send(response, 404, { error: { code: 'not_found', message: 'Route was not found.' } });
      const body = ['POST', 'PUT', 'PATCH'].includes(request.method) ? await readJson(request) : {};
      const data = await matched.handler({ body, params: matched.params, url });
      if (data === null) return send(response, 404, { error: { code: 'not_found', message: 'Resource was not found.' } });
      return send(response, request.method === 'POST' ? 201 : 200, { data });
    } catch (error) {
      const status = error instanceof DomainError ? error.status : 500;
      const code = error instanceof DomainError ? error.code : 'internal_error';
      return send(response, status, { error: { code, message: status === 500 ? 'Coordinator could not complete the request.' : error.message } });
    }
  });

  return {
    listen(options = { host: '127.0.0.1', port: 0 }) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(options, () => { server.off('error', reject); resolve(server.address()); });
      });
    },
    close() {
      if (!server.listening) return Promise.resolve();
      return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
