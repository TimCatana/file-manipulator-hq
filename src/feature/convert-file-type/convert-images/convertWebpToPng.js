#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { log } = require('../../../backend/utils/logUtils');

async function processWebpToPng(inputFile, outputFile) {
  const command = `dwebp "${inputFile}" -o "${outputFile}"`;
  log('DEBUG', `Executing dwebp command: ${command}`);
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        log('ERROR', `dwebp error: ${error.message}`);
        log('DEBUG', `dwebp error stack: ${error.stack}`);
        reject(error);
      } else if (stderr && !stderr.includes('Decoding')) {
        log('ERROR', `dwebp stderr: ${stderr}`);
        log('DEBUG', `dwebp stderr details: ${stderr}`);
        reject(new Error(stderr));
      } else {
        log('INFO', `Converted ${path.basename(inputFile)} to ${path.basename(outputFile)}`);
        log('DEBUG', `Conversion successful: ${inputFile} -> ${outputFile}`);
        resolve();
      }
    });
  });
}

async function convertWebpToPng() {
  try {
    log('INFO', 'Starting WebP to PNG Conversion Feature');

    log('DEBUG', 'Prompting for input path');
    const inputPathResponse = await prompts({
      type: 'text',
      name: 'path',
      message: 'Enter the path to the input WebP file or directory (or press Enter to cancel):',
      validate: value => value.trim() === '' || fs.existsSync(value) ? true : 'Path not found.'
    });
    const inputPath = inputPathResponse.path;
    log('DEBUG', `Input path provided: ${inputPath}`);
    if (!inputPath) {
      log('INFO', 'No input path provided, cancelling...');
      return 'cancelled';
    }

    log('DEBUG', 'Prompting for output directory');
    const outputPathResponse = await prompts({
      type: 'text',
      name: 'path',
      message: 'Enter the path for the output directory (or press Enter to cancel):',
      validate: value => value.trim() !== '' ? true : 'Output directory required.'
    });
    const outputDir = outputPathResponse.path;
    log('DEBUG', `Output directory provided: ${outputDir}`);
    if (!outputDir) {
      log('INFO', 'No output directory provided, cancelling...');
      return 'cancelled';
    }

    log('DEBUG', `Creating output directory: ${outputDir}`);
    await fs.mkdir(outputDir, { recursive: true });
    log('DEBUG', `Output directory created or verified: ${outputDir}`);

    const stats = await fs.stat(inputPath);
    log('DEBUG', `Input path stats: ${stats.isFile() ? 'File' : 'Directory'}`);

    if (stats.isFile()) {
      if (!inputPath.toLowerCase().endsWith('.webp')) {
        log('ERROR', 'Input file must be a WebP.');
        return 'error';
      }
      const outputFile = path.join(outputDir, path.basename(inputPath, '.webp') + '.png');
      log('DEBUG', `Generated output filename: ${outputFile}`);
      await processWebpToPng(inputPath, outputFile);
    } else if (stats.isDirectory()) {
      log('DEBUG', `Reading directory: ${inputPath}`);
      const files = await fs.readdir(inputPath);
      const webpFiles = files.filter(f => f.toLowerCase().endsWith('.webp'));
      log('DEBUG', `Found ${webpFiles.length} WebP files: ${webpFiles.join(', ')}`);
      if (webpFiles.length === 0) {
        log('INFO', 'No WebP files found in the directory.');
        return 'success';
      }
      for (const file of webpFiles) {
        const inputFile = path.join(inputPath, file);
        const outputFile = path.join(outputDir, path.basename(file, '.webp') + '.png');
        log('DEBUG', `Generated output filename: ${outputFile}`);
        await processWebpToPng(inputFile, outputFile);
      }
      log('INFO', `Processed ${webpFiles.length} WebP files to PNG.`);
    }

    log('DEBUG', 'WebP to PNG Conversion completed successfully');
    return 'success';
  } catch (error) {
    log('ERROR', `Unexpected error in WebP to PNG Conversion: ${error.message}`);
    log('DEBUG', `Error stack: ${error.stack}`);
    return 'error';
  }
}

module.exports = { convertWebpToPng };