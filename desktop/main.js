import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, safeStorage, screen, shell, Tray } from 'electron';
import dotenv from 'dotenv';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GmailClient } from '../src/integrations/gmail/client.js';
import { readGmailConfig } from '../src/integrations/gmail/config.js';
import { GoogleOAuthClient } from '../src/integrations/gmail/oauth.js';
import { createGmailService } from '../src/integrations/gmail/service.js';
import { createCredentialStore } from '../src/security/credential-store.js';
import { isTrustedRendererUrl, validateCompanionPosition, validateSearchRequest, validateThreadId } from './ipc-validation.js';
import { companionBounds, panelBounds, shouldCollapsePanel, windowSizes } from './window-geometry.js';

const desktopDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = dirname(desktopDirectory);
const positionFileName = 'window-state.json';
const shortcut = 'CommandOrControl+Shift+L';

dotenv.config({ path: join(projectDirectory, '.env'), quiet: true });

let companionWindow;
let panelWindow;
let tray;
let isQuitting = false;
let saveTimer;
let gmailService;

app.setName('Loggie');

if (!app.requestSingleInstanceLock()) {
  app.exit(0);
}

function rendererPath(fileName) {
  return join(desktopDirectory, 'renderer', fileName);
}

function preloadPath() {
  return join(desktopDirectory, 'preload.cjs');
}

function statePath() {
  return join(app.getPath('userData'), positionFileName);
}

function credentialPath() {
  return join(app.getPath('userData'), 'gmail-credentials.enc');
}

async function readSavedPosition() {
  try {
    const parsed = JSON.parse(await readFile(statePath(), 'utf8'));
    return parsed.companion;
  } catch {
    return null;
  }
}

function saveCompanionPosition() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!companionWindow || companionWindow.isDestroyed()) return;
    const { x, y } = companionWindow.getBounds();
    try {
      await writeFile(statePath(), `${JSON.stringify({ companion: { x, y } }, null, 2)}\n`, 'utf8');
    } catch (error) {
      console.error(`Could not save Loggie's position: ${error.message}`);
    }
  }, 200);
}

function commonWebPreferences() {
  return {
    preload: preloadPath(),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  };
}

function lockDownRenderer(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:')) event.preventDefault();
  });
}

async function createCompanionWindow() {
  const savedPosition = await readSavedPosition();
  const display = savedPosition
    ? screen.getDisplayNearestPoint(savedPosition)
    : screen.getPrimaryDisplay();

  companionWindow = new BrowserWindow({
    ...companionBounds(display.workArea, savedPosition),
    acceptFirstMouse: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false,
    resizable: false,
    show: false,
    skipTaskbar: true,
    transparent: true,
    webPreferences: commonWebPreferences(),
  });
  companionWindow.setAlwaysOnTop(true, 'floating');
  companionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  lockDownRenderer(companionWindow);
  companionWindow.on('moved', saveCompanionPosition);
  companionWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      companionWindow.hide();
    }
  });
  await companionWindow.loadFile(rendererPath('companion.html'));
  companionWindow.showInactive();
}

function displayForAssistant() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}

async function createPanelWindow() {
  if (panelWindow && !panelWindow.isDestroyed()) return panelWindow;

  panelWindow = new BrowserWindow({
    ...panelBounds(displayForAssistant().workArea),
    alwaysOnTop: true,
    backgroundColor: '#fff2cc',
    closable: true,
    frame: false,
    maximizable: false,
    minWidth: 64,
    minimizable: true,
    resizable: true,
    show: false,
    skipTaskbar: true,
    title: 'Loggie',
    transparent: false,
    webPreferences: commonWebPreferences(),
  });
  panelWindow.setAlwaysOnTop(true, 'floating');
  panelWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  lockDownRenderer(panelWindow);
  panelWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      collapsePanel();
    }
  });
  panelWindow.on('minimize', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      collapsePanel();
    }
  });
  panelWindow.on('resize', () => {
    if (panelWindow?.isVisible() && shouldCollapsePanel(panelWindow.getBounds().width)) {
      collapsePanel();
    }
  });
  panelWindow.on('closed', () => { panelWindow = null; });
  await panelWindow.loadFile(rendererPath('panel.html'));
  return panelWindow;
}

async function expandPanel() {
  const assistant = await createPanelWindow();
  assistant.setBounds(panelBounds(displayForAssistant().workArea));
  companionWindow?.hide();
  assistant.show();
  assistant.focus();
}

function collapsePanel() {
  panelWindow?.hide();
  if (companionWindow && !companionWindow.isDestroyed()) companionWindow.showInactive();
}

async function togglePanel() {
  if (panelWindow?.isVisible()) collapsePanel();
  else await expandPanel();
}

