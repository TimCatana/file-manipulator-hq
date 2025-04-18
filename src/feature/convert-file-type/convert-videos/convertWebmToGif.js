#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { log } = require('../../../backend/utils/logUtils');

async function processWebmToGif(inputFile, outputFile) {
  const command = `ffmpeg -i "${inputFile}" -vf "fps=10,scale=320:-1:flags=lanczos" "${outputFile}" -y`;
  log('DEBUG', `Executing FFmpeg command: ${command}`);
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        log('ERROR', `ffmpeg error: ${error.message}`);
        log('DEBUG', `FFmpeg error stack: ${error.stack}`);
        reject(error);
        return;
      }
      if (stderr && stderr.toLowerCase().includes('error')) {
        log('ERROR', `ffmpeg stderr: ${stderr}`);
        log('DEBUG', `FFmpeg stderr details: ${stderr}`);
        reject(new Error(stderr));
        return;
      }
      if (stderr) {
        log('DEBUG', `FFmpeg stderr (informational): ${stderr}`);
      }
      log('INFO', `Converted ${path.basename(inputFile)} to ${path.basename(outputFile)}`);
      log('DEBUG', `Conversion successful: ${inputFile} -> ${outputFile}`);
      resolve();
    });
  });
}

function parseArgs(args) {
  const params = {};
  const validFlags = ['input', 'output'];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const flag = args[i].slice(2);
      if (!validFlags.includes(flag)) {
        log('ERROR', `Invalid argument: --${flag}`);
        return { error: true, message: `Invalid argument: --${flag}` };
      }
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : '';
      params[flag] = value;
      i++;
    }
  }
  return params;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function convertWebmToGif(args = process.argv.slice(2)) {
  try {
    log('INFO', 'Starting WebM to GIF Conversion Feature');

    const params = parseArgs(args);
    if (params.error) return 'error';

    let inputPath;
    if (params['input']) {
      inputPath = params['input'];
      if (!(await pathExists(inputPath))) {
        log('ERROR', `Input path not found: ${inputPath}`);
        return 'error';
      }
      log('DEBUG', `Input path from args: ${inputPath}`);
    } else {
      log('DEBUG', 'Prompting for input path');
      const inputPathResponse = await prompts({
        type: 'text',
        name: 'path',
        message: 'Enter the path to the input WebM file or directory (or press Enter to cancel):',
        validate: async value => {
          if (value.trim() === '') return true;
          return (await pathExists(value)) ? true : 'Path not found.';
        },
      });
      inputPath = inputPathResponse.path;
      log('DEBUG', `Input path provided: ${inputPath}`);
      if (!inputPath) {
        log('INFO', 'No input path provided, cancelling...');
        return 'cancelled';
      }
    }

    let outputDir;
    if (params['output']) {
      outputDir = params['output'];
      log('DEBUG', `Output directory from args: ${outputDir}`);
    } else {
      log('DEBUG', 'Prompting for output directory');
      const outputPathResponse = await prompts({
        type: 'text',
        name: 'path',
        message: 'Enter the path for the output directory (or press Enter to cancel):',
        validate: value => (value.trim() !== '' ? true : 'Output directory required.'),
      });
      outputDir = outputPathResponse.path;
      log('DEBUG', `Output directory provided: ${outputDir}`);
      if (!outputDir) {
        log('INFO', 'No output directory provided, cancelling...');
        return 'cancelled';
      }
    }

    log('DEBUG', `Creating output directory: ${outputDir}`);
    await fs.mkdir(outputDir, { recursive: true });
    log('DEBUG', `Output directory created or verified: ${outputDir}`);

    const stats = await fs.stat(inputPath);
    log('DEBUG', `Input path stats: ${stats.isFile() ? 'File' : 'Directory'}`);

    if (stats.isFile()) {
      if (!inputPath.toLowerCase().endsWith('.webm')) {
        log('ERROR', 'Input file must be a WebM.');
        return 'error';
      }
      const outputFile = path.join(outputDir, path.basename(inputPath, '.webm') + '.gif');
      log('DEBUG', `Generated output filename: ${outputFile}`);
      await processWebmToGif(inputPath, outputFile);
    } else if (stats.isDirectory()) {
      log('DEBUG', `Reading directory: ${inputPath}`);
      const files = await fs.readdir(inputPath);
      const webmFiles = files.filter(f => f.toLowerCase().endsWith('.webm'));
      log('DEBUG', `Found ${webmFiles.length} WebM files: ${webmFiles.join(', ')}`);
      if (webmFiles.length === 0) {
        log('INFO', 'No WebM files found in the directory.');
        return 'success';
      }
      for (const file of webmFiles) {
        const inputFile = path.join(inputPath, file);
        const outputFile = path.join(outputDir, path.basename(file, '.webm') + '.gif');
        log('DEBUG', `Generated output filename: ${outputFile}`);
        await processWebmToGif(inputFile, outputFile);
      }
      log('INFO', `Processed ${webmFiles.length} WebM files to GIF.`);
    }

    log('DEBUG', 'WebM to GIF Conversion completed successfully');
    return 'success';
  } catch (error) {
    log('ERROR', `Unexpected error in WebM to GIF Conversion: ${error.message}`);
    log('DEBUG', `Error stack: ${error.stack}`);
    return 'error';
  }
}

if (require.main === module) {
  convertWebmToGif().then(result => {
    process.exit(result === 'success' ? 0 : 1);
  }).catch(err => {
    log('ERROR', `Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { convertWebmToGif };