import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoordinatorClient } from '../src/core/client.js';
import { createCoordinator } from '../src/core/coordinator.js';
import { createCoreDatabase } from '../src/core/database.js';

test('shares task state between independent coordinator clients', async (context) => {
  const core = createCoreDatabase();
  const coordinator = createCoordinator({ core });
  const address = await coordinator.listen({ host: '127.0.0.1', port: 0 });
  context.after(async () => { await coordinator.close(); core.close(); });
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const desktop = createCoordinatorClient({ baseUrl });
  const terminal = createCoordinatorClient({ baseUrl });

  assert.equal((await desktop.health()).version, 2);
  const project = await desktop.createProject({ name: 'Shared project' });
  const task = await desktop.createTask({ projectId: project.id, title: 'Shared task', description: 'Visible to both clients.' });
  const visible = await terminal.listTasks({ projectId: project.id });
  assert.equal(visible[0].id, task.id);

  const brief = await desktop.createBrief(task.id, { objective: 'Share context', context: 'A test brief.' });
  await desktop.approveBrief(brief.id);
  const briefed = await terminal.transitionTask(task.id, 'briefed', 'Ready to start');
  assert.equal(briefed.status, 'briefed');
  const session = await terminal.createSession({ taskId: task.id, briefId: brief.id, workingDirectory: '/tmp', terminalKind: 'loggie' });
  await terminal.transitionSession(session.id, 'running');
  await terminal.transitionTask(task.id, 'running', 'Terminal connected');
  assert.equal((await desktop.listSessions({ taskId: task.id }))[0].status, 'running');
  await terminal.transitionSession(session.id, 'completed');
  const writeUp = await terminal.createWriteUp(session.id, { summary: 'Coordinator workflow completed.' });
  assert.equal(writeUp.taskId, task.id);
  assert.ok((await desktop.listEvents()).some((event) => event.type === 'task.status_changed'));
});
