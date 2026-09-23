import * as pty from 'node-pty';
import xtermHeadless from '@xterm/headless';
import { chmod } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createEventServer } from '../events/event-server.js';
import { createZshIntegration } from '../shell/integration.js';
import { addAgentEvent, createTuiState, finishCommand, startCommand } from './state.js';
import { fitText, truncateMiddle, wrapText } from './text.js';
import { chip, columns as lineColumns, palette, panelLine, style } from './theme.js';

const CSI = '\u001b[';
const { Terminal } = xtermHeadless;
const require = createRequire(import.meta.url);

async function ensurePtyHelperExecutable() {
  if (process.platform !== 'darwin') return;
  const entry = require.resolve('node-pty');
  const packageRoot = dirname(dirname(entry));
  const candidates = [
    join(packageRoot, 'prebuilds', `darwin-${process.arch}`, 'spawn-helper'),
    join(packageRoot, 'build', 'Release', 'spawn-helper'),
  ];
  for (const candidate of candidates) {
    try { await chmod(candidate, 0o755); return; } catch {}
  }
}

function decode(value) {
  try { return Buffer.from(value || '', 'base64').toString('utf8'); } catch { return ''; }
}

function humanDuration(milliseconds) {
  if (milliseconds === null) return '';
  if (milliseconds < 1000) return `${milliseconds} ms`;
  return `${(milliseconds / 1000).toFixed(1)} s`;
}

function statusIcon(status) {
  if (status === 'running' || status === 'active') return '●';
  if (status === 'error') return '×';
  return '✓';
}

function eventIcon(event) {
  if (event.risk === 'high') return '!';
  if (event.risk === 'medium') return '▲';
  return statusIcon(event.status);
}

function panelLines(state, width, height) {
  const inner = Math.max(1, width - 2);
  const lines = [];
  const add = (text = '', options) => lines.push(options ? style(text, options) : text);
  const latestEvent = state.events[0];
  const isRunning = state.commandStatus === 'running';
  const statusText = isRunning ? '● LIVE' : '● READY';
  const brand = `${style('✦', { fg: palette.pink, bold: true })} ${style('loggie', { fg: palette.ink, bold: true })}`;
  const status = style(statusText, { fg: isRunning ? palette.green : palette.muted, bold: isRunning });
  add(lineColumns(brand, status, inner));

  if (height <= 8) {
    if (state.command) {
      add(`${style(statusIcon(state.commandStatus), { fg: state.commandStatus === 'error' ? palette.pink : palette.green, bold: true })} ${style(truncateMiddle(state.summaryTitle, inner - 3), { fg: palette.ink, bold: true })}`);
      add(style(truncateMiddle(state.explanation, inner), { fg: palette.muted }));
      const exit = state.commandStatus === 'running' ? 'running' : `exit ${state.exitCode ?? '-'}`;
      const duration = state.durationMs === null ? '' : ` | ${humanDuration(state.durationMs)}`;
      add(`${chip(`${state.risk.toUpperCase()} RISK`, state.risk)} ${style(`${exit}${duration}`, { fg: palette.muted })}`);
    } else {
      add(style('Run a command above.', { fg: palette.muted }));
    }
    if (latestEvent) add(`${style('AI', { fg: palette.pink, bold: true })} ${truncateMiddle(latestEvent.title, inner - 4)}`);
    return lines.slice(0, height).map((line) => panelLine(` ${line}`, width));
  }

  add('');
  if (!state.command) {
    add(style('YOUR TERMINAL', { fg: palette.pink, bold: true }));
    add('');
    for (const line of wrapText('Type a command on the left. Loggie will explain what happens.', inner, 3)) add(style(line, { fg: palette.muted }));
  } else if (latestEvent && isRunning) {
    add(style('WHAT THE AI IS DOING', { fg: palette.pink, bold: true }));
    add('');
    add(`${style(eventIcon(latestEvent), { fg: latestEvent.status === 'error' ? palette.pink : palette.cyan, bold: true })} ${style(latestEvent.title, { fg: palette.ink, bold: true })}`);
    for (const line of wrapText(latestEvent.description, inner, 3)) add(style(line, { fg: palette.muted }));
    add('');
    for (const event of state.events.slice(0, 4)) {
      const iconColor = event.risk === 'high' ? palette.pink : event.status === 'complete' ? palette.green : palette.cyan;
      add(`${style(eventIcon(event), { fg: iconColor, bold: true })} ${style(truncateMiddle(event.title, inner - 3), { fg: palette.ink })}`);
    }
  } else if (state.commandStatus === 'error') {
    add(style('LOGGIE FOUND THE PROBLEM', { fg: palette.pink, bold: true }));
    add('');
    add(`${style('×', { fg: palette.dangerInk, bg: palette.softPink, bold: true })} ${style(state.summaryTitle, { fg: palette.ink, bold: true })}`);
    add('');
    add(style('WHAT HAPPENED', { fg: palette.muted, bold: true }));
    for (const line of wrapText(state.explanation, inner, 4)) add(style(line, { fg: palette.ink }));
    if (state.suggestion) {
      add('');
      add(style('WHAT TO DO NEXT', { fg: palette.muted, bold: true }));
      for (const line of wrapText(state.suggestion, inner, 3)) add(style(line, { fg: palette.dangerInk, bg: palette.softPink, bold: true }));
    }
    if (state.rawSummary) {
      add('');
      add(style('ORIGINAL OUTPUT · SUMMARY', { fg: palette.muted, bold: true }));
      for (const line of wrapText(state.rawSummary, inner, 3)) add(style(line, { fg: palette.muted }));
    }
  } else if (isRunning) {
    add('');
    add(style(state.risk === 'high' ? 'PAUSE AND CHECK' : 'LOGGIE IS ON IT', { fg: palette.pink, bold: true }));
    add('');
    add(style(state.risk === 'high' ? 'this command needs attention.' : 'running your command...', { fg: palette.ink, bold: true }));
    add('');
    add(`${style('●', { fg: palette.pink, bold: true })} ${style(truncateMiddle(state.command, inner - 3), { fg: palette.ink })}`);
    add('');
    for (const line of wrapText(state.explanation, inner, 3)) add(style(line, { fg: palette.muted }));
  } else {
    add(style('ALL DONE', { fg: palette.green, bold: true }));
    add('');
    add(`${style('✓', { fg: palette.ink, bg: palette.lime, bold: true })} ${style(state.summaryTitle, { fg: palette.ink, bold: true })}`);
    add('');
    for (const line of wrapText(state.explanation, inner, 3)) add(style(line, { fg: palette.muted }));
    if (state.rawSummary) {
      add('');
      add(style('OUTPUT SUMMARY', { fg: palette.muted, bold: true }));
      for (const line of wrapText(state.rawSummary, inner, 3)) add(style(line, { fg: palette.ink }));
    }
    add('');
    add(style('everything looks good.', { fg: palette.ink }));
  }

  const technical = [];
  if (state.command) {
    technical.push(style('─'.repeat(inner), { fg: palette.line }));
    const duration = state.durationMs === null ? '' : humanDuration(state.durationMs);
    const result = isRunning ? 'running' : `exit ${state.exitCode ?? '-'}`;
    technical.push(lineColumns(chip(`${state.risk.toUpperCase()} RISK`, state.risk), style(`${result}${duration ? ` · ${duration}` : ''}`, { fg: palette.muted }), inner));
  }
  while (lines.length + technical.length < height) lines.push('');
  lines.push(...technical);
  return lines.slice(0, height).map((line) => panelLine(` ${line}`, width));
}

