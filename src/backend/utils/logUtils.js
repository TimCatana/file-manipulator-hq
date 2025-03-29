const path = require('path');
const fs = require('fs').promises;

let verbose = false;
let logFilePath = null;

function setupConsoleLogging(args = process.argv.slice(2), logDir) {
  verbose = args.includes('--verbose');
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  logFilePath = path.join(logDir, `execution-${timestamp}.log`);
  console.log(`Logging initialized. Verbose mode: ${verbose ? 'ON' : 'OFF'}, Log file: ${logFilePath}`);
  // Initial log to file
  const initialMessage = `[${new Date().toISOString()}] INFO: Logging initialized. Verbose mode: ${verbose ? 'ON' : 'OFF'}`;
  fs.writeFile(logFilePath, initialMessage + '\n', { flag: 'a' }).catch(err => console.error(`Failed to write initial log: ${err.message}`));
}

async function log(level, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${level}: ${message}`;

  // Console output
  switch (level) {
    case 'INFO':
      console.log(`\x1b[32m${logMessage}\x1b[0m`); // Green
      break;
    case 'WARN':
      console.warn(`\x1b[33m${logMessage}\x1b[0m`); // Yellow
      break;
    case 'ERROR':
      console.error(`\x1b[31m${logMessage}\x1b[0m`); // Red
      break;
    case 'DEBUG':
      if (verbose) {
        console.log(`\x1b[36m${logMessage}\x1b[0m`); // Cyan
      }
      break;
    default:
      console.log(logMessage);
  }

  // File output
  if (logFilePath && (level !== 'DEBUG' || verbose)) {
    try {
      await fs.writeFile(logFilePath, logMessage + '\n', { flag: 'a' });
    } catch (err) {
      console.error(`Failed to write to log file ${logFilePath}: ${err.message}`);
    }
  }
}

module.exports = { setupConsoleLogging, log };