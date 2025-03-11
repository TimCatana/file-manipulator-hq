#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { log } = require('../utils/logUtils');

// Log file setup
const LOG_DIR = path.join(__dirname, '..', '..', '..', 'logs');
const now = new Date();
const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
const scriptName = path.basename(__filename, '.js');
const logFile = path.join(LOG_DIR, `${scriptName}-${timestamp}.log`);

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// Function to get current date and time in ExifTool format (YYYY:MM:DD HH:mm:ss)
function getCurrentDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;
}

// Function to check if ExifTool is installed
function checkExifTool() {
  try {
    const version = execSync('exiftool -ver', { encoding: 'utf8' }).trim();
    log('INFO', `ExifTool version: ${version}`);
    return true;
  } catch (error) {
    log('ERROR', 'ExifTool is not installed or not in PATH.');
    return false;
  }
}

// Function to update metadata for a single GIF file
async function processGifFolder(inputFile, outputFile, metadata) {
  if (!checkExifTool()) {
    throw new Error('ExifTool not installed');
  }

  const currentDateTime = getCurrentDateTime();
  const { title, description, keywords, copyright, genre, comment } = metadata;

  const command = [
    'exiftool',
    `-Comment="${comment}"`,
    `-XMP-dc:Title="${title}"`,
    `-XMP-dc:Description="${description}"`,
    `-XMP-dc:Subject="${keywords}"`,
    `-XMP-dc:Rights="${copyright}"`,
    `-XMP-dc:Type="${genre}"`,
    `-XMP-xmp:Comment="${comment}"`,
    `-XMP-xmp:CreateDate="${currentDateTime}"`,
    `-XMP-xmp:ModifyDate="${currentDateTime}"`,
    `-XMP-xmp:DateTimeOriginal="${currentDateTime}"`,
    `-ModifyDate="${currentDateTime}"`,
    `-DateTimeOriginal="${currentDateTime}"`,
    `-CreateDate="${currentDateTime}"`,
    '-overwrite_original',
    `"${inputFile}"`,
  ].join(' ');

  try {
    fs.copyFileSync(inputFile, outputFile);
    log('INFO', `Copied ${path.basename(inputFile)} to ${outputFile}`);
    execSync(command.replace(inputFile, outputFile), { stdio: 'inherit' });
    log('INFO', `Success: Metadata updated for ${outputFile}`);
  } catch (error) {
    log('ERROR', `Error processing ${inputFile}: ${error.message}`);
    throw error;
  }
}

module.exports = { processGifFolder };