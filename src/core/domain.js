const TASK_STATUSES = new Set(['waiting', 'briefed', 'running', 'blocked', 'done']);
const SESSION_STATUSES = new Set(['starting', 'running', 'idle', 'blocked', 'failed', 'completed']);

const TASK_TRANSITIONS = Object.freeze({
  waiting: new Set(['briefed']),
  briefed: new Set(['waiting', 'running']),
  running: new Set(['waiting', 'blocked', 'done']),
  blocked: new Set(['waiting', 'running', 'done']),
  done: new Set(['waiting']),
});

const SESSION_TRANSITIONS = Object.freeze({
  starting: new Set(['running', 'failed']),
  running: new Set(['idle', 'blocked', 'failed', 'completed']),
  idle: new Set(['running', 'blocked', 'failed', 'completed']),
  blocked: new Set(['running', 'failed', 'completed']),
  failed: new Set(),
  completed: new Set(),
});

export class DomainError extends Error {
  constructor(message, { code = 'invalid_request', status = 400 } = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = status;
  }
}

export function requireText(value, field, { max = 10_000, optional = false } = {}) {
  if (optional && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'string' || !value.trim()) throw new DomainError(`${field} is required.`);
  const result = value.trim();
  if (result.length > max) throw new DomainError(`${field} is too long.`);
  return result;
}

export function optionalText(value, field, max = 10_000) {
  return requireText(value, field, { max, optional: true });
}

export function requireIdentifier(value, field = 'id') {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) {
    throw new DomainError(`${field} is invalid.`);
  }
  return value;
}

export function assertTaskTransition(from, to, { hasApprovedBrief = false } = {}) {
  if (!TASK_STATUSES.has(from) || !TASK_STATUSES.has(to)) throw new DomainError('Task status is invalid.');
  if (!TASK_TRANSITIONS[from].has(to)) {
    throw new DomainError(`Task cannot transition from ${from} to ${to}.`, { code: 'invalid_transition', status: 409 });
  }
  if (to === 'briefed' && !hasApprovedBrief) {
    throw new DomainError('Task needs an approved brief before it can be briefed.', { code: 'brief_required', status: 409 });
  }
}

export function assertSessionTransition(from, to) {
  if (!SESSION_STATUSES.has(from) || !SESSION_STATUSES.has(to)) throw new DomainError('Session status is invalid.');
  if (!SESSION_TRANSITIONS[from].has(to)) {
    throw new DomainError(`Session cannot transition from ${from} to ${to}.`, { code: 'invalid_transition', status: 409 });
  }
}

export function asStringArray(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new DomainError(`${field} must be an array of strings.`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

export const taskStatuses = Object.freeze([...TASK_STATUSES]);
export const sessionStatuses = Object.freeze([...SESSION_STATUSES]);
