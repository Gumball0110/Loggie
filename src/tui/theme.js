import { displayWidth, fitText } from './text.js';

const ESC = '\u001b[';
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

export const palette = {
  paper: '#f7f6f1',
  panel: '#fbfaf6',
  ink: '#171717',
  muted: '#77766f',
  line: '#deddd5',
  pink: '#f25a87',
  lime: '#d7f35b',
  cyan: '#9ce9e3',
  lavender: '#c8b9ff',
  softPink: '#ffe1e9',
  green: '#69ad6a',
  warningInk: '#765b00',
  dangerInk: '#a51e49',
};

const colorEnabled = !process.env.NO_COLOR && process.env.TERM !== 'dumb';

function rgb(hex) {
  const value = hex.replace('#', '');
  return [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16)];
}

export function style(text, { fg, bg, bold = false, dim = false } = {}) {
  if (!colorEnabled) return String(text);
  const codes = [];
  if (bold) codes.push('1');
  if (dim) codes.push('2');
  if (fg) codes.push(`38;2;${rgb(fg).join(';')}`);
  if (bg) codes.push(`48;2;${rgb(bg).join(';')}`);
  return `${ESC}${codes.join(';')}m${text}${ESC}0m`;
}

export function stripStyles(value) {
  return String(value || '').replace(ANSI_PATTERN, '');
}

export function styledWidth(value) {
  return displayWidth(stripStyles(value));
}

export function panelLine(content, width, { background = palette.panel } = {}) {
  const visible = stripStyles(content);
  if (displayWidth(visible) > width) return style(fitText(visible, width), { fg: palette.ink, bg: background });
  const padding = ' '.repeat(Math.max(0, width - displayWidth(visible)));
  if (!colorEnabled) return `${content}${padding}`;
  const [r, g, b] = rgb(background);
  const backgroundCode = `${ESC}48;2;${r};${g};${b}m`;
  const paintedContent = String(content).replaceAll(`${ESC}0m`, `${ESC}0m${backgroundCode}`);
  return `${backgroundCode}${paintedContent}${padding}${ESC}0m`;
}

export function columns(left, right, width) {
  const space = Math.max(1, width - styledWidth(left) - styledWidth(right));
  return `${left}${' '.repeat(space)}${right}`;
}

export function chip(label, risk) {
  if (risk === 'high') return style(` ${label} `, { fg: palette.dangerInk, bg: palette.softPink, bold: true });
  if (risk === 'medium') return style(` ${label} `, { fg: palette.warningInk, bg: '#fff0b8', bold: true });
  return style(` ${label} `, { fg: palette.muted, bg: '#ecebe5' });
}
