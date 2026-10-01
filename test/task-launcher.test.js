import test from 'node:test';
import assert from 'node:assert/strict';
import { launchTaskTerminal, taskTerminalCommand } from '../desktop/task-launcher.js';

test('quotes task terminal paths without interpolating AppleScript', () => {
  const command = taskTerminalCommand({ directoryPath: "/tmp/Jess's Project", taskId: 'task_safe-1', cliPath: '/Applications/Loggie/bin/loggie.js' });
  assert.equal(command, "cd '/tmp/Jess'\"'\"'s Project' && /usr/bin/env node '/Applications/Loggie/bin/loggie.js' --task 'task_safe-1'");
  let invocation;
  const result = launchTaskTerminal({ directoryPath: '/tmp/project', taskId: 'task_1', cliPath: '/tmp/loggie.js' }, { spawnImpl(commandName, args, options) {
    invocation = { commandName, args, options };
    return { unref() {} };
  } });
  assert.equal(result.launched, true);
  assert.equal(invocation.commandName, '/usr/bin/osascript');
  assert.equal(invocation.args.at(-1), "cd '/tmp/project' && /usr/bin/env node '/tmp/loggie.js' --task 'task_1'");
  assert.doesNotMatch(invocation.args[1], /task_1/);
});
