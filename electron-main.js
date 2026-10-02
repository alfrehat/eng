/**
 * electron-main.js
 * 🖥️ مشغل سطح المكتب المؤسسي لنظام بلدية كفرنجة الجديدة
 * v2.0 - Anti-Gravity Enterprise Electron Desktop Packaging
 */

const { app, BrowserWindow, dialog } = require('electron');
const { fork } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 3005;
const APP_URL = `http://localhost:${PORT}/`;
let serverProcess = null;
let mainWindow = null;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(maxAttempts = 50) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${APP_URL}api/health`);
      if (response.ok) return true;
    } catch (e) {
      // انتظار استقرار الخادم
    }
    await wait(400);
  }
  return false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 750,
    backgroundColor: '#0a0f1d',
    title: 'نظام إدارة المشاريع والأشغال الهندسية — بلدية كفرنجة الجديدة',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadURL(APP_URL);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function start() {
  const serverPath = path.join(__dirname, 'server.js');
  
  // تشغيل خادم Node كعملية فرعية معزولة
  serverProcess = fork(serverPath, [], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'inherit'
  });

  serverProcess.on('exit', code => {
    if (code && code !== 0) {
      dialog.showErrorBox('خطأ في تشغيل النظام', `توقف خادم النظام المحلي بكود الخطأ: ${code}`);
      app.quit();
    }
  });

  const isReady = await waitForServer();
  if (!isReady) {
    dialog.showErrorBox('تعذر بدء الخدمة', `استغرق خادم النظام وقتاً طويلاً للإقلاع على المنفذ ${PORT}. يرجى التحقق من قاعدة البيانات.`);
    app.quit();
    return;
  }

  createWindow();
}

function cleanExit() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

app.whenReady().then(start).catch(error => {
  console.error('Electron initialization error:', error);
  cleanExit();
  app.quit();
});

app.on('window-all-closed', () => {
  cleanExit();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', cleanExit);