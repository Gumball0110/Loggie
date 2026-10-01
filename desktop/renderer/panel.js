const elements = Object.fromEntries([
  'accountName', 'accountNote', 'accountStatus', 'authorizationCard', 'backToResults', 'cancelConnect',
  'clearCommands', 'clearResults', 'commandHistory', 'composer', 'composerHint', 'connectGmail',
  'connectionLabel', 'emailResults', 'loadMore', 'message', 'notice', 'resultList', 'resultSummary',
  'searchButton', 'threadMessages', 'threadParticipants', 'threadSubject', 'threadViewer',
].map((id) => [id, document.querySelector(`#${id}`)]));

const state = { connected: false, connecting: false, busy: false, queryText: '', nextPageToken: null, threads: [] };

function unwrap(response) {
  if (!response?.ok) throw new Error(response?.error || 'Loggie could not complete that request.');
  return response.data;
}

function setNotice(message, kind = 'error') {
  elements.notice.hidden = !message;
  elements.notice.className = `notice ${kind}`;
  elements.notice.textContent = message || '';
}

function setBusy(busy, hint = null) {
  state.busy = busy;
  elements.message.disabled = busy;
  elements.searchButton.disabled = busy;
  elements.composerHint.textContent = hint || 'Open files and folders · Gmail read-only';
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function addCommandMessage(kind, message, { detail = null, candidates = null, application = null } = {}) {
  const article = document.createElement('article');
  article.className = `command-message ${kind}`;
  const copy = document.createElement('p');
  copy.textContent = message;
  article.append(copy);
  if (detail) {
    const metadata = document.createElement('code');
    metadata.textContent = detail;
    article.append(metadata);
  }
  if (candidates?.length) {
    const choices = document.createElement('div');
    choices.className = 'command-choices';
    for (const candidate of candidates) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = candidate.path;
      button.addEventListener('click', () => openChoice(application, candidate));
      choices.append(button);
    }
    article.append(choices);
  }
  elements.commandHistory.append(article);
  article.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function openChoice(application, candidate) {
  setBusy(true, 'Opening your selection…');
  try {
    const result = unwrap(await window.loggie.command.openResolved({ application, path: candidate.path }));
    addCommandMessage('assistant success', result.message, { detail: candidate.path });
  } catch (error) { addCommandMessage('assistant error', error.message); }
  finally { setBusy(false); }
}

function isEmailRequest(text) {
  return /(?:email|mail|gmail|郵件|邮件|信件)/iu.test(text);
}

async function runCommand(text) {
  addCommandMessage('user', text);
  setBusy(true, 'Understanding your request…');
  try {
    if (isEmailRequest(text)) {
      if (!state.connected) addCommandMessage('assistant error', 'Connect Gmail first, then ask me to find an email.');
      else await search({ text });
      return;
    }
    const result = unwrap(await window.loggie.command.execute(text));
    if (result.status === 'completed') addCommandMessage('assistant success', result.message, { detail: result.target.path });
    else if (result.status === 'needs_choice') addCommandMessage('assistant', result.message, { candidates: result.candidates, application: result.intent.application });
    else if (result.status === 'not_found') addCommandMessage('assistant error', result.message);
    else if (result.type === 'invalid') addCommandMessage('assistant error', result.message);
    else addCommandMessage('assistant', 'I can currently open files and folders in VS Code, Finder, Terminal, or their default app.');
  } catch (error) { addCommandMessage('assistant error', error.message); }
  finally { setBusy(false); }
}

function renderAccount(account = null, configured = true) {
  state.connected = Boolean(account);
  const label = elements.connectionLabel.querySelector('span:last-child');
  elements.connectionLabel.classList.toggle('connected', state.connected);
  label.textContent = state.connected ? account.emailAddress : 'Gmail disconnected';
  elements.accountName.textContent = state.connected ? account.emailAddress : 'Gmail';
  elements.accountStatus.textContent = state.connected ? 'Read-only access' : configured ? 'Not connected' : 'Developer setup required';
  elements.connectGmail.textContent = state.connected ? 'Disconnect' : 'Connect';
  elements.connectGmail.disabled = !configured || state.connecting;
  elements.accountNote.textContent = configured
    ? state.connected ? 'Loggie can only read email you ask for. It cannot send messages.' : 'Loggie requests read-only Gmail access and cannot send email.'
    : 'Place your Desktop OAuth JSON at credentials/google-oauth.json, then restart Loggie.';
}

function renderResults() {
  elements.threadViewer.hidden = true;
  elements.emailResults.hidden = false;
  elements.resultList.replaceChildren();
  elements.resultSummary.textContent = state.threads.length > 1 ? `I found ${state.threads.length} possible conversations. Choose the one you meant.` : state.threads.length === 1 ? 'I found one conversation.' : 'No matching conversations found.';
  for (const thread of state.threads) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'result-card';
    const heading = document.createElement('strong');
    heading.textContent = thread.subject;
    const metadata = document.createElement('span');
    metadata.textContent = `${thread.messages.at(-1)?.from || 'Unknown sender'} · ${formatDate(thread.latestTimestamp)}`;
    const snippet = document.createElement('p');
    snippet.textContent = thread.snippet || 'No preview available.';
    button.append(heading, metadata, snippet);
    button.addEventListener('click', () => openThread(thread.id));
    elements.resultList.append(button);
  }
  elements.loadMore.hidden = !state.nextPageToken;
}