app.on('second-instance', () => togglePanel());

function createTrayImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path fill="black" d="M4 5.2 6.2 3l1.5 2h2.6l1.5-2L14 5.2v6.6c0 2-1.7 3.7-3.7 3.7H7.7A3.7 3.7 0 0 1 4 11.8V5.2Z"/><circle fill="white" cx="7" cy="9" r="1"/><circle fill="white" cx="11" cy="9" r="1"/></svg>`;
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
  image.setTemplateImage(true);
  return image;
}

function createTray() {
  tray = new Tray(createTrayImage());
  tray.setToolTip('Loggie');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Loggie', click: expandPanel },
    { label: 'Show companion', click: collapsePanel },
    { type: 'separator' },
    { label: 'Quit Loggie', accelerator: 'CommandOrControl+Q', click: () => app.quit() },
  ]));
  tray.on('click', togglePanel);
}

function assertTrustedRenderer(event) {
  const source = event.senderFrame?.url || '';
  if (!isTrustedRendererUrl(source)) {
    throw new Error('Untrusted renderer request.');
  }
}

function publicError(error) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return message.replace(/Bearer\s+[\w.-]+/gi, 'Bearer [hidden]').slice(0, 300);
}

function handleSecure(channel, handler) {
  ipcMain.handle(channel, async (event, ...arguments_) => {
    try {
      assertTrustedRenderer(event);
      return { ok: true, data: await handler(...arguments_) };
    } catch (error) {
      return { ok: false, error: publicError(error) };
    }
  });
}

function registerIpc() {
  ipcMain.handle('loggie:toggle-panel', () => togglePanel());
  ipcMain.handle('loggie:collapse-panel', () => collapsePanel());
  ipcMain.handle('loggie:hide', () => {
    panelWindow?.hide();
    companionWindow?.hide();
  });
  ipcMain.handle('loggie:quit', () => app.quit());
  ipcMain.on('loggie:move-companion', (event, position) => {
    assertTrustedRenderer(event);
    if (!companionWindow || companionWindow.isDestroyed()) return;
    const requested = validateCompanionPosition(position);
    const display = screen.getDisplayNearestPoint(requested);
    const bounds = companionBounds(display.workArea, requested);
    companionWindow.setPosition(bounds.x, bounds.y, false);
  });
  handleSecure('gmail:status', () => gmailService.status());
  handleSecure('gmail:connect', () => gmailService.connect());
  handleSecure('gmail:cancel-connect', () => gmailService.cancelConnect());
  handleSecure('gmail:disconnect', () => gmailService.disconnect());
  handleSecure('gmail:search', (request) => {
    const validated = validateSearchRequest(request);
    return gmailService.search(validated.text, { limit: validated.limit, pageToken: validated.pageToken });
  });
  handleSecure('gmail:get-thread', (threadId) => gmailService.getThread(validateThreadId(threadId)));
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin') app.dock.hide();
  const gmailConfig = readGmailConfig({
    credentialsPath: join(projectDirectory, 'credentials', 'google-oauth.json'),
  });
  const credentialStore = createCredentialStore({ safeStorage, filePath: credentialPath() });
  const oauth = new GoogleOAuthClient({
    config: gmailConfig,
    credentialStore,
    openExternal: (url) => shell.openExternal(url),
  });
  const gmailClient = new GmailClient({ oauth });
  gmailService = createGmailService({
    oauth,
    client: gmailClient,
    configured: gmailConfig.configured,
    configurationError: gmailConfig.configurationError,
  });
  registerIpc();
  createTray();
  await createCompanionWindow();

  if (!globalShortcut.register(shortcut, togglePanel)) {
    console.warn(`Could not register the ${shortcut} shortcut.`);
  }

  if (process.env.LOGGIE_DESKTOP_SMOKE_TEST === '1') {
    const assistant = await createPanelWindow();
    const bridgeReady = await assistant.webContents.executeJavaScript(
      'typeof window.loggie?.collapsePanel === "function"',
    );
    if (!bridgeReady) {
      console.error('Desktop smoke test failed: the secure renderer bridge did not load.');
      process.exitCode = 1;
    }
    await expandPanel();
    const bounds = assistant.getBounds();
    assistant.setBounds({
      ...bounds,
      x: bounds.x + bounds.width - windowSizes.panelDismiss,
      width: windowSizes.panelDismiss,
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (assistant.isVisible() || !companionWindow.isVisible()) {
      console.error('Desktop smoke test failed: edge resizing did not collapse the panel.');
      process.exitCode = 1;
    }
    setTimeout(() => app.quit(), 500);
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createCompanionWindow();
  else togglePanel();
});

app.on('before-quit', () => {
  isQuitting = true;
  clearTimeout(saveTimer);
});

app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