function calculateLayout(columns, rows) {
  if (columns >= 96) {
    const panelWidth = Math.min(42, Math.max(32, Math.floor(columns * 0.32)));
    return { mode: 'side', agentColumns: columns - panelWidth - 1, agentRows: rows, panelWidth, panelHeight: rows };
  }
  const panelHeight = Math.min(7, Math.max(5, Math.floor(rows * 0.25)));
  return { mode: 'bottom', agentColumns: columns, agentRows: Math.max(3, rows - panelHeight - 1), panelWidth: columns, panelHeight };
}

export async function startTui({ command, args = [], cwd = process.cwd() } = {}) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Loggie TUI needs an interactive terminal.');
  await ensurePtyHelperExecutable();

  const state = createTuiState();
  let columns = process.stdout.columns || 120;
  let rows = process.stdout.rows || 35;
  let layout = calculateLayout(columns, rows);
  let shellIntegration = null;
  let childCommand = command;
  let childArgs = args;
  const childEnv = { ...process.env, TERM: 'xterm-256color', LOGGIE_TUI: '1' };

  if (!childCommand) {
    shellIntegration = await createZshIntegration();
    childCommand = process.env.SHELL || '/bin/zsh';
    childArgs = ['-i'];
    Object.assign(childEnv, shellIntegration.env);
  }

  const terminal = new Terminal({
    cols: layout.agentColumns,
    rows: layout.agentRows,
    allowProposedApi: true,
    scrollback: 1000,
  });

  let renderTimer = null;
  let closed = false;
  let child;
  let shellPending = '';
  let captureActive = false;
  let rawOutput = '';
  const shellMarker = '\u001b]697;loggie;';

  function scheduleRender() {
    if (closed || renderTimer) return;
    renderTimer = setTimeout(() => {
      renderTimer = null;
      render();
    }, 24);
  }

  terminal.parser.registerOscHandler(697, (data) => {
    return data.startsWith('loggie;');
  });

  function appendCaptured(value) {
    if (!captureActive || !value) return;
    rawOutput += value;
    if (rawOutput.length > 100_000) rawOutput = rawOutput.slice(-100_000);
  }

  function processShellStream(chunk) {
    const input = shellPending + chunk;
    shellPending = '';
    let cursor = 0;

    while (cursor < input.length) {
      const markerIndex = input.indexOf(shellMarker, cursor);
      if (markerIndex === -1) {
        const lastEscape = input.lastIndexOf('\u001b');
        let contentEnd = input.length;
        if (lastEscape >= cursor && shellMarker.startsWith(input.slice(lastEscape))) {
          contentEnd = lastEscape;
          shellPending = input.slice(lastEscape);
        }
        appendCaptured(input.slice(cursor, contentEnd));
        break;
      }

      appendCaptured(input.slice(cursor, markerIndex));
      const sequenceEnd = input.indexOf('\u0007', markerIndex + shellMarker.length);
      if (sequenceEnd === -1) {
        shellPending = input.slice(markerIndex);
        break;
      }

      const payload = input.slice(markerIndex + shellMarker.length, sequenceEnd);
      const [type, first, second] = payload.split(';');
      if (type === 'start') {
        rawOutput = '';
        captureActive = true;
        startCommand(state, decode(first), decode(second));
      } else if (type === 'end') {
        captureActive = false;
        finishCommand(state, Number(first), Date.now(), rawOutput);
      }
      cursor = sequenceEnd + 1;
    }
    scheduleRender();
  }

  const events = [];
  let eventServer;
  let selectedPort;
  const preferredPort = Number(process.env.LOGGIE_PORT || 4317);
  for (let port = preferredPort; port < preferredPort + 10; port += 1) {
    const candidate = createEventServer({
      port,
      onEvent(event) {
        events.push(event);
        if (events.length > 100) events.shift();
        addAgentEvent(state, event);
        scheduleRender();
      },
      getEventCount: () => events.length,
    });
    try {
      await candidate.listen();
      eventServer = candidate;
      selectedPort = port;
      break;
    } catch (error) {
      if (error.code !== 'EADDRINUSE') {
        await shellIntegration?.cleanup();
        throw error;
      }
    }
  }
  if (!eventServer) {
    await shellIntegration?.cleanup();
    throw new Error(`No available local event port between ${preferredPort} and ${preferredPort + 9}.`);
  }
  childEnv.LOGGIE_PORT = String(selectedPort);

  try {
    child = pty.spawn(childCommand, childArgs, {
      name: 'xterm-256color', cols: layout.agentColumns, rows: layout.agentRows,
      cwd, env: childEnv,
    });
  } catch (error) {
    await eventServer.close();
    await shellIntegration?.cleanup();
    throw error;
  }

  function terminalLine(row, width) {
    const buffer = terminal.buffer.active;
    const line = buffer.getLine(buffer.viewportY + row);
    return fitText(line?.translateToString(true, 0, width) || '', width);
  }

  function render() {
    const panel = panelLines(state, layout.panelWidth, layout.panelHeight);
    let output = `${CSI}?25l`;
    if (layout.mode === 'side') {
      for (let row = 0; row < rows; row += 1) {
        output += `${CSI}${row + 1};1H${terminalLine(row, layout.agentColumns)}`;
        output += `${style('│', { fg: palette.line, bg: palette.panel })}${panel[row] || panelLine('', layout.panelWidth)}`;
      }
    } else {
      for (let row = 0; row < layout.agentRows; row += 1) {
        output += `${CSI}${row + 1};1H${terminalLine(row, layout.agentColumns)}`;
      }
      output += `${CSI}${layout.agentRows + 1};1H${style('─'.repeat(columns), { fg: palette.line, bg: palette.panel })}`;
      for (let row = 0; row < layout.panelHeight; row += 1) {
        output += `${CSI}${layout.agentRows + row + 2};1H${panel[row] || panelLine('', columns)}`;
      }
    }
    const buffer = terminal.buffer.active;
    output += `${CSI}${Math.min(layout.agentRows, buffer.cursorY + 1)};${Math.min(layout.agentColumns, buffer.cursorX + 1)}H${CSI}?25h`;
    process.stdout.write(output);
  }

  function resize() {
    columns = process.stdout.columns || columns;
    rows = process.stdout.rows || rows;
    layout = calculateLayout(columns, rows);
    terminal.resize(layout.agentColumns, layout.agentRows);
    child.resize(layout.agentColumns, layout.agentRows);
    process.stdout.write(`${CSI}2J`);
    scheduleRender();
  }

  async function cleanup() {
    if (closed) return;
    closed = true;
    if (renderTimer) clearTimeout(renderTimer);
    process.stdin.off('data', onInput);
    process.stdin.pause();
    process.stdout.off('resize', resize);
    process.off('SIGTERM', onSignal);
    process.off('SIGHUP', onSignal);
    if (process.stdin.isRaw) process.stdin.setRawMode(false);
    process.stdout.write(`${CSI}?25h${CSI}?1049l`);
    terminal.dispose();
    await eventServer.close();
    await shellIntegration?.cleanup();
  }

  function onInput(data) {
    child.write(data.toString());
  }

  async function onSignal() {
    child.kill();
    await cleanup();
    process.exit(1);
  }

  process.stdout.write(`${CSI}?1049h${CSI}2J${CSI}H`);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', onInput);
  process.stdout.on('resize', resize);
  process.on('SIGTERM', onSignal);
  process.on('SIGHUP', onSignal);
  child.onData((data) => {
    processShellStream(data);
    terminal.write(data, scheduleRender);
  });
  child.onExit(async ({ exitCode }) => {
    await cleanup();
    process.exitCode = exitCode;
  });
  scheduleRender();
}
