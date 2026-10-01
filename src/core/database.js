import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import {
  DomainError,
  asStringArray,
  assertSessionTransition,
  assertTaskTransition,
  optionalText,
  requireIdentifier,
  requireText,
  sessionStatuses,
  taskStatuses,
} from './domain.js';

const migration = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  directory_path TEXT,
  summary TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('waiting', 'briefed', 'running', 'blocked', 'done')),
  priority INTEGER NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'gmail', 'messages', 'whatsapp')),
  source_id TEXT,
  waiting_on TEXT,
  due_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS tasks_source_unique ON tasks(source_type, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_status_priority ON tasks(status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS tasks_project_status ON tasks(project_id, status);
CREATE TABLE IF NOT EXISTS briefs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  objective TEXT NOT NULL,
  context TEXT NOT NULL,
  constraints_json TEXT NOT NULL,
  suggested_steps_json TEXT NOT NULL,
  completion_criteria_json TEXT NOT NULL,
  assumptions_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'superseded')),
  created_at TEXT NOT NULL,
  UNIQUE(task_id, version)
);
CREATE INDEX IF NOT EXISTS briefs_task_version ON briefs(task_id, version DESC);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  brief_id TEXT REFERENCES briefs(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('starting', 'running', 'idle', 'blocked', 'failed', 'completed')),
  working_directory TEXT NOT NULL,
  process_id INTEGER,
  terminal_kind TEXT NOT NULL CHECK (terminal_kind IN ('loggie', 'claude', 'antigravity', 'shell')),
  started_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  ended_at TEXT
);
CREATE INDEX IF NOT EXISTS sessions_task_status ON sessions(task_id, status);
CREATE INDEX IF NOT EXISTS sessions_project_started ON sessions(project_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_active_task_unique ON sessions(task_id)
  WHERE task_id IS NOT NULL AND status IN ('starting', 'running', 'idle', 'blocked');
CREATE TABLE IF NOT EXISTS write_ups (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  work_completed_json TEXT NOT NULL,
  decisions_json TEXT NOT NULL,
  files_changed_json TEXT NOT NULL,
  tests_run_json TEXT NOT NULL,
  unresolved_items_json TEXT NOT NULL,
  suggested_next_steps_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS write_ups_project_created ON write_ups(project_id, created_at DESC);
CREATE TABLE IF NOT EXISTS domain_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
`;

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${randomUUID().replaceAll('-', '')}`;
const parseJson = (value) => JSON.parse(value || '[]');

function mapProject(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, directoryPath: row.directory_path, summary: row.summary, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapTask(row) {
  if (!row) return null;
  return { id: row.id, projectId: row.project_id, title: row.title, description: row.description, status: row.status, priority: row.priority, sourceType: row.source_type, sourceId: row.source_id, waitingOn: row.waiting_on, dueAt: row.due_at, completedAt: row.completed_at, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapBrief(row) {
  if (!row) return null;
  return { id: row.id, taskId: row.task_id, version: row.version, objective: row.objective, context: row.context, constraints: parseJson(row.constraints_json), suggestedSteps: parseJson(row.suggested_steps_json), completionCriteria: parseJson(row.completion_criteria_json), assumptions: parseJson(row.assumptions_json), status: row.status, createdAt: row.created_at };
}

function mapSession(row) {
  if (!row) return null;
  return { id: row.id, taskId: row.task_id, projectId: row.project_id, briefId: row.brief_id, status: row.status, workingDirectory: row.working_directory, processId: row.process_id, terminalKind: row.terminal_kind, startedAt: row.started_at, lastActivityAt: row.last_activity_at, endedAt: row.ended_at };
}

function mapWriteUp(row) {
  if (!row) return null;
  return { id: row.id, sessionId: row.session_id, taskId: row.task_id, projectId: row.project_id, summary: row.summary, workCompleted: parseJson(row.work_completed_json), decisions: parseJson(row.decisions_json), filesChanged: parseJson(row.files_changed_json), testsRun: parseJson(row.tests_run_json), unresolvedItems: parseJson(row.unresolved_items_json), suggestedNextSteps: parseJson(row.suggested_next_steps_json), createdAt: row.created_at, updatedAt: row.updated_at };
}

export function createCoreDatabase({ path = ':memory:' } = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path);
  database.pragma('foreign_keys = ON');
  database.pragma('journal_mode = WAL');
  database.exec(migration);
  database.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (1, ?)').run(now());

  const eventStatement = database.prepare('INSERT INTO domain_events(type, entity_id, payload_json, occurred_at) VALUES (?, ?, ?, ?)');
  const emit = (type, entityId, payload) => eventStatement.run(type, entityId, JSON.stringify(payload), now()).lastInsertRowid;
  const missing = (kind, entityId) => new DomainError(`${kind} was not found.`, { code: 'not_found', status: 404 });

  function createProject(input) {
    const timestamp = now();
    const project = { id: id('project'), name: requireText(input?.name, 'name', { max: 200 }), directoryPath: optionalText(input?.directoryPath, 'directoryPath', 2000), summary: optionalText(input?.summary, 'summary'), status: 'active', createdAt: timestamp, updatedAt: timestamp };
    database.transaction(() => {
      database.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?)').run(project.id, project.name, project.directoryPath, project.summary, project.status, project.createdAt, project.updatedAt);
      emit('project.created', project.id, project);
    })();
    return project;
  }

  function getProject(projectId) {
    requireIdentifier(projectId);
    return mapProject(database.prepare('SELECT * FROM projects WHERE id = ?').get(projectId));
  }

  function listProjects() {
    return database.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all().map(mapProject);
  }

  function createTask(input) {
    const timestamp = now();
    if (input?.projectId && !getProject(input.projectId)) throw missing('Project', input.projectId);
    const sourceType = input?.sourceType || 'manual';
    if (!['manual', 'gmail', 'messages', 'whatsapp'].includes(sourceType)) throw new DomainError('sourceType is invalid.');
    const priority = Number.isInteger(input?.priority) ? input.priority : 0;
    if (priority < -100 || priority > 100) throw new DomainError('priority must be between -100 and 100.');
    const task = { id: id('task'), projectId: input?.projectId || null, title: requireText(input?.title, 'title', { max: 300 }), description: requireText(input?.description, 'description'), status: 'waiting', priority, sourceType, sourceId: optionalText(input?.sourceId, 'sourceId', 500), waitingOn: optionalText(input?.waitingOn, 'waitingOn', 500), dueAt: optionalText(input?.dueAt, 'dueAt', 100), completedAt: null, createdAt: timestamp, updatedAt: timestamp };
    if (task.sourceId && database.prepare('SELECT id FROM tasks WHERE source_type = ? AND source_id = ?').get(task.sourceType, task.sourceId)) {
      throw new DomainError('A task already exists for this source.', { code: 'duplicate_source', status: 409 });
    }
    database.transaction(() => {
      database.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(task.id, task.projectId, task.title, task.description, task.status, task.priority, task.sourceType, task.sourceId, task.waitingOn, task.dueAt, task.completedAt, task.createdAt, task.updatedAt);
      emit('task.created', task.id, task);
    })();
    return task;
  }

  function getTask(taskId) {
    requireIdentifier(taskId);
    return mapTask(database.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId));
  }

  function listTasks({ status, projectId } = {}) {
    if (status && !taskStatuses.includes(status)) throw new DomainError('status is invalid.');
    if (projectId) requireIdentifier(projectId, 'projectId');
    const where = [];
    const values = [];
    if (status) { where.push('status = ?'); values.push(status); }
    if (projectId) { where.push('project_id = ?'); values.push(projectId); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return database.prepare(`SELECT * FROM tasks ${clause} ORDER BY priority DESC, created_at`).all(...values).map(mapTask);
  }

  function createBrief(taskId, input) {
    const task = getTask(taskId);
    if (!task) throw missing('Task', taskId);
    const timestamp = now();
    const version = database.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS version FROM briefs WHERE task_id = ?').get(taskId).version;
    const brief = { id: id('brief'), taskId, version, objective: requireText(input?.objective, 'objective'), context: requireText(input?.context, 'context'), constraints: asStringArray(input?.constraints, 'constraints'), suggestedSteps: asStringArray(input?.suggestedSteps, 'suggestedSteps'), completionCriteria: asStringArray(input?.completionCriteria, 'completionCriteria'), assumptions: asStringArray(input?.assumptions, 'assumptions'), status: 'draft', createdAt: timestamp };
    database.transaction(() => {
      database.prepare('INSERT INTO briefs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(brief.id, taskId, version, brief.objective, brief.context, JSON.stringify(brief.constraints), JSON.stringify(brief.suggestedSteps), JSON.stringify(brief.completionCriteria), JSON.stringify(brief.assumptions), brief.status, timestamp);
      emit('brief.created', brief.id, brief);
    })();
    return brief;
  }

  function getBrief(briefId) {
    requireIdentifier(briefId);
    return mapBrief(database.prepare('SELECT * FROM briefs WHERE id = ?').get(briefId));
  }

  function getApprovedBriefForTask(taskId) {
    if (!getTask(taskId)) throw missing('Task', taskId);
    return mapBrief(database.prepare("SELECT * FROM briefs WHERE task_id = ? AND status = 'approved' ORDER BY version DESC LIMIT 1").get(taskId));
  }

  function approveBrief(briefId) {
    const brief = getBrief(briefId);
    if (!brief) throw missing('Brief', briefId);
    return database.transaction(() => {
      database.prepare("UPDATE briefs SET status = 'superseded' WHERE task_id = ? AND status = 'approved'").run(brief.taskId);
      database.prepare("UPDATE briefs SET status = 'approved' WHERE id = ?").run(briefId);
      const approved = getBrief(briefId);
      emit('brief.approved', briefId, approved);
      return approved;
    })();
  }

  function transitionTask(taskId, to, reason = null) {
    const task = getTask(taskId);
    if (!task) throw missing('Task', taskId);
    const approved = database.prepare("SELECT id FROM briefs WHERE task_id = ? AND status = 'approved'").get(taskId);
    assertTaskTransition(task.status, to, { hasApprovedBrief: Boolean(approved) });
    const timestamp = now();
    const completedAt = to === 'done' ? timestamp : null;
    database.transaction(() => {
      database.prepare('UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?').run(to, completedAt, timestamp, taskId);
      emit('task.status_changed', taskId, { from: task.status, to, reason: optionalText(reason, 'reason', 1000), occurredAt: timestamp });
    })();
    return getTask(taskId);
  }

  function createSession(input) {
    const task = input?.taskId ? getTask(input.taskId) : null;
    if (input?.taskId && !task) throw missing('Task', input.taskId);
    const projectId = input?.projectId || task?.projectId || null;
    if (projectId && !getProject(projectId)) throw missing('Project', projectId);
    const brief = input?.briefId ? getBrief(input.briefId) : null;
    if (input?.briefId && (!brief || (task && brief.taskId !== task.id))) throw new DomainError('briefId does not belong to this task.');
    if (task && database.prepare("SELECT id FROM sessions WHERE task_id = ? AND status IN ('starting', 'running', 'idle', 'blocked')").get(task.id)) {
      throw new DomainError('Task already has an active session.', { code: 'active_session_exists', status: 409 });
    }
    const terminalKind = input?.terminalKind || 'loggie';
    if (!['loggie', 'claude', 'antigravity', 'shell'].includes(terminalKind)) throw new DomainError('terminalKind is invalid.');
    const timestamp = now();
    const session = { id: id('session'), taskId: task?.id || null, projectId, briefId: brief?.id || null, status: 'starting', workingDirectory: requireText(input?.workingDirectory, 'workingDirectory', { max: 2000 }), processId: Number.isInteger(input?.processId) ? input.processId : null, terminalKind, startedAt: timestamp, lastActivityAt: timestamp, endedAt: null };
    database.transaction(() => {
      database.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(session.id, session.taskId, session.projectId, session.briefId, session.status, session.workingDirectory, session.processId, session.terminalKind, session.startedAt, session.lastActivityAt, session.endedAt);
      emit('session.started', session.id, session);
    })();
    return session;
  }

  function getSession(sessionId) {
    requireIdentifier(sessionId);
    return mapSession(database.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId));
  }

  function listSessions({ status, taskId } = {}) {
    if (status && !sessionStatuses.includes(status)) throw new DomainError('status is invalid.');
    if (taskId) requireIdentifier(taskId, 'taskId');
    const where = [];
    const values = [];
    if (status) { where.push('status = ?'); values.push(status); }
    if (taskId) { where.push('task_id = ?'); values.push(taskId); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return database.prepare(`SELECT * FROM sessions ${clause} ORDER BY started_at DESC LIMIT 100`).all(...values).map(mapSession);
  }

  function transitionSession(sessionId, to) {
    const session = getSession(sessionId);
    if (!session) throw missing('Session', sessionId);
    if (!sessionStatuses.includes(to)) throw new DomainError('Session status is invalid.');
    assertSessionTransition(session.status, to);
    const timestamp = now();
    const endedAt = ['failed', 'completed'].includes(to) ? timestamp : null;
    database.transaction(() => {
      database.prepare('UPDATE sessions SET status = ?, last_activity_at = ?, ended_at = ? WHERE id = ?').run(to, timestamp, endedAt, sessionId);
      emit(endedAt ? 'session.finished' : 'session.updated', sessionId, { from: session.status, to, occurredAt: timestamp });
    })();
    return getSession(sessionId);
  }

  function createWriteUp(sessionId, input) {
    const session = getSession(sessionId);
    if (!session) throw missing('Session', sessionId);
    if (!['failed', 'completed'].includes(session.status)) throw new DomainError('Session must be finished before creating a write-up.', { code: 'session_active', status: 409 });
    const timestamp = now();
    const writeUp = { id: id('writeup'), sessionId, taskId: session.taskId, projectId: session.projectId, summary: requireText(input?.summary, 'summary'), workCompleted: asStringArray(input?.workCompleted, 'workCompleted'), decisions: asStringArray(input?.decisions, 'decisions'), filesChanged: asStringArray(input?.filesChanged, 'filesChanged'), testsRun: asStringArray(input?.testsRun, 'testsRun'), unresolvedItems: asStringArray(input?.unresolvedItems, 'unresolvedItems'), suggestedNextSteps: asStringArray(input?.suggestedNextSteps, 'suggestedNextSteps'), createdAt: timestamp, updatedAt: timestamp };
    database.transaction(() => {
      database.prepare('INSERT INTO write_ups VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(writeUp.id, sessionId, writeUp.taskId, writeUp.projectId, writeUp.summary, JSON.stringify(writeUp.workCompleted), JSON.stringify(writeUp.decisions), JSON.stringify(writeUp.filesChanged), JSON.stringify(writeUp.testsRun), JSON.stringify(writeUp.unresolvedItems), JSON.stringify(writeUp.suggestedNextSteps), timestamp, timestamp);
      emit('write_up.created', writeUp.id, writeUp);
    })();
    return writeUp;
  }

  function getWriteUp(writeUpId) {
    requireIdentifier(writeUpId);
    return mapWriteUp(database.prepare('SELECT * FROM write_ups WHERE id = ?').get(writeUpId));
  }

  function listEvents({ after = 0 } = {}) {
    if (!Number.isInteger(after) || after < 0) throw new DomainError('after must be a non-negative integer.');
    return database.prepare('SELECT * FROM domain_events WHERE sequence > ? ORDER BY sequence LIMIT 500').all(after).map((row) => ({ sequence: row.sequence, type: row.type, entityId: row.entity_id, payload: JSON.parse(row.payload_json), occurredAt: row.occurred_at }));
  }

  return { createProject, getProject, listProjects, createTask, getTask, listTasks, createBrief, getBrief, getApprovedBriefForTask, approveBrief, transitionTask, createSession, getSession, listSessions, transitionSession, createWriteUp, getWriteUp, listEvents, close: () => database.close() };
}
