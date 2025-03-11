#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { log } = require('../utils/logUtils');

async function convertWebpToJpg(inputFile, outputFile) {
  log('DEBUG', `Converting WebP to JPG: ${inputFile}`);

  if (!fs.existsSync(inputFile)) {
    throw new Error(`Input file does not exist: ${inputFile}`);
  }

  if (path.extname(inputFile).toLowerCase() !== '.webp') {
    throw new Error(`Input file is not a WebP: ${inputFile}`);
  }

  const tempPng = path.join(path.dirname(inputFile), `${path.basename(inputFile, '.webp')}-temp.png`);
  const command1 = `dwebp "${inputFile}" -o "${tempPng}"`;
  const command2 = `ffmpeg -i "${tempPng}" -vf "format=yuv420p" "${outputFile}" -y`;

  return new Promise((resolve, reject) => {
    exec(command1, (error1, stdout1, stderr1) => {
      if (error1) {
        reject(new Error(`dwebp error: ${error1.message}`));
        return;
      }
      if (stderr1 && !stderr1.includes('Decoding')) {
        reject(new Error(`dwebp stderr: ${stderr1}`));
        return;
      }

      exec(command2, (error2, stdout2, stderr2) => {
        fs.unlinkSync(tempPng); // Clean up temporary PNG
        if (error2) {
          reject(new Error(`ffmpeg error: ${error2.message}`));
          return;
        }
        if (stderr2 && !stderr2.includes('frame=')) {
          reject(new Error(`ffmpeg stderr: ${stderr2}`));
          return;
        }
        log('INFO', `Converted ${path.basename(inputFile)} to ${path.basename(outputFile)}`);
        resolve();
      });
    });
  });
}

module.exports = { convertWebpToJpg };