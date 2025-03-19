#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { log } = require('../../../backend/utils/logUtils');

async function processMp4ToWebm(inputFile, outputFile) {
  const command = `ffmpeg -i "${inputFile}" -c:v libvpx-vp9 -b:v 1M -c:a libopus "${outputFile}" -y`;
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        log('ERROR', `ffmpeg error: ${error.message}`);
        reject(error);
      } else if (stderr && !stderr.includes('frame=')) {
        log('ERROR', `ffmpeg stderr: ${stderr}`);
        reject(new Error(stderr));
      } else {
        log('INFO', `Converted ${path.basename(inputFile)} to ${path.basename(outputFile)}`);
        resolve();
      }
    });
  });
}

async function convertMp4ToWebm() {
  try {
    log('INFO', 'Starting MP4 to WebM Conversion Feature');

    const inputPathResponse = await prompts({
      type: 'text',
      name: 'path',
      message: 'Enter the path to the input MP4 file or directory (or press Enter to cancel):',
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
      if (!inputPath.toLowerCase().endsWith('.mp4')) {
        log('ERROR', 'Input file must be an MP4.');
        return 'error';
      }
      const outputFile = path.join(outputDir, path.basename(inputPath, '.mp4') + '.webm');
      await processMp4ToWebm(inputPath, outputFile);
    } else if (stats.isDirectory()) {
      const files = await fs.readdir(inputPath);
      const mp4Files = files.filter(f => f.toLowerCase().endsWith('.mp4'));
      if (mp4Files.length === 0) {
        log('INFO', 'No MP4 files found in the directory.');
        return 'success';
      }
      for (const file of mp4Files) {
        const inputFile = path.join(inputPath, file);
        const outputFile = path.join(outputDir, path.basename(file, '.mp4') + '.webm');
        await processMp4ToWebm(inputFile, outputFile);
      }
      log('INFO', `Processed ${mp4Files.length} MP4 files to WebM.`);
    }

    return 'success';
  } catch (error) {
    log('ERROR', `Unexpected error in MP4 to WebM Conversion: ${error.message}`);
    return 'error';
  }
}

module.exports = { convertMp4ToWebm };