#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { log } = require('../../../backend/utils/logUtils');

async function processPngToJpg(inputFile, outputFile) {
  const command = `ffmpeg -i "${inputFile}" -vf "format=yuv420p" "${outputFile}" -y`;
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

async function convertPngToJpg() {
  try {
    log('INFO', 'Starting PNG to JPG Conversion Feature');

    log('DEBUG', 'Prompting for input path');
    const inputPathResponse = await prompts({
      type: 'text',
      name: 'path',
      message: 'Enter the path to the input PNG file or directory (or press Enter to cancel):',
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
      if (!inputPath.toLowerCase().endsWith('.png')) {
        log('ERROR', 'Input file must be a PNG.');
        return 'error';
      }
      const outputFile = path.join(outputDir, path.basename(inputPath, '.png') + '.jpg');
      log('DEBUG', `Generated output filename: ${outputFile}`);
      await processPngToJpg(inputPath, outputFile);
    } else if (stats.isDirectory()) {
      log('DEBUG', `Reading directory: ${inputPath}`);
      const files = await fs.readdir(inputPath);
      const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png'));
      log('DEBUG', `Found ${pngFiles.length} PNG files: ${pngFiles.join(', ')}`);
      if (pngFiles.length === 0) {
        log('INFO', 'No PNG files found in the directory.');
        return 'success';
      }
      for (const file of pngFiles) {
        const inputFile = path.join(inputPath, file);
        const outputFile = path.join(outputDir, path.basename(file, '.png') + '.jpg');
        log('DEBUG', `Generated output filename: ${outputFile}`);
        await processPngToJpg(inputFile, outputFile);
      }
      log('INFO', `Processed ${pngFiles.length} PNG files to JPG.`);
    }

    log('DEBUG', 'PNG to JPG Conversion completed successfully');
    return 'success';
  } catch (error) {
    log('ERROR', `Unexpected error in PNG to JPG Conversion: ${error.message}`);
    log('DEBUG', `Error stack: ${error.stack}`);
    return 'error';
  }
}

module.exports = { convertPngToJpg };