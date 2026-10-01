const applicationAliases = Object.freeze([
  { id: 'vscode', label: 'Visual Studio Code', aliases: ['visual studio code', 'vs code', 'vscode', 'code'] },
  { id: 'finder', label: 'Finder', aliases: ['finder', '檔案總管'] },
  { id: 'terminal', label: 'Terminal', aliases: ['terminal', '終端機', '終端'] },
]);

function detectApplication(text) {
  const lowered = text.toLowerCase();
  return applicationAliases.find((application) => application.aliases.some((alias) => lowered.includes(alias))) || null;
}

export function parseCommandIntent(input) {
  if (typeof input !== 'string' || !input.trim()) return { type: 'invalid', message: 'Tell Loggie what you want to do.' };
  const original = input.trim();
  const isOpen = /(?:打開|開啟|开启|open|show|reveal)/iu.test(original);
  if (!isOpen) return { type: 'unsupported', original };

  const application = detectApplication(original);
  let target = original;
  if (application) {
    const lowered = target.toLowerCase();
    const alias = [...application.aliases].sort((a, b) => b.length - a.length).find((candidate) => lowered.includes(candidate));
    const index = alias ? lowered.indexOf(alias) : -1;
    if (index >= 0) target = `${target.slice(0, index)} ${target.slice(index + alias.length)}`;
  }
  target = target
    .replace(/(?:請|请|麻煩|麻烦|幫我|帮我|可以|能不能)/gu, ' ')
    .replace(/(?:打開|開啟|开启|open|show|reveal)/giu, ' ')
    .replace(/(?:在|於|于|用|中|裡|里)\s*/gu, ' ')
    .replace(/\b(?:with|using|in)\b/giu, ' ')
    .replace(/(?:這個|这个)?(?:檔案|文件|資料夾|文件夹|專案|项目|project|folder|file)$/giu, ' ')
    .replace(/[「」“”"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!target) return { type: 'invalid', message: 'Tell Loggie which file, folder, or project to open.' };
  return { type: 'open', application: application?.id || 'default', applicationLabel: application?.label || 'the default app', target, original };
}

export const supportedApplications = applicationAliases;
