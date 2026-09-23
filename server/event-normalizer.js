const WRITE_TOOLS = new Set(['write_to_file', 'replace_file_content', 'multi_replace_file_content']);
const READ_TOOLS = new Set(['view_file', 'list_dir', 'find_by_name', 'grep_search', 'read_url_content']);

function commandFrom(args = {}) {
  return args.CommandLine || args.command || '';
}

function targetFrom(args = {}) {
  return args.TargetFile || args.AbsolutePath || args.DirectoryPath || args.SearchPath || args.Url || '';
}

export function riskFor(tool, args = {}) {
  const command = commandFrom(args).toLowerCase();
  if (/\brm\s+(-[^ ]*r|--recursive)|\bsudo\b|\bkill\s+-9\b|\b(mkfs|diskutil\s+erase|dd\s+if=)\b|git\s+(reset\s+--hard|push\s+.*--force)/.test(command)) return 'high';
  if (/npm\s+(install|i)\b|pnpm\s+(add|install)\b|yarn\s+add\b|curl\b|wget\b/.test(command)) return 'medium';
  if (WRITE_TOOLS.has(tool)) return 'medium';
  if (/^\s*(cp|mv|mkdir|touch|chmod|chown)\b|git\s+(add|commit|merge|rebase|checkout|switch)\b|npm\s+(run\s+build|publish)\b/.test(command)) return 'medium';
  return 'low';
}

function describe(tool, args = {}, kind, error) {
  const target = targetFrom(args);
  const command = commandFrom(args);
  const completed = kind === 'post-tool';
  if (error) return { title: `${tool} ran into a problem`, description: error };
  if (tool === 'run_command') {
    return {
      title: completed ? 'finished a terminal command' : 'preparing a terminal command',
      description: command || 'The agent is using the terminal.',
    };
  }
  if (WRITE_TOOLS.has(tool)) {
    return {
      title: completed ? 'finished changing a file' : 'preparing to change a file',
      description: target || 'The agent is editing your project.',
    };
  }
  if (READ_TOOLS.has(tool)) {
    return {
      title: completed ? 'finished checking project information' : 'checking project information',
      description: target || `Using ${tool.replaceAll('_', ' ')}.`,
    };
  }
  if (kind === 'stop') {
    return {
      title: error ? 'the agent stopped with an error' : 'the agent finished this task',
      description: error || 'No more actions are currently running.',
    };
  }
  return {
    title: completed ? `finished ${tool.replaceAll('_', ' ')}` : `using ${tool.replaceAll('_', ' ')}`,
    description: target || 'Antigravity is working on your request.',
  };
}

export function normalizeEvent(input = {}) {
  const payload = input.payload || {};
  const kind = input.kind || 'event';
  const tool = payload.toolCall?.name || (kind.includes('invocation') ? 'model' : kind === 'stop' ? 'session' : 'agent');
  const args = payload.toolCall?.args || {};
  const error = payload.error || '';
  const words = describe(tool, args, kind, error);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    provider: 'antigravity',
    kind,
    phase: kind.startsWith('pre-') ? 'before' : kind.startsWith('post-') || kind === 'stop' ? 'after' : 'during',
    category: tool === 'run_command' ? 'execute' : WRITE_TOOLS.has(tool) ? 'write' : READ_TOOLS.has(tool) ? 'read' : 'agent',
    tool,
    title: words.title,
    description: words.description,
    command: commandFrom(args),
    target: targetFrom(args),
    risk: riskFor(tool, args),
    status: error ? 'error' : kind === 'post-tool' || kind === 'stop' ? 'complete' : 'active',
    error,
    sessionId: payload.conversationId || 'starting',
    model: payload.modelName || '',
    workspace: payload.workspacePaths?.[0] || '',
    step: payload.stepIdx ?? payload.invocationNum ?? null,
    timestamp: new Date().toISOString(),
    raw: payload,
  };
}
