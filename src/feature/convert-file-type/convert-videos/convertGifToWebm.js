#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { log } = require('../../../backend/utils/logUtils');

async function processGifToWebm(inputFile, outputFile) {
  const command = `ffmpeg -i "${inputFile}" -c:v libvpx-vp9 -b:v 1M -c:a libopus "${outputFile}" -y`;
  log('DEBUG', `Executing FFmpeg command: ${command}`);
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        log('ERROR', `ffmpeg error: ${error.message}`);
        log('DEBUG', `FFmpeg error stack: ${error.stack}`);
        reject(error);
      } else if (stderr && !stderr.includes('frame=')) {
        log('ERROR', `ffmpeg stderr: ${stderr}`);
        log('DEBUG', `FFmpeg stderr details: ${stderr}`);
        reject(new Error(stderr));
      } else {
        log('INFO', `Converted ${path.basename(inputFile)} to ${path.basename(outputFile)}`);
        log('DEBUG', `Conversion successful: ${inputFile} -> ${outputFile}`);
        resolve();
      }
    });
  });
}

async function convertGifToWebm() {
  try {
    log('INFO', 'Starting GIF to WebM Conversion Feature');

    log('DEBUG', 'Prompting for input path');
    const inputPathResponse = await prompts({
      type: 'text',
      name: 'path',
      message: 'Enter the path to the input GIF file or directory (or press Enter to cancel):',
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
      if (!inputPath.toLowerCase().endsWith('.gif')) {
        log('ERROR', 'Input file must be a GIF.');
        return 'error';
      }
      const outputFile = path.join(outputDir, path.basename(inputPath, '.gif') + '.webm');
      log('DEBUG', `Generated output filename: ${outputFile}`);
      await processGifToWebm(inputPath, outputFile);
    } else if (stats.isDirectory()) {
      log('DEBUG', `Reading directory: ${inputPath}`);
      const files = await fs.readdir(inputPath);
      const gifFiles = files.filter(f => f.toLowerCase().endsWith('.gif'));
      log('DEBUG', `Found ${gifFiles.length} GIF files: ${gifFiles.join(', ')}`);
      if (gifFiles.length === 0) {
        log('INFO', 'No GIF files found in the directory.');
        return 'success';
      }
      for (const file of gifFiles) {
        const inputFile = path.join(inputPath, file);
        const outputFile = path.join(outputDir, path.basename(file, '.gif') + '.webm');
        log('DEBUG', `Generated output filename: ${outputFile}`);
        await processGifToWebm(inputFile, outputFile);
      }
      log('INFO', `Processed ${gifFiles.length} GIF files to WebM.`);
    }

    log('DEBUG', 'GIF to WebM Conversion completed successfully');
    return 'success';
  } catch (error) {
    log('ERROR', `Unexpected error in GIF to WebM Conversion: ${error.message}`);
    log('DEBUG', `Error stack: ${error.stack}`);
    return 'error';
  }
}

module.exports = { convertGifToWebm };