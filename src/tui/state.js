import { riskFor } from '../../server/event-normalizer.js';
import { explainCommand } from '../explain/local-explainer.js';

export function createTuiState() {
  return {
    command: '', cwd: process.cwd(), commandStatus: 'idle', commandStartedAt: null,
    durationMs: null, exitCode: null, risk: 'low', events: [],
    summaryTitle: '', explanation: '', suggestion: '', rawSummary: '',
  };
}

export function startCommand(state, command, cwd, now = Date.now()) {
  state.command = command;
  state.cwd = cwd || state.cwd;
  state.commandStatus = 'running';
  state.commandStartedAt = now;
  state.durationMs = null;
  state.exitCode = null;
  state.risk = riskFor('run_command', { CommandLine: command });
  state.summaryTitle = '正在執行指令';
  state.explanation = 'Terminal 正在執行這個指令。';
  state.suggestion = '';
  state.rawSummary = '';
}

export function finishCommand(state, exitCode, now = Date.now(), rawOutput = '') {
  state.commandStatus = Number(exitCode) === 0 ? 'complete' : 'error';
  state.exitCode = Number(exitCode);
  state.durationMs = state.commandStartedAt ? now - state.commandStartedAt : null;
  const explanation = explainCommand(state.command, rawOutput, exitCode);
  state.summaryTitle = explanation.title;
  state.explanation = explanation.explanation;
  state.suggestion = explanation.suggestion;
  state.rawSummary = explanation.rawSummary;
}

export function addAgentEvent(state, event) {
  state.events.unshift(event);
  state.events = state.events.filter((item, index, list) => {
    if (item.tool === 'model') return index === list.findIndex((candidate) => candidate.tool === 'model');
    return true;
  }).slice(0, 20);
  if (event.risk === 'high' || (event.risk === 'medium' && state.risk !== 'high')) state.risk = event.risk;
}
