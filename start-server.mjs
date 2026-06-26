/**
 * start-server.mjs
 * 
 * Automatically starts the Python font server before React dev server.
 * Run with: node start-server.mjs
 * Or via:   npm run dev (which calls this first)
 */

import { spawn, exec } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, 'server', 'server.py');
const PORT = 5001;

// Colors for console output
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const BLUE   = '\x1b[34m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

function log(color, msg) {
  console.log(`${color}${msg}${RESET}`);
}

// Check if Python server is already running
function checkServerRunning() {
  return new Promise((resolve) => {
    fetch(`http://localhost:${PORT}/health`)
      .then(r => resolve(r.ok))
      .catch(() => resolve(false));
  });
}

// Find the right python command on this system
function findPython() {
  return new Promise((resolve) => {
    // Try python, python3, py in order
    const candidates = ['python', 'python3', 'py'];
    let idx = 0;

    function tryNext() {
      if (idx >= candidates.length) { resolve(null); return; }
      const cmd = candidates[idx++];
      exec(`${cmd} --version`, (err) => {
        if (!err) resolve(cmd);
        else tryNext();
      });
    }
    tryNext();
  });
}

// Install Python requirements if needed
function installRequirements(pythonCmd) {
  return new Promise((resolve) => {
    log(YELLOW, '  → Installing Python dependencies (pymupdf, flask, flask-cors)...');
    const reqFile = join(__dirname, 'server', 'requirements.txt');
    const pip = spawn(pythonCmd, ['-m', 'pip', 'install', '-r', reqFile, '--quiet'], {
      stdio: 'inherit',
    });
    pip.on('close', (code) => {
      if (code === 0) {
        log(GREEN, '  ✓ Python dependencies ready');
      } else {
        log(YELLOW, '  ⚠ pip install failed — trying anyway...');
      }
      resolve();
    });
  });
}

async function startPythonServer(pythonCmd) {
  return new Promise((resolve, reject) => {
    log(BLUE, `  → Starting Python font server with ${pythonCmd}...`);

    const proc = spawn(pythonCmd, [serverPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    let started = false;

    proc.stdout.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Running on') || msg.includes('localhost')) {
        if (!started) {
          started = true;
          log(GREEN, `  ✓ Python server running at http://localhost:${PORT}`);
          resolve(proc);
        }
      }
      // Show server logs with prefix
      process.stdout.write(`${BLUE}[py-server]${RESET} ${msg}`);
    });

    proc.stderr.on('data', (data) => {
      const msg = data.toString();
      // Flask writes startup info to stderr — check for running message
      if ((msg.includes('Running on') || msg.includes('Restarting')) && !started) {
        started = true;
        log(GREEN, `  ✓ Python server running at http://localhost:${PORT}`);
        resolve(proc);
      }
      // Only show real errors, not flask debug info
      if (!msg.includes('WARNING') && !msg.includes('Restarting') && !msg.includes('Debugger')) {
        process.stderr.write(`${BLUE}[py-server]${RESET} ${msg}`);
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to start Python: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (!started) reject(new Error(`Python server exited with code ${code}`));
    });

    // Timeout: if not started in 10s, resolve anyway (maybe already running)
    setTimeout(() => {
      if (!started) {
        log(YELLOW, '  ⚠ Server start timeout — checking if running...');
        resolve(proc);
      }
    }, 10000);
  });
}

// Main
async function main() {
  console.log(`\n${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${BOLD}  PDF Editor — Starting all services${RESET}`);
  console.log(`${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);

  // 1. Check if Python server is already running
  log(BLUE, '1. Checking Python font server...');
  const alreadyRunning = await checkServerRunning();

  if (alreadyRunning) {
    log(GREEN, '  ✓ Python server already running on port 5001');
  } else {
    // 2. Find Python
    const pythonCmd = await findPython();
    if (!pythonCmd) {
      log(RED, '  ✗ Python not found on your system!');
      log(YELLOW, '  → Install Python from https://python.org');
      log(YELLOW, '  → Font detection will use JS fallback instead');
    } else {
      // 3. Check server.py exists
      if (!existsSync(serverPath)) {
        log(RED, `  ✗ server/server.py not found at ${serverPath}`);
      } else {
        // 4. Install requirements
        await installRequirements(pythonCmd);
        // 5. Start Python server
        try {
          await startPythonServer(pythonCmd);
          // Give it a moment to fully initialize
          await new Promise(r => setTimeout(r, 1500));
        } catch (err) {
          log(RED, `  ✗ Could not start Python server: ${err.message}`);
          log(YELLOW, '  → Font detection will use JS fallback');
        }
      }
    }
  }

  // 6. Start React/Vite dev server
  console.log('');
  log(BLUE, '2. Starting React dev server...');
  log(GREEN, '  ✓ Opening http://localhost:3000\n');

  // Signal that startup script is done — vite will take over via concurrently
  process.exit(0);
}

main().catch(err => {
  console.error('Startup error:', err);
  process.exit(0); // Don't block React from starting
});
