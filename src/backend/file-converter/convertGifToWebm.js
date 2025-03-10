#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { log } = require('../logging/logUtils');

async function convertGifToWebm(inputFile, outputFile) {
  log('DEBUG', `Converting GIF to WebM: ${inputFile}`);

  if (!fs.existsSync(inputFile)) {
    throw new Error(`Input file does not exist: ${inputFile}`);
  }

  if (path.extname(inputFile).toLowerCase() !== '.gif') {
    throw new Error(`Input file is not a GIF: ${inputFile}`);
  }

  const command = `ffmpeg -i "${inputFile}" -c:v libvpx-vp9 -b:v 1M -c:a libopus "${outputFile}" -y`;

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

module.exports = { convertGifToWebm };