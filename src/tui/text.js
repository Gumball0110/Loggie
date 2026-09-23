function characterWidth(character) {
  const code = character.codePointAt(0);
  if (code === undefined || code === 0) return 0;
  if (code < 32 || (code >= 0x7f && code < 0xa0)) return 0;
  if (
    code >= 0x1100 &&
    (code <= 0x115f || code === 0x2329 || code === 0x232a ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xac00 && code <= 0xd7a3) || (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) || (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) || (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x1f300 && code <= 0x1faff))
  ) return 2;
  return 1;
}

export function displayWidth(value) {
  let width = 0;
  for (const character of String(value || '')) width += characterWidth(character);
  return width;
}

export function fitText(value, width) {
  const clean = String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  let output = '';
  let used = 0;
  for (const character of clean) {
    const size = characterWidth(character);
    if (used + size > width) break;
    output += character;
    used += size;
  }
  return output + ' '.repeat(Math.max(0, width - used));
}

export function truncateMiddle(value, width) {
  const text = String(value || '');
  if (fitText(text, width).trimEnd() === text) return text;
  if (width < 5) return fitText(text, width).trimEnd();
  const side = Math.floor((width - 3) / 2);
  return `${text.slice(0, side)}...${text.slice(-side)}`;
}

export function wrapText(value, width, maxLines = 3) {
  const lines = [];
  let current = '';
  let used = 0;
  for (const character of String(value || '')) {
    const size = characterWidth(character);
    if (used + size > width && current) {
      lines.push(current);
      current = '';
      used = 0;
      if (lines.length === maxLines) break;
    }
    current += character;
    used += size;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}
