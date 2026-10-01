import { readdir, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

function normalized(value) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function scoreName(name, target) {
  const candidate = normalized(name);
  const wanted = normalized(target);
  if (!candidate || !wanted) return 0;
  if (candidate === wanted) return 100;
  if (candidate.startsWith(wanted) || wanted.startsWith(candidate)) return 80;
  if (candidate.includes(wanted) || wanted.includes(candidate)) return 60;
  return 0;
}

async function walk(root, target, { maxDepth, deadline }, depth = 0, results = []) {
  if (depth > maxDepth || Date.now() > deadline) return results;
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); } catch { return results; }
  for (const entry of entries) {
    if (Date.now() > deadline || results.length >= 20) break;
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const path = join(root, entry.name);
    const score = scoreName(entry.name, target);
    if (score) results.push({ path, name: entry.name, kind: entry.isDirectory() ? 'directory' : 'file', score, source: 'filesystem' });
    if (entry.isDirectory()) await walk(path, target, { maxDepth, deadline }, depth + 1, results);
  }
  return results;
}

export async function resolveTarget({ target, projects = [], roots = [], maxDepth = 3, timeoutMs = 1500 }) {
  const direct = target.startsWith('/') ? resolve(target) : null;
  if (direct) {
    const info = await stat(direct).catch(() => null);
    if (info) return [{ path: direct, name: basename(direct), kind: info.isDirectory() ? 'directory' : 'file', score: 120, source: 'direct' }];
  }

  const known = [];
  for (const project of projects) {
    const score = scoreName(project.name, target);
    if (!score || !project.directoryPath) continue;
    const info = await stat(project.directoryPath).catch(() => null);
    if (info) known.push({ path: project.directoryPath, name: project.name, kind: info.isDirectory() ? 'directory' : 'file', score: score + 10, source: 'known-project' });
  }
  const discovered = [];
  const deadline = Date.now() + timeoutMs;
  for (const root of roots) await walk(root, target, { maxDepth, deadline }, 0, discovered);
  const unique = new Map();
  for (const result of [...known, ...discovered]) {
    const previous = unique.get(result.path);
    if (!previous || result.score > previous.score) unique.set(result.path, result);
  }
  return [...unique.values()].sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, 8);
}
