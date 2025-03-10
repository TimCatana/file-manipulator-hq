#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { log } = require('../logging/logUtils');

async function convertPngToWebp(inputFile, outputFile) {
  log('DEBUG', `Converting PNG to WebP: ${inputFile}`);

  if (!fs.existsSync(inputFile)) {
    throw new Error(`Input file does not exist: ${inputFile}`);
  }

  if (path.extname(inputFile).toLowerCase() !== '.png') {
    throw new Error(`Input file is not a PNG: ${inputFile}`);
  }

  // Optimized lossy command: high quality, max compression
  const command = `cwebp "${inputFile}" -q 90 -m 6 -pass 10 -o "${outputFile}"`;

  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`cwebp error: ${error.message}`));
        return;
      }
      if (stderr && !stderr.includes('Saving file')) { // Ignore benign stderr
        reject(new Error(`cwebp stderr: ${stderr}`));
        return;
      }
      log('INFO', `Converted ${path.basename(inputFile)} to ${path.basename(outputFile)}`);
      resolve();
    });
  });
}

module.exports = { convertPngToWebp };