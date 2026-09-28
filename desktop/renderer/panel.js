const composer = document.querySelector('#composer');
const message = document.querySelector('#message');
const conversation = document.querySelector('#conversation');

function addMessage(text, kind) {
  const bubble = document.createElement('p');
  bubble.className = `message ${kind}`;
  bubble.textContent = text;
  conversation.append(bubble);
  bubble.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

document.querySelector('#minimize').addEventListener('click', () => window.loggie.collapsePanel());
document.querySelector('#hide').addEventListener('click', () => window.loggie.hide());

composer.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = message.value.trim();
  if (!text) return;
  addMessage(text, 'user');
  message.value = '';
  try {
    const result = await window.loggie.submitMessage(text);
    addMessage(result.message, 'assistant');
  } catch {
    addMessage('I couldn’t process that message. Please try a shorter request.', 'assistant');
  }
});

message.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    composer.requestSubmit();
  }
});
