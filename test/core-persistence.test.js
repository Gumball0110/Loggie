import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCoreDatabase } from '../src/core/database.js';

test('persists the complete milestone zero relationship graph across restart', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'loggie-core-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'loggie.db');
  let core = createCoreDatabase({ path });
  const project = core.createProject({ name: 'Loggie', directoryPath: '/projects/loggie' });
  const task = core.createTask({ projectId: project.id, title: 'Build shared core', description: 'Make state durable.', priority: 90 });
  const brief = core.createBrief(task.id, { objective: 'Persist shared state', context: 'Desktop and terminal need one source of truth.', completionCriteria: ['State survives restart'] });
  core.approveBrief(brief.id);
  core.transitionTask(task.id, 'briefed');
  const session = core.createSession({ taskId: task.id, briefId: brief.id, workingDirectory: project.directoryPath });
  core.transitionSession(session.id, 'running');
  core.transitionTask(task.id, 'running');
  core.transitionSession(session.id, 'completed');
  const writeUp = core.createWriteUp(session.id, { summary: 'Shared state is durable.', workCompleted: ['Created SQLite core'], testsRun: ['node --test'] });
  core.transitionTask(task.id, 'done');
  const lastSequence = core.listEvents().at(-1).sequence;
  core.close();

  core = createCoreDatabase({ path });
  assert.equal(core.getProject(project.id).name, 'Loggie');
  assert.equal(core.getTask(task.id).status, 'done');
  assert.equal(core.getBrief(brief.id).status, 'approved');
  assert.equal(core.getSession(session.id).status, 'completed');
  assert.equal(core.getWriteUp(writeUp.id).summary, 'Shared state is durable.');
  assert.equal(core.listEvents().at(-1).sequence, lastSequence);
  core.close();
});

test('prevents duplicate source tasks and write-ups for active sessions', () => {
  const core = createCoreDatabase();
  const task = core.createTask({ title: 'Reply', description: 'Reply to a thread.', sourceType: 'gmail', sourceId: 'thread-1' });
  assert.throws(() => core.createTask({ title: 'Duplicate', description: 'Duplicate.', sourceType: 'gmail', sourceId: 'thread-1' }), /already exists/);
  const session = core.createSession({ taskId: task.id, workingDirectory: '/tmp' });
  assert.throws(() => core.createWriteUp(session.id, { summary: 'Too early.' }), /must be finished/);
  core.close();
});
