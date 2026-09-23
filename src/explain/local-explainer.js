const ANSI_PATTERN = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const PROMPT_PATTERN = /^.*(?:%|\$|#)\s+/;

export function cleanTerminalOutput(value) {
  return String(value || '')
    .replace(ANSI_PATTERN, '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !PROMPT_PATTERN.test(line) && !/^[%$#>]$/.test(line.trim()))
    .join('\n')
    .trim();
}

function importantLines(lines) {
  const important = lines.filter((line) => /error|failed|failure|warning|warn|denied|not found|no such|too many|already in use|\b\d+\s+tests?\s+passed\b|\btests?\s+\d+\b|\bpass\s+\d+\b|\bfail\s+\d+\b/i.test(line));
  return [...new Set(important)].slice(-3);
}

function testResultSummary(output) {
  const tests = output.match(/(?:^|\n)[^\n]*tests?\s+(\d+)\b/i)?.[1];
  const passed = output.match(/(?:^|\n)[^\n]*pass\s+(\d+)\b/i)?.[1];
  const failed = output.match(/(?:^|\n)[^\n]*fail\s+(\d+)\b/i)?.[1];
  if (!tests && !passed && !failed) return '';
  const parts = [];
  if (tests) parts.push(`${tests} total`);
  if (passed) parts.push(`${passed} passed`);
  if (failed) parts.push(`${failed} failed`);
  return `${parts.join(', ')}.`;
}

export function summarizeOutput(output, exitCode) {
  const clean = cleanTerminalOutput(output);
  if (!clean) return Number(exitCode) === 0 ? 'The command produced no additional output.' : 'The command failed without providing error details.';
  const lines = clean.split('\n').map((line) => line.trim()).filter(Boolean);
  const important = importantLines(lines);
  if (important.length) return important.join(' · ');
  if (lines.length <= 2) return lines.join(' · ');
  return `${lines.length} lines of output. Last message: ${lines.at(-1)}`;
}

function firstArgument(command) {
  return command.trim().replace(/^\S+\s*/, '').trim();
}

function quotedCd(command) {
  const target = firstArgument(command);
  return target ? `cd "${target.replace(/^['"]|['"]$/g, '')}"` : '';
}

export function explainCommand(command, output, exitCode) {
  const clean = cleanTerminalOutput(output);
  const failed = Number(exitCode) !== 0;
  const trimmed = String(command || '').trim();
  const name = trimmed.split(/\s+/)[0] || 'command';
  const result = {
    title: failed ? 'Command failed' : 'Command completed',
    explanation: failed ? 'The terminal reported that the command failed.' : 'The terminal finished running this command.',
    suggestion: '',
    rawSummary: summarizeOutput(clean, exitCode),
  };

  if (name === 'cd') {
    result.title = failed ? 'Could not change folders' : 'Changed folders';
    result.explanation = failed ? 'The terminal could not open the folder you specified.' : `You are now in ${firstArgument(trimmed) || 'the requested folder'}.`;
    if (/too many arguments/i.test(clean)) {
      result.explanation = 'The folder path contains spaces, so the terminal treated it as multiple inputs.';
      result.suggestion = `Try this instead: ${quotedCd(trimmed)}`;
    } else if (/no such file|not found/i.test(clean)) {
      result.explanation = 'That folder could not be found. Its name, capitalization, or location may be incorrect.';
      result.suggestion = 'Run ls first to see which folders are available here.';
    }
    return result;
  }

  if (name === 'pwd') {
    return {
      ...result,
      title: 'Current location confirmed',
      explanation: clean ? `You are currently in: ${clean.split('\n').at(-1)}` : 'The terminal confirmed your current folder.',
    };
  }

  if (/^(ls|find)$/.test(name)) {
    result.title = failed ? 'Could not list files' : 'Files listed';
    result.explanation = failed ? 'The terminal could not read the files at that location.' : 'This command only viewed files. It did not change anything.';
  } else if (/^(npm|pnpm|yarn)$/.test(name) && /\btest\b/.test(trimmed)) {
    result.title = failed ? 'Some tests did not pass' : 'Tests completed';
    result.explanation = failed ? 'At least one automated test failed. Check the error summary for details.' : 'The automated tests completed successfully.';
    result.rawSummary = testResultSummary(clean) || result.rawSummary;
  } else if (/permission denied/i.test(clean)) {
    result.title = 'Permission denied';
    result.explanation = 'Your account does not have the file or system permission required for this action.';
    result.suggestion = 'Check the file owner and permissions before trying sudo.';
  } else if (/command not found/i.test(clean)) {
    result.title = 'Command not found';
    result.explanation = `The terminal could not find ${name}. It may not be installed or available in your PATH.`;
    result.suggestion = `Check whether ${name} is installed.`;
  } else if (/address already in use|port .*in use/i.test(clean)) {
    result.title = 'Port already in use';
    result.explanation = 'Another program is using the same port, so this service could not start.';
    result.suggestion = 'Stop the other service or choose a different port.';
  } else if (failed && clean) {
    result.explanation = `The most relevant terminal message is: ${result.rawSummary}`;
  }

  return result;
}
