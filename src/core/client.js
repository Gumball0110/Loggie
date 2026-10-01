import http from 'node:http';

export function createCoordinatorClient({ baseUrl, socketPath, fetchImpl = fetch }) {
  if (!baseUrl && !socketPath) throw new Error('Coordinator client requires baseUrl or socketPath.');

  function requestSocket(path, { method, body }) {
    return new Promise((resolve, reject) => {
      const encoded = body === undefined ? null : JSON.stringify(body);
      const request = http.request({ socketPath, path, method, headers: encoded === null ? undefined : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(encoded) } }, (response) => {
        let data = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          try { resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, payload: JSON.parse(data) }); }
          catch (error) { reject(error); }
        });
      });
      request.on('error', reject);
      if (encoded !== null) request.write(encoded);
      request.end();
    });
  }

  async function request(path, { method = 'GET', body } = {}) {
    let result;
    if (socketPath) result = await requestSocket(path, { method, body });
    else {
      const response = await fetchImpl(new URL(path, baseUrl), { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      result = { ok: response.ok, status: response.status, payload: await response.json() };
    }
    if (!result.ok) {
      const error = new Error(result.payload.error?.message || `Coordinator request failed (${result.status}).`);
      error.code = result.payload.error?.code;
      error.status = result.status;
      throw error;
    }
    return result.payload.data;
  }

  return Object.freeze({
    health: () => request('/v1/health'),
    listProjects: () => request('/v1/projects'),
    getProject: (projectId) => request(`/v1/projects/${encodeURIComponent(projectId)}`),
    createProject: (project) => request('/v1/projects', { method: 'POST', body: project }),
    createTask: (task) => request('/v1/tasks', { method: 'POST', body: task }),
    getTask: (taskId) => request(`/v1/tasks/${encodeURIComponent(taskId)}`),
    listTasks: ({ status, projectId } = {}) => {
      const query = new URLSearchParams();
      if (status) query.set('status', status);
      if (projectId) query.set('projectId', projectId);
      return request(`/v1/tasks${query.size ? `?${query}` : ''}`);
    },
    createBrief: (taskId, brief) => request(`/v1/tasks/${encodeURIComponent(taskId)}/briefs`, { method: 'POST', body: brief }),
    getApprovedBrief: (taskId) => request(`/v1/tasks/${encodeURIComponent(taskId)}/briefs/approved`),
    approveBrief: (briefId) => request(`/v1/briefs/${encodeURIComponent(briefId)}/approve`, { method: 'POST', body: {} }),
    transitionTask: (taskId, to, reason) => request(`/v1/tasks/${encodeURIComponent(taskId)}/transition`, { method: 'POST', body: { to, reason } }),
    createSession: (session) => request('/v1/sessions', { method: 'POST', body: session }),
    listSessions: ({ status, taskId } = {}) => {
      const query = new URLSearchParams();
      if (status) query.set('status', status);
      if (taskId) query.set('taskId', taskId);
      return request(`/v1/sessions${query.size ? `?${query}` : ''}`);
    },
    transitionSession: (sessionId, to) => request(`/v1/sessions/${encodeURIComponent(sessionId)}/transition`, { method: 'POST', body: { to } }),
    createWriteUp: (sessionId, writeUp) => request(`/v1/sessions/${encodeURIComponent(sessionId)}/write-up`, { method: 'POST', body: writeUp }),
    listEvents: (after = 0) => request(`/v1/events?after=${encodeURIComponent(after)}`),
  });
}
