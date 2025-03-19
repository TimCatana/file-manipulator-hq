#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { log } = require('../../../backend/utils/logUtils');

async function processWebpToJpg(inputFile, outputFile) {
  const tempPng = path.join(path.dirname(inputFile), `${path.basename(inputFile, '.webp')}-temp.png`);
  const command1 = `dwebp "${inputFile}" -o "${tempPng}"`;
  const command2 = `ffmpeg -i "${tempPng}" -vf "format=yuv420p" "${outputFile}" -y`;
  return new Promise((resolve, reject) => {
    exec(command1, (error1, stdout1, stderr1) => {
      if (error1) {
        log('ERROR', `dwebp error: ${error1.message}`);
        reject(error1);
      } else if (stderr1 && !stderr1.includes('Decoding')) {
        log('ERROR', `dwebp stderr: ${stderr1}`);
        reject(new Error(stderr1));
      } else {
        exec(command2, (error2, stdout2, stderr2) => {
          fs.unlinkSync(tempPng);
          if (error2) {
            log('ERROR', `ffmpeg error: ${error2.message}`);
            reject(error2);
          } else if (stderr2 && !stderr2.includes('frame=')) {
            log('ERROR', `ffmpeg stderr: ${stderr2}`);
            reject(new Error(stderr2));
          } else {
            log('INFO', `Converted ${path.basename(inputFile)} to ${path.basename(outputFile)}`);
            resolve();
          }
        });
      }
    });
  });
}

async function convertWebpToJpg() {
  try {
    log('INFO', 'Starting WebP to JPG Conversion Feature');

    const inputPathResponse = await prompts({
      type: 'text',
      name: 'path',
      message: 'Enter the path to the input WebP file or directory (or press Enter to cancel):',
      validate: value => value.trim() === '' || fs.existsSync(value) ? true : 'Path not found.'
    });
    const inputPath = inputPathResponse.path;
    if (!inputPath) {
      log('INFO', 'No input path provided, cancelling...');
      return 'cancelled';
    }

    const outputPathResponse = await prompts({
      type: 'text',
      name: 'path',
      message: 'Enter the path for the output directory (or press Enter to cancel):',
      validate: value => value.trim() !== '' ? true : 'Output directory required.'
    });
    const outputDir = outputPathResponse.path;
    if (!outputDir) {
      log('INFO', 'No output directory provided, cancelling...');
      return 'cancelled';
    }

    await fs.mkdir(outputDir, { recursive: true });
    const stats = await fs.stat(inputPath);

    if (stats.isFile()) {
      if (!inputPath.toLowerCase().endsWith('.webp')) {
        log('ERROR', 'Input file must be a WebP.');
        return 'error';
      }
      const outputFile = path.join(outputDir, path.basename(inputPath, '.webp') + '.jpg');
      await processWebpToJpg(inputPath, outputFile);
    } else if (stats.isDirectory()) {
      const files = await fs.readdir(inputPath);
      const webpFiles = files.filter(f => f.toLowerCase().endsWith('.webp'));
      if (webpFiles.length === 0) {
        log('INFO', 'No WebP files found in the directory.');
        return 'success';
      }
      for (const file of webpFiles) {
        const inputFile = path.join(inputPath, file);
        const outputFile = path.join(outputDir, path.basename(file, '.webp') + '.jpg');
        await processWebpToJpg(inputFile, outputFile);
      }
      log('INFO', `Processed ${webpFiles.length} WebP files to JPG.`);
    }

    return 'success';
  } catch (error) {
    log('ERROR', `Unexpected error in WebP to JPG Conversion: ${error.message}`);
    return 'error';
  }
}

module.exports = { convertWebpToJpg };