#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { log } = require('../logging/logUtils');

async function convertGifToMp4(inputFile, outputFile) {
  log('DEBUG', `Converting GIF to MP4: ${inputFile}`);

  if (!fs.existsSync(inputFile)) {
    throw new Error(`Input file does not exist: ${inputFile}`);
  }

  if (path.extname(inputFile).toLowerCase() !== '.gif') {
    throw new Error(`Input file is not a GIF: ${inputFile}`);
  }

  const command = `ffmpeg -i "${inputFile}" -c:v libx264 -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -movflags +faststart "${outputFile}" -y`;

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

module.exports = { convertGifToMp4 };