const state = {
  current: 'running',
  command: 'npm run dev',
  timer: null,
  speechActive: false,
};

const copy = {
  running: {
    kicker: 'LOGGIE IS ON IT',
    title: 'starting your project',
    intro: 'I’m quietly checking the usual scary bits for you.',
    reassurance: 'everything looks good so far.<br>you don’t need to do anything right now.',
    companion: 'running',
    logs: '> npm run dev\n> vite v4.0.0 dev server starting...\n\nchecking dependencies...\n✓ dependencies look good\nbuilding your app...\n✓ client built in 482ms\nstarting local server...\n',
  },
  success: {
    kicker: 'A LITTLE UPDATE',
    title: 'your project is running :)',
    intro: 'Your app started successfully. Nice work.',
    reassurance: 'everything is ready to go.<br>your local project is waiting for you.',
    companion: 'success',
    logs: '> npm run dev\n> vite v4.0.0 dev server starting...\n\n✓ dependencies ready\n✓ client built in 482ms\n\nLocal:   http://localhost:3000/\nready in 1.2s.\n',
  },
  warning: {
    kicker: 'A LITTLE HEADS UP',
    title: 'your project is running :)',
    intro: 'It started normally, with two small things worth knowing.',
    reassurance: 'neither warning stops your project from working.<br>you can keep going for now.',
    companion: 'warning',
    logs: '> npm run dev\n> vite v4.0.0 dev server starting...\n\n✓ dependencies ready\n⚠ bundle size is larger than recommended\n⚠ update available for vite\n\nLocal:   http://localhost:3000/\n',
  },
  error: {
    kicker: 'I FOUND THE PROBLEM',
    title: 'something needs your attention :/',
    intro: 'one package is missing.',
    reassurance: '',
    companion: 'error',
    logs: '> npm run dev\n> vite v4.0.0 dev server starting...\n\nchecking dependencies...\nERROR: Cannot find module \'vite\'\n\nNode.js v20.11.0\n',
  },
};

const elements = {
  commandText: document.querySelector('#commandText'),
  commandInput: document.querySelector('#commandInput'),
  stateKicker: document.querySelector('#stateKicker'),
  stateTitle: document.querySelector('#stateTitle'),
  stateIntro: document.querySelector('#stateIntro'),
  reassurance: document.querySelector('#reassurance'),
  progressList: document.querySelector('#progressList'),
  progressServer: document.querySelector('[data-step="server"]'),
  errorDetails: document.querySelector('#errorDetails'),
  warningDetails: document.querySelector('#warningDetails'),
  successPanel: document.querySelector('#successPanel'),
  rawLogs: document.querySelector('#rawLogs'),
  logOutput: document.querySelector('#logOutput'),
  rawLogsButton: document.querySelector('#rawLogsButton'),
  rawLogsButtonText: document.querySelector('#rawLogsButtonText'),
  voiceButton: document.querySelector('#voiceButton'),
  voiceButtonText: document.querySelector('#voiceButtonText'),
  companion: document.querySelector('#companion'),
  lastUpdated: document.querySelector('#lastUpdated'),
};

function render(nextState) {
  state.current = nextState;
  const content = copy[nextState];
  elements.stateKicker.textContent = content.kicker;
  elements.stateTitle.innerHTML = `${content.title}${nextState === 'running' ? '<span class="title-tail">...</span>' : ''}`;
  elements.stateIntro.textContent = content.intro;
  elements.reassurance.innerHTML = content.reassurance;
  elements.logOutput.textContent = content.logs;
  elements.commandText.textContent = state.command;
  elements.lastUpdated.textContent = 'just now';
  if (!state.speechActive) {
    elements.voiceButtonText.textContent = nextState === 'error' ? 'explain this to me' : nextState === 'success' ? 'hear what happened' : 'explain what’s happening';
  }
  elements.errorDetails.hidden = nextState !== 'error';
  elements.warningDetails.hidden = nextState !== 'warning';
  elements.successPanel.hidden = nextState !== 'success' && nextState !== 'warning';
  elements.progressList.hidden = nextState === 'error' || nextState === 'success' || nextState === 'warning';
  elements.reassurance.hidden = nextState === 'error';
  elements.companion.dataset.mood = content.companion;

  if (nextState === 'running') {
    elements.progressServer.className = 'progress-item active';
    elements.progressServer.querySelector('.step-icon').textContent = '●';
  }
  if (nextState === 'success' || nextState === 'warning') {
    elements.progressServer.className = 'progress-item complete';
    elements.progressServer.querySelector('.step-icon').textContent = '✓';
  }
  updateDemoButtons();
}

