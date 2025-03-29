#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { log } = require('../../../backend/utils/logUtils');

async function processJpgToWebp(inputFile, outputFile) {
  const command = `cwebp "${inputFile}" -q 90 -m 6 -pass 10 -o "${outputFile}"`;
  log('DEBUG', `Executing cwebp command: ${command}`);
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        log('ERROR', `cwebp error: ${error.message}`);
        log('DEBUG', `cwebp error stack: ${error.stack}`);
        reject(error);
      } else if (stderr && !stderr.includes('Saving file')) {
        log('ERROR', `cwebp stderr: ${stderr}`);
        log('DEBUG', `cwebp stderr details: ${stderr}`);
        reject(new Error(stderr));
      } else {
        log('INFO', `Converted ${path.basename(inputFile)} to ${path.basename(outputFile)}`);
        log('DEBUG', `Conversion successful: ${inputFile} -> ${outputFile}`);
        resolve();
      }
    });
  });
}

async function convertJpgToWebp() {
  try {
    log('INFO', 'Starting JPG to WebP Conversion Feature');

    log('DEBUG', 'Prompting for input path');
    const inputPathResponse = await prompts({
      type: 'text',
      name: 'path',
      message: 'Enter the path to the input JPG file or directory (or press Enter to cancel):',
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
      const ext = path.extname(inputPath).toLowerCase();
      if (ext !== '.jpg' && ext !== '.jpeg') {
        log('ERROR', 'Input file must be a JPG/JPEG.');
        return 'error';
      }
      const outputFile = path.join(outputDir, path.basename(inputPath, ext) + '.webp');
      log('DEBUG', `Generated output filename: ${outputFile}`);
      await processJpgToWebp(inputPath, outputFile);
    } else if (stats.isDirectory()) {
      log('DEBUG', `Reading directory: ${inputPath}`);
      const files = await fs.readdir(inputPath);
      const jpgFiles = files.filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg'));
      log('DEBUG', `Found ${jpgFiles.length} JPG files: ${jpgFiles.join(', ')}`);
      if (jpgFiles.length === 0) {
        log('INFO', 'No JPG files found in the directory.');
        return 'success';
      }
      for (const file of jpgFiles) {
        const inputFile = path.join(inputPath, file);
        const ext = path.extname(file).toLowerCase();
        const outputFile = path.join(outputDir, path.basename(file, ext) + '.webp');
        log('DEBUG', `Generated output filename: ${outputFile}`);
        await processJpgToWebp(inputFile, outputFile);
      }
      log('INFO', `Processed ${jpgFiles.length} JPG files to WebP.`);
    }

    log('DEBUG', 'JPG to WebP Conversion completed successfully');
    return 'success';
  } catch (error) {
    log('ERROR', `Unexpected error in JPG to WebP Conversion: ${error.message}`);
    log('DEBUG', `Error stack: ${error.stack}`);
    return 'error';
  }
}

module.exports = { convertJpgToWebp };