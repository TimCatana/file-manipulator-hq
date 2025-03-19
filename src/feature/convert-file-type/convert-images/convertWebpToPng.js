#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { log } = require('../../../backend/utils/logUtils');

async function processWebpToPng(inputFile, outputFile) {
  const command = `dwebp "${inputFile}" -o "${outputFile}"`;
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        log('ERROR', `dwebp error: ${error.message}`);
        reject(error);
      } else if (stderr && !stderr.includes('Decoding')) {
        log('ERROR', `dwebp stderr: ${stderr}`);
        reject(new Error(stderr));
      } else {
        log('INFO', `Converted ${path.basename(inputFile)} to ${path.basename(outputFile)}`);
        resolve();
      }
    });
  });
}

async function convertWebpToPng() {
  try {
    log('INFO', 'Starting WebP to PNG Conversion Feature');

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
      const outputFile = path.join(outputDir, path.basename(inputPath, '.webp') + '.png');
      await processWebpToPng(inputPath, outputFile);
    } else if (stats.isDirectory()) {
      const files = await fs.readdir(inputPath);
      const webpFiles = files.filter(f => f.toLowerCase().endsWith('.webp'));
      if (webpFiles.length === 0) {
        log('INFO', 'No WebP files found in the directory.');
        return 'success';
      }
      for (const file of webpFiles) {
        const inputFile = path.join(inputPath, file);
        const outputFile = path.join(outputDir, path.basename(file, '.webp') + '.png');
        await processWebpToPng(inputFile, outputFile);
      }
      log('INFO', `Processed ${webpFiles.length} WebP files to PNG.`);
    }

    return 'success';
  } catch (error) {
    log('ERROR', `Unexpected error in WebP to PNG Conversion: ${error.message}`);
    return 'error';
  }
}

module.exports = { convertWebpToPng };