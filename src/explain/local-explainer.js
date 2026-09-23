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
  if (tests) parts.push(`共 ${tests} 項`);
  if (passed) parts.push(`${passed} 項通過`);
  if (failed) parts.push(`${failed} 項失敗`);
  return `${parts.join('，')}。`;
}

export function summarizeOutput(output, exitCode) {
  const clean = cleanTerminalOutput(output);
  if (!clean) return Number(exitCode) === 0 ? '指令沒有產生額外輸出。' : '指令失敗，但沒有提供錯誤細節。';
  const lines = clean.split('\n').map((line) => line.trim()).filter(Boolean);
  const important = importantLines(lines);
  if (important.length) return important.join(' · ');
  if (lines.length <= 2) return lines.join(' · ');
  return `共 ${lines.length} 行輸出；最後訊息：${lines.at(-1)}`;
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
    title: failed ? '指令沒有成功' : '指令已完成',
    explanation: failed ? 'Terminal 回報執行失敗。' : 'Terminal 已完成這個指令。',
    suggestion: '',
    rawSummary: summarizeOutput(clean, exitCode),
  };

  if (name === 'cd') {
    result.title = failed ? '無法切換資料夾' : '已切換資料夾';
    result.explanation = failed ? 'Terminal 沒有進入你指定的資料夾。' : `目前已進入 ${firstArgument(trimmed) || '指定的資料夾'}。`;
    if (/too many arguments/i.test(clean)) {
      result.explanation = '資料夾路徑包含空格，Terminal 把它拆成了多個參數。';
      result.suggestion = `請改用：${quotedCd(trimmed)}`;
    } else if (/no such file|not found/i.test(clean)) {
      result.explanation = '找不到這個資料夾，可能是名稱、大小寫或路徑位置不正確。';
      result.suggestion = '先執行 ls 查看目前位置有哪些資料夾。';
    }
    return result;
  }

  if (name === 'pwd') {
    return {
      ...result,
      title: '已確認目前位置',
      explanation: clean ? `你現在位於：${clean.split('\n').at(-1)}` : 'Terminal 已確認目前所在的資料夾。',
    };
  }

  if (/^(ls|find)$/.test(name)) {
    result.title = failed ? '無法列出檔案' : '已列出檔案';
    result.explanation = failed ? 'Terminal 無法讀取指定位置的檔案清單。' : '這個指令只是在查看檔案，沒有修改內容。';
  } else if (/^(npm|pnpm|yarn)$/.test(name) && /\btest\b/.test(trimmed)) {
    result.title = failed ? '測試沒有全部通過' : '測試已完成';
    result.explanation = failed ? '至少有一項自動測試失敗，需要查看錯誤重點。' : '自動測試成功完成。';
    result.rawSummary = testResultSummary(clean) || result.rawSummary;
  } else if (/permission denied/i.test(clean)) {
    result.title = '沒有足夠權限';
    result.explanation = '目前的帳號沒有執行這個操作所需的檔案或系統權限。';
    result.suggestion = '先確認檔案擁有者和權限，不要直接使用 sudo。';
  } else if (/command not found/i.test(clean)) {
    result.title = '找不到這個指令';
    result.explanation = `Terminal 找不到 ${name}，它可能尚未安裝或不在 PATH 中。`;
    result.suggestion = `先確認 ${name} 是否已安裝。`;
  } else if (/address already in use|port .*in use/i.test(clean)) {
    result.title = '連接埠已被使用';
    result.explanation = '另一個程式正在使用相同的 port，所以服務無法啟動。';
    result.suggestion = '關閉原本的服務，或改用另一個 port。';
  } else if (failed && clean) {
    result.explanation = `Terminal 的錯誤重點是：${result.rawSummary}`;
  }

  return result;
}
