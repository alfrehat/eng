const { app, BrowserWindow } = require('electron');
const { fork } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 3005;
const APP_URL = `http://localhost:${PORT}/`;
let serverProcess = null;
let mainWindow = null;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(maxAttempts = 60) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${APP_URL}api/stats`);
      if (response.ok) return;
    } catch (error) {
      // Retry until the local server is up.
    }
    await wait(500);
  }
  throw new Error('Local server did not become ready in time');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#0f172a',
    title: 'نظام إدارة الأشغال - بلدية كفرنجة',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadURL(APP_URL);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function start() {
  const serverPath = path.join(__dirname, 'server.js');
  serverProcess = fork(serverPath, [], { stdio: 'inherit' });

  serverProcess.on('exit', code => {
    if (code && code !== 0) {
      app.quit();
    }
  });

  await waitForServer();
  createWindow();
}

app.whenReady().then(start).catch(error => {
  console.error(error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});