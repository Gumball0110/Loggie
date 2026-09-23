import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const zshIntegration = String.raw`# Generated temporarily by Loggie. Removed when the session exits.
if [[ -r "$LOGGIE_ORIGINAL_ZDOTDIR/.zshrc" ]]; then
  source "$LOGGIE_ORIGINAL_ZDOTDIR/.zshrc"
fi

autoload -Uz add-zsh-hook
typeset -g LOGGIE_ACTIVE_COMMAND=""

function _loggie_encode() {
  printf %s "$1" | base64 | tr -d '\n'
}

function _loggie_preexec() {
  LOGGIE_ACTIVE_COMMAND="$1"
  local encoded_command="$(_loggie_encode "$1")"
  local encoded_cwd="$(_loggie_encode "$PWD")"
  print -rn -- $'\e]697;loggie;start;'"$encoded_command"';'"$encoded_cwd"$'\a'
}

function _loggie_precmd() {
  local exit_code=$?
  if [[ -n "$LOGGIE_ACTIVE_COMMAND" ]]; then
    print -rn -- $'\e]697;loggie;end;'"$exit_code"$'\a'
    LOGGIE_ACTIVE_COMMAND=""
  fi
}

add-zsh-hook preexec _loggie_preexec
add-zsh-hook precmd _loggie_precmd
`;

export async function createZshIntegration() {
  const directory = await mkdtemp(join(tmpdir(), 'loggie-zsh-'));
  await writeFile(join(directory, '.zshrc'), zshIntegration, { mode: 0o600 });
  return {
    env: {
      ZDOTDIR: directory,
      LOGGIE_ORIGINAL_ZDOTDIR: process.env.ZDOTDIR || process.env.HOME || '',
    },
    async cleanup() {
      await rm(directory, { recursive: true, force: true });
    },
  };
}
