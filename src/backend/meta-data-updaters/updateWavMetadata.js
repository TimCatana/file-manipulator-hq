#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const { log } = require('../utils/logUtils');

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

// Function to check if FFmpeg is installed
function checkFFmpeg() {
  try {
    const version = execSync('ffmpeg -version', { encoding: 'utf8' });
    log('INFO', `FFmpeg detected: ${version.split('\n')[0]}`);
    return true;
  } catch (error) {
    log('ERROR', 'FFmpeg is not installed or not in PATH.');
    return false;
  }
}

// Function to update metadata for a single WAV file
async function processWavFolder(inputFile, outputFile, metadata) {
  if (!checkExifTool() || !checkFFmpeg()) {
    throw new Error('Required tools (ExifTool or FFmpeg) not installed');
  }

  const { title, description, keywords, copyright, genre, comment } = metadata;
  const currentDateTime = getCurrentDateTime();

  // Ensure the output directory exists
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    try {
      ffmpeg(inputFile)
        .outputOptions([
          `-metadata title="${title}"`,
          `-metadata comment="${comment}"`,
          `-metadata description="${description}"`,
          `-metadata copyright="${copyright}"`,
          `-metadata genre="${genre}"`,
          `-metadata keywords="${keywords}"`,
          `-metadata date="${currentDateTime}"`,
          '-c:a copy', // No audio re-encoding
        ])
        .save(outputFile)
        .on('end', () => {
          log('INFO', `Success: Metadata updated for ${outputFile}`);

          // Update timestamps with ExifTool
          try {
            execSync(
              `exiftool -ModifyDate="${currentDateTime}" -DateTimeOriginal="${currentDateTime}" -CreateDate="${currentDateTime}" -FileCreateDate="${currentDateTime}" -FileModifyDate="${currentDateTime}" -overwrite_original "${outputFile}"`,
              { stdio: 'ignore' }
            );
            log('INFO', `Success: File timestamps updated for ${outputFile}`);
            resolve();
          } catch (exifError) {
            log('ERROR', `ExifTool error for ${outputFile}: ${exifError.message}`);
            reject(exifError);
          }
        })
        .on('error', (err) => {
          log('ERROR', `FFmpeg error processing ${inputFile}: ${err.message}`);
          reject(err);
        });
    } catch (error) {
      log('ERROR', `Error processing ${inputFile}: ${error.message}`);
      reject(error);
    }
  });
}

module.exports = { processWavFolder };