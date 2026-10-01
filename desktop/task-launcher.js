import { spawn } from 'node:child_process';

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

export function taskTerminalCommand({ directoryPath, taskId, cliPath }) {
  if (typeof directoryPath !== 'string' || !directoryPath.startsWith('/')) throw new Error('Project needs an absolute directory before Loggie can start it.');
  if (typeof taskId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(taskId)) throw new Error('Task ID is invalid.');
  if (typeof cliPath !== 'string' || !cliPath.startsWith('/')) throw new Error('Loggie CLI path is invalid.');
  return `cd ${shellQuote(directoryPath)} && /usr/bin/env node ${shellQuote(cliPath)} --task ${shellQuote(taskId)}`;
}

export function launchTaskTerminal(options, { spawnImpl = spawn } = {}) {
  const command = taskTerminalCommand(options);
  const script = 'on run argv\ntell application "Terminal"\nactivate\ndo script item 1 of argv\nend tell\nend run';
  const child = spawnImpl('/usr/bin/osascript', ['-e', script, '--', command], { detached: true, stdio: 'ignore' });
  child.unref();
  return { launched: true };
}
