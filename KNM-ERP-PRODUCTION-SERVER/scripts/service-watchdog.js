/**
 * Enterprise Service Watchdog for Kafr Inja ERP Server
 * Keeps the server running continuously in background and auto-restarts on crash.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const LOG_FILE = path.join(LOGS_DIR, 'server-autostart.log');
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

function writeLog(message) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [Watchdog] ${message}\n`;
  process.stdout.write(entry);
  logStream.write(entry);
}

writeLog('====================================================');
writeLog('🚀 Enterprise Server Watchdog Initialized');
writeLog(`📁 Working Directory: ${ROOT_DIR}`);
writeLog('====================================================');

let restartCount = 0;
let lastRestartTime = Date.now();
let childProcess = null;

function startServer() {
  const now = Date.now();
  if (now - lastRestartTime > 60000) {
    // Reset crash count if running smoothly for over 1 minute
    restartCount = 0;
  }
  lastRestartTime = now;

  if (restartCount > 10) {
    writeLog('❌ Too many crash restarts within 1 minute. Pausing for 30 seconds...');
    setTimeout(() => {
      restartCount = 0;
      startServer();
    }, 30000);
    return;
  }

  writeLog(`[+] Launching node server.js (Attempt #${restartCount + 1})...`);

  childProcess = spawn('node', ['server.js'], {
    cwd: ROOT_DIR,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  childProcess.stdout.on('data', (data) => {
    logStream.write(data);
  });

  childProcess.stderr.on('data', (data) => {
    logStream.write(data);
  });

  childProcess.on('exit', (code, signal) => {
    writeLog(`⚠️ Server exited with code: ${code}, signal: ${signal}`);
    childProcess = null;

    if (signal === 'SIGINT' || signal === 'SIGTERM') {
      writeLog('🛑 Service stopped normally.');
      process.exit(0);
    } else {
      restartCount++;
      writeLog('🔄 Restarting server in 2 seconds...');
      setTimeout(startServer, 2000);
    }
  });
}

// Graceful termination handling
process.on('SIGINT', () => {
  writeLog('🛑 Received SIGINT. Shutting down child process...');
  if (childProcess) childProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  writeLog('🛑 Received SIGTERM. Shutting down child process...');
  if (childProcess) childProcess.kill('SIGTERM');
  process.exit(0);
});

startServer();
