#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { log } = require('../../../backend/utils/logUtils');

async function processJpgToWebp(inputFile, outputFile) {
  const command = `cwebp "${inputFile}" -q 90 -m 6 -pass 10 -o "${outputFile}"`;
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        log('ERROR', `cwebp error: ${error.message}`);
        reject(error);
      } else if (stderr && !stderr.includes('Saving file')) {
        log('ERROR', `cwebp stderr: ${stderr}`);
        reject(new Error(stderr));
      } else {
        log('INFO', `Converted ${path.basename(inputFile)} to ${path.basename(outputFile)}`);
        resolve();
      }
    });
  });
}

async function convertJpgToWebp() {
  try {
    log('INFO', 'Starting JPG to WebP Conversion Feature');

    const inputPathResponse = await prompts({
      type: 'text',
      name: 'path',
      message: 'Enter the path to the input JPG file or directory (or press Enter to cancel):',
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
      const ext = path.extname(inputPath).toLowerCase();
      if (ext !== '.jpg' && ext !== '.jpeg') {
        log('ERROR', 'Input file must be a JPG/JPEG.');
        return 'error';
      }
      const outputFile = path.join(outputDir, path.basename(inputPath, ext) + '.webp');
      await processJpgToWebp(inputPath, outputFile);
    } else if (stats.isDirectory()) {
      const files = await fs.readdir(inputPath);
      const jpgFiles = files.filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg'));
      if (jpgFiles.length === 0) {
        log('INFO', 'No JPG files found in the directory.');
        return 'success';
      }
      for (const file of jpgFiles) {
        const inputFile = path.join(inputPath, file);
        const ext = path.extname(file).toLowerCase();
        const outputFile = path.join(outputDir, path.basename(file, ext) + '.webp');
        await processJpgToWebp(inputFile, outputFile);
      }
      log('INFO', `Processed ${jpgFiles.length} JPG files to WebP.`);
    }

    return 'success';
  } catch (error) {
    log('ERROR', `Unexpected error in JPG to WebP Conversion: ${error.message}`);
    return 'error';
  }
}

module.exports = { convertJpgToWebp };