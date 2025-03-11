const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');

const LOG_DIR = path.join(__dirname, '..', '..', '..', 'logs'); // One level up from logUtils.js
const LOG_FILE = path.join(LOG_DIR, `main-${DateTime.now().toFormat('yyyyMMddHHmmss')}.log`);

// Initialize logs/ directory and stream at module load
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const consoleLogStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

function log(level, message) {
  const timestamp = DateTime.now().setZone('America/New_York').toISO();
  const logMessage = `${timestamp} [${level}] ${message}`;
  process.stdout.write(`${logMessage}\n`);
  if (consoleLogStream && !consoleLogStream.writableEnded) {
    consoleLogStream.write(`${logMessage}\n`);
  }
  fs.appendFileSync(LOG_FILE, `${logMessage}\n`);
}

function setupConsoleLogging() {
  // No-op; kept for compatibility or future enhancements
}

module.exports = { log, setupConsoleLogging };