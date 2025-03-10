#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { log } = require('../logging/logUtils');

async function convertWebpToPng(inputFile, outputFile) {
  log('DEBUG', `Converting WebP to PNG: ${inputFile}`);

  if (!fs.existsSync(inputFile)) {
    throw new Error(`Input file does not exist: ${inputFile}`);
  }

  if (path.extname(inputFile).toLowerCase() !== '.webp') {
    throw new Error(`Input file is not a WebP: ${inputFile}`);
  }

  const command = `dwebp "${inputFile}" -o "${outputFile}"`;

  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`dwebp error: ${error.message}`));
        return;
      }
      if (stderr && !stderr.includes('Decoding')) {
        reject(new Error(`dwebp stderr: ${stderr}`));
        return;
      }
      log('INFO', `Converted ${path.basename(inputFile)} to ${path.basename(outputFile)}`);
      resolve();
    });
  });
}

module.exports = { convertWebpToPng };