function renderThread(thread) {
  elements.emailResults.hidden = true;
  elements.threadViewer.hidden = false;
  elements.threadSubject.textContent = thread.subject;
  elements.threadParticipants.textContent = thread.participants.join(' · ');
  elements.threadMessages.replaceChildren();
  for (const message of thread.messages) {
    const article = document.createElement('article');
    article.className = 'email-message';
    const header = document.createElement('header');
    const sender = document.createElement('strong');
    sender.textContent = message.from || 'Unknown sender';
    const date = document.createElement('time');
    date.textContent = formatDate(message.timestamp);
    header.append(sender, date);
    const recipient = document.createElement('p');
    recipient.className = 'message-recipient';
    recipient.textContent = `To: ${message.to || 'Unknown recipient'}`;
    const body = document.createElement('p');
    body.className = 'message-body';
    body.textContent = message.body || 'This message does not contain a supported text body.';
    article.append(header, recipient, body);
    elements.threadMessages.append(article);
  }
}

async function loadStatus() {
  try {
    const status = unwrap(await window.loggie.gmail.status());
    renderAccount(status.connected ? status.account : null, status.configured);
    if (status.error) setNotice(status.error);
  } catch (error) { renderAccount(null, true); setNotice(error.message); }
}

async function connect() {
  state.connecting = true;
  elements.authorizationCard.hidden = false;
  setNotice('');
  renderAccount(null, true);
  try {
    const account = unwrap(await window.loggie.gmail.connect());
    elements.authorizationCard.hidden = true;
    state.connecting = false;
    renderAccount(account, true);
    setNotice(`Connected to ${account.emailAddress}.`, 'success');
  } catch (error) {
    elements.authorizationCard.hidden = true;
    state.connecting = false;
    renderAccount(null, true);
    setNotice(error.message);
  }
}

async function disconnect() {
  elements.connectGmail.disabled = true;
  try {
    unwrap(await window.loggie.gmail.disconnect());
    state.threads = [];
    elements.emailResults.hidden = true;
    elements.threadViewer.hidden = true;
    renderAccount(null, true);
    setNotice('Gmail has been disconnected.', 'success');
  } catch (error) { setNotice(error.message); renderAccount(null, true); }
}

async function search({ append = false, text = null } = {}) {
  const query = append ? state.queryText : text;
  if (!query) return;
  state.queryText = query;
  elements.composerHint.textContent = 'Looking through Gmail…';
  try {
    const result = unwrap(await window.loggie.gmail.search({ text: query, limit: 10, pageToken: append ? state.nextPageToken : null }));
    state.threads = append ? [...state.threads, ...result.threads] : result.threads;
    state.nextPageToken = result.nextPageToken;
    renderResults();
    addCommandMessage('assistant', state.threads.length ? `I found ${state.threads.length} matching conversation${state.threads.length === 1 ? '' : 's'}.` : 'I couldn’t find a matching email.');
  } catch (error) { addCommandMessage('assistant error', error.message); }
}

async function openThread(threadId) {
  setNotice('Reading the conversation…', 'progress');
  try { renderThread(unwrap(await window.loggie.gmail.getThread(threadId))); setNotice(''); }
  catch (error) { setNotice(error.message); }
}

document.querySelector('#minimize').addEventListener('click', () => window.loggie.collapsePanel());
document.querySelector('#hide').addEventListener('click', () => window.loggie.hide());
elements.connectGmail.addEventListener('click', () => state.connected ? disconnect() : connect());
elements.cancelConnect.addEventListener('click', () => window.loggie.gmail.cancelConnect());
elements.clearCommands.addEventListener('click', () => { elements.commandHistory.replaceChildren(); addCommandMessage('assistant', 'What would you like me to open?'); });
elements.clearResults.addEventListener('click', () => { state.threads = []; state.nextPageToken = null; elements.emailResults.hidden = true; setNotice(''); });
elements.backToResults.addEventListener('click', renderResults);
elements.loadMore.addEventListener('click', () => search({ append: true }));
elements.composer.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = elements.message.value.trim();
  if (!text || state.busy) return;
  elements.message.value = '';
  runCommand(text);
});
elements.message.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); elements.composer.requestSubmit(); }
});

loadStatus();