function runCommand(command) {
  const nextCommand = command.trim() || 'npm run dev';
  state.command = nextCommand;
  window.clearTimeout(state.timer);
  closeLogs();
  render('running');
  state.timer = window.setTimeout(() => {
    const lowered = nextCommand.toLowerCase();
    if (lowered.includes('error') || lowered.includes('fail') || lowered.includes('missing')) {
      render('error');
    } else if (lowered.includes('warn') || lowered.includes('build')) {
      render('warning');
    } else {
      render('success');
    }
  }, 3000);
}

function explainCurrentState() {
  const explanations = {
    running: 'Your project has finished checking its dependencies and is now starting the local server. Everything is working normally, and you do not need to do anything right now.',
    success: 'Your project started successfully. The local server is ready, so you can open your project at localhost colon three thousand.',
    warning: 'Your project is running normally. There are two small warnings, but neither one stops your project from working.',
    error: 'Your project could not start because a package called Vite is missing. Your code is not necessarily broken. The next step is to install that package.',
  };
  if (!('speechSynthesis' in window)) {
    elements.voiceButtonText.textContent = 'voice is not supported here';
    return;
  }
  if (state.speechActive) {
    window.speechSynthesis.cancel();
    setSpeechState(false);
    return;
  }
  const utterance = new SpeechSynthesisUtterance(explanations[state.current]);
  utterance.rate = 0.96;
  utterance.pitch = 1.04;
  utterance.onend = () => setSpeechState(false);
  utterance.onerror = () => setSpeechState(false);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  setSpeechState(true);
}

function setSpeechState(active) {
  state.speechActive = active;
  elements.voiceButtonText.textContent = active ? 'stop explanation' : state.current === 'error' ? 'explain this to me' : state.current === 'success' ? 'hear what happened' : 'explain what’s happening';
  elements.voiceButton.classList.toggle('is-speaking', active);
  elements.voiceButton.querySelector('.button-icon').textContent = active ? '■' : '◖';
}

function openLogs() {
  elements.rawLogs.hidden = false;
  elements.rawLogsButtonText.textContent = 'hide raw logs';
  elements.rawLogs.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeLogs() {
  elements.rawLogs.hidden = true;
  elements.rawLogsButtonText.textContent = 'view raw logs';
}

function updateDemoButtons() {
  document.querySelectorAll('[data-demo-state]').forEach((button) => {
    button.classList.toggle('selected', button.dataset.demoState === state.current);
  });
}

document.querySelector('#commandForm').addEventListener('submit', (event) => {
  event.preventDefault();
  runCommand(elements.commandInput.value);
});

elements.rawLogsButton.addEventListener('click', () => {
  if (elements.rawLogs.hidden) openLogs();
  else closeLogs();
});
document.querySelector('#closeLogsButton').addEventListener('click', closeLogs);
elements.voiceButton.addEventListener('click', explainCurrentState);
document.querySelector('#fixButton').addEventListener('click', () => {
  elements.commandInput.value = 'npm install vite';
  runCommand('npm install vite');
});
document.querySelector('#openButton').addEventListener('click', () => {
  window.alert('In the full product, this would open your local project at http://localhost:3000.');
});
document.querySelectorAll('[data-demo-state]').forEach((button) => {
  button.addEventListener('click', () => {
    window.clearTimeout(state.timer);
    closeLogs();
    render(button.dataset.demoState);
  });
});

elements.commandInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') elements.commandInput.value = '';
});

render('running');
