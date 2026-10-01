import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { stat } from 'node:fs/promises';
import { parseCommandIntent } from '../src/commands/intent-parser.js';
import { resolveTarget } from '../src/commands/target-resolver.js';

const applicationNames = Object.freeze({ vscode: 'Visual Studio Code', terminal: 'Terminal' });

function runOpen(arguments_, spawnImpl = spawn) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl('/usr/bin/open', arguments_, { stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error('macOS could not open that item.')));
  });
}

export async function executeOpenAction({ application, path }, { shell, spawnImpl = spawn } = {}) {
  if (!['vscode', 'finder', 'terminal', 'default'].includes(application)) throw new Error('Application is not supported.');
  const info = await stat(path).catch(() => null);
  if (!info) throw new Error('The selected file or folder no longer exists.');
  if (application === 'finder') {
    shell.showItemInFolder(path);
    return;
  }
  if (application === 'default') {
    const error = await shell.openPath(path);
    if (error) throw new Error(error);
    return;
  }
  await runOpen(['-a', applicationNames[application], path], spawnImpl);
}

export function createCommandService({ coreClient, shell, roots = [join(homedir(), 'Documents'), join(homedir(), 'Desktop'), join(homedir(), 'Downloads')], spawnImpl = spawn }) {
  async function execute(text) {
    const intent = parseCommandIntent(text);
    if (intent.type !== 'open') return intent;
    const candidates = await resolveTarget({ target: intent.target, projects: await coreClient.listProjects(), roots });
    if (!candidates.length) return { status: 'not_found', intent, message: `I couldn’t find “${intent.target}” on this Mac.` };
    const best = candidates[0];
    const similarlyRanked = candidates.filter((candidate) => candidate.score >= best.score - 5);
    if (similarlyRanked.length > 1) return { status: 'needs_choice', intent, message: `I found ${similarlyRanked.length} matches for “${intent.target}”.`, candidates: similarlyRanked };
    await executeOpenAction({ application: intent.application, path: best.path }, { shell, spawnImpl });
    return { status: 'completed', intent, target: best, message: `Opened ${best.name} in ${intent.applicationLabel}.` };
  }

  async function openResolved({ application, path }) {
    await executeOpenAction({ application, path }, { shell, spawnImpl });
    return { status: 'completed', target: { path, name: path.split('/').at(-1) }, message: `Opened ${path.split('/').at(-1)}.` };
  }

  return { execute, openResolved };
}
