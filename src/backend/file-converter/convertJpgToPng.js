#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { log } = require('../utils/logUtils');

async function convertJpgToPng(inputFile, outputFile) {
  log('DEBUG', `Converting JPG to PNG: ${inputFile}`);

  if (!fs.existsSync(inputFile)) {
    throw new Error(`Input file does not exist: ${inputFile}`);
  }

  const ext = path.extname(inputFile).toLowerCase();
  if (ext !== '.jpg' && ext !== '.jpeg') {
    throw new Error(`Input file is not a JPG/JPEG: ${inputFile}`);
  }

  const command = `ffmpeg -i "${inputFile}" "${outputFile}" -y`;

  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`ffmpeg error: ${error.message}`));
        return;
      }
      if (stderr && !stderr.includes('frame=')) {
        reject(new Error(`ffmpeg stderr: ${stderr}`));
        return;
      }
      log('INFO', `Converted ${path.basename(inputFile)} to ${path.basename(outputFile)}`);
      resolve();
    });
  });
}

module.exports = { convertJpgToPng };