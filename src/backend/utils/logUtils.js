const fs = require('fs').promises;
const path = require('path');
const { DateTime } = require('luxon');

// Log file configuration
const LOG_DIR = path.join(__dirname, '..', '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, `app-log-${DateTime.now().toFormat('yyyy-MM-dd')}.log`);

// Log levels
const LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Setup console logging override
function setupConsoleLogging() {
  console.log = (...args) => {
    const message = args.join(' ');
    // Call log without triggering recursion
    internalLog('INFO', message);
    originalConsoleLog.apply(console, args);
  };

  console.error = (...args) => {
    const message = args.join(' ');
    // Call log without triggering recursion
    internalLog('ERROR', message);
    originalConsoleError.apply(console, args);
  };
}

// Internal logging function to avoid recursion
async function internalLog(level, message) {
  const timestamp = DateTime.now().toISO();
  const logEntry = `[${timestamp}] [${level}] ${message}`;

  // Console output based on level
  if (LEVELS[level] >= LEVELS.INFO) {
    originalConsoleLog(logEntry);
  } else if (level === 'ERROR') {
    originalConsoleError(logEntry);
  }

  // Write to log file
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.appendFile(LOG_FILE, logEntry + '\n');
  } catch (err) {
    originalConsoleError(`Failed to write to log file: ${err.message}`);
  }
}

// Public log function
async function log(level, message) {
  await internalLog(level, message);
}

module.exports = { log, setupConsoleLogging };