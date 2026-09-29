const elements = Object.fromEntries([
  'accountName', 'accountNote', 'accountStatus', 'authorizationCard', 'backToResults', 'cancelConnect',
  'clearResults', 'composer', 'composerHint', 'connectGmail', 'connectionLabel', 'emailResults', 'intro',
  'loadMore', 'message', 'notice', 'resultList', 'resultSummary', 'searchButton', 'threadMessages',
  'threadParticipants', 'threadSubject', 'threadViewer',
].map((id) => [id, document.querySelector(`#${id}`)]));

const state = { connected: false, connecting: false, searching: false, queryText: '', nextPageToken: null, threads: [] };

function unwrap(response) {
  if (!response?.ok) throw new Error(response?.error || 'Loggie could not complete that request.');
  return response.data;
}

function setNotice(message, kind = 'error') {
  elements.notice.hidden = !message;
  elements.notice.className = `notice ${kind}`;
  elements.notice.textContent = message || '';
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
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
  elements.message.disabled = !state.connected || state.searching;
  elements.searchButton.disabled = !state.connected || state.searching;
  elements.composerHint.textContent = state.connected ? 'Gmail read-only · no sending' : 'Connect Gmail to search';
  elements.intro.textContent = state.connected
    ? 'Ask me to find an email without leaving what you’re working on.'
    : 'Connect Gmail to find and read the conversations you ask for.';
}

function renderResults() {
  elements.threadViewer.hidden = true;
  elements.emailResults.hidden = false;
  elements.resultList.replaceChildren();
  elements.resultSummary.textContent = state.threads.length > 1
    ? `I found ${state.threads.length} possible conversations. Choose the one you meant.`
    : state.threads.length === 1 ? 'I found one conversation.' : 'No matching conversations found.';

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
  } catch (error) {
    renderAccount(null, true);
    setNotice(error.message);
  }
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
  } catch (error) {
    setNotice(error.message);
    renderAccount(null, true);
  }
}

async function search({ append = false } = {}) {
  const text = append ? state.queryText : elements.message.value.trim();
  if (!text || state.searching) return;
  state.searching = true;
  state.queryText = text;
  elements.message.disabled = true;
  elements.searchButton.disabled = true;
  elements.composerHint.textContent = 'Looking through Gmail…';
  setNotice('Looking for matching conversations…', 'progress');
  try {
    const result = unwrap(await window.loggie.gmail.search({ text, limit: 10, pageToken: append ? state.nextPageToken : null }));
    state.threads = append ? [...state.threads, ...result.threads] : result.threads;
    state.nextPageToken = result.nextPageToken;
    renderResults();
    setNotice(state.threads.length ? '' : 'I couldn’t find a matching email. Try a sender address or a more specific topic.', 'empty');
  } catch (error) {
    setNotice(error.message);
  } finally {
    state.searching = false;
    elements.message.disabled = false;
    elements.searchButton.disabled = false;
    elements.composerHint.textContent = 'Gmail read-only · no sending';
  }
}

async function openThread(threadId) {
  setNotice('Reading the conversation…', 'progress');
  try {
    renderThread(unwrap(await window.loggie.gmail.getThread(threadId)));
    setNotice('');
  } catch (error) {
    setNotice(error.message);
  }
}

document.querySelector('#minimize').addEventListener('click', () => window.loggie.collapsePanel());
document.querySelector('#hide').addEventListener('click', () => window.loggie.hide());
elements.connectGmail.addEventListener('click', () => state.connected ? disconnect() : connect());
elements.cancelConnect.addEventListener('click', () => window.loggie.gmail.cancelConnect());
elements.clearResults.addEventListener('click', () => {
  state.threads = [];
  state.nextPageToken = null;
  elements.emailResults.hidden = true;
  setNotice('');
});
elements.backToResults.addEventListener('click', renderResults);
elements.loadMore.addEventListener('click', () => search({ append: true }));
elements.composer.addEventListener('submit', (event) => { event.preventDefault(); search(); });
elements.message.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    elements.composer.requestSubmit();
  }
});

loadStatus();
