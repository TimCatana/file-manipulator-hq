#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { log } = require('../../../backend/utils/logUtils');

// Configuration
const BASE_DIR = path.join(__dirname, '..', '..', '..');

async function validateAudioStream(inputFile) {
  return new Promise((resolve) => {
    log('DEBUG', `Running ffprobe on ${path.basename(inputFile)}`, { basePath: path.dirname(inputFile) });
    ffmpeg.ffprobe(inputFile, (err, metadata) => {
      if (err) {
        log('DEBUG', `FFprobe error for ${path.basename(inputFile)}: ${err.message}`, { basePath: path.dirname(inputFile) });
        log('INFO', `Skipping ${path.basename(inputFile)}: not a valid GIF with audio.`, { basePath: path.dirname(inputFile) });
        resolve(false);
      } else {
        log('DEBUG', `FFprobe metadata for ${path.basename(inputFile)}: ${JSON.stringify(metadata.streams, null, 2)}`, { basePath: path.dirname(inputFile) });
        const hasValidAudio = metadata.streams.some(
          stream => stream.codec_type === 'audio' && 
          stream.codec_name && 
          ['mp3', 'aac', 'pcm_s16le', 'pcm_s24le', 'pcm_s32le', 'pcm_f32le', 'pcm_f64le'].includes(stream.codec_name.toLowerCase())
        );
        if (!hasValidAudio) {
          log('INFO', `Skipping ${path.basename(inputFile)}: not a valid GIF with audio.`, { basePath: path.dirname(inputFile) });
        }
        log('DEBUG', `Validation result for ${path.basename(inputFile)}: ${hasValidAudio}`, { basePath: path.dirname(inputFile) });
        resolve(hasValidAudio);
      }
    });
  });
}

async function processGifToMp3(inputFile, outputFile, inputDir, params) {
  log('DEBUG', `Converting ${path.relative(inputDir, inputFile)} to ${path.relative(inputDir, outputFile)}`, { basePath: inputDir });
  return new Promise((resolve, reject) => {
    ffmpeg(inputFile)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .audioChannels(2)
      .outputOptions(['-y'])
      .toFormat('mp3')
      .on('start', (commandLine) => {
        log('DEBUG', `FFmpeg command: ${commandLine}`, { basePath: inputDir });
      })
      .on('end', () => {
        log('INFO', `Converted ${path.relative(inputDir, inputFile)} to ${path.relative(inputDir, outputFile)}`, { basePath: inputDir });
        log('INFO', `Output file location: ${path.resolve(outputFile)}`, { basePath: inputDir });
        fs.stat(inputFile)
          .then(inputStats => fs.stat(outputFile).then(outputStats => ({ inputStats, outputStats })))
          .then(({ inputStats, outputStats }) => {
            log('DEBUG', `Input file size: ${inputStats.size} bytes, Output file size: ${outputStats.size} bytes`, { basePath: inputDir });
            log('DEBUG', `Conversion successful: ${path.relative(inputDir, inputFile)} -> ${path.relative(inputDir, outputFile)}`, { basePath: inputDir });
            resolve();
          })
          .catch(statError => {
            log('DEBUG', `Failed to retrieve file sizes: ${statError.message}`, { basePath: inputDir });
            resolve();
          });
      })
      .on('error', (error) => {
        log('ERROR', `FFmpeg error for ${path.relative(inputDir, inputFile)}: ${error.message}`, { basePath: inputDir });
        if (params.verbose) log('DEBUG', `FFmpeg error stack: ${error.stack}`, { basePath: inputDir });
        reject(error);
      })
      .save(outputFile);
  });
}

function parseArgs(args) {
  const params = {};
  const validFlags = ['input', 'output', 'verbose'];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const flag = args[i].slice(2);
      if (validFlags.includes(flag)) {
        const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : '';
        params[flag] = value || true;
        i++;
      } else {
        log('DEBUG', `Ignoring unrecognized argument: --${flag}`, { basePath: BASE_DIR });
        if (args[i + 1] && !args[i + 1].startsWith('--')) i++;
      }
    }
  }
  return params;
}

function isValidFilePath(filePath) {
  const validPathRegex = /^[a-zA-Z0-9._-][a-zA-Z0-9._-]*(?:\.[a-zA-Z0-9]+)?$/;
  return validPathRegex.test(path.basename(filePath));
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function convertGifToMp3(args = process.argv.slice(2)) {
  let inputPath = null; // Initialize inputPath to avoid undefined reference
  try {
    log('INFO', 'Starting GIF to MP3 Conversion Feature');
    const params = parseArgs(args);
    if (params.error) return 'error';

    const forbiddenDirs = ['/etc', '/usr', '/var', '/bin', '/sbin', 'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)'];
    if (params['input']) {
      inputPath = path.resolve(params['input']);
      if (forbiddenDirs.some(dir => inputPath.startsWith(path.resolve(dir)))) {
        log('ERROR', `Input path ${path.basename(inputPath)} is in a system directory.`, { basePath: path.dirname(inputPath) });
        return 'error';
      }
      if (!(await pathExists(inputPath))) {
        log('ERROR', `Input path not found: ${path.basename(inputPath)}`, { basePath: path.dirname(inputPath) });
        return 'error';
      }
      log('DEBUG', `Input path from args: ${path.basename(inputPath)}`, { basePath: path.dirname(inputPath) });
    } else {
      log('DEBUG', 'Prompting for input path');
      const inputPathResponse = await prompts({
        type: 'text',
        name: 'path',
        message: 'Enter the path to the input GIF file or directory (or press Enter to cancel):',
        validate: async value => {
          if (value.trim() === '') return true;
          const resolvedPath = path.resolve(value);
          if (forbiddenDirs.some(dir => resolvedPath.startsWith(path.resolve(dir)))) {
            return 'System directory not allowed.';
          }
          return (await pathExists(resolvedPath)) ? true : 'Path not found.';
        },
      });
      inputPath = inputPathResponse.path ? path.resolve(inputPathResponse.path) : null;
      log('DEBUG', `Input path provided: ${inputPath ? path.basename(inputPath) : 'none'}`, { basePath: inputPath ? path.dirname(inputPath) : BASE_DIR });
      if (!inputPath) {
        log('INFO', 'No input path provided, cancelling...');
        return 'cancelled';
      }
    }

    let outputDir;
    if (params['output']) {
      outputDir = path.resolve(params['output']);
      if (forbiddenDirs.some(dir => outputDir.startsWith(path.resolve(dir)))) {
        log('ERROR', `Output directory ${path.basename(outputDir)} is in a system directory.`, { basePath: path.dirname(outputDir) });
        return 'error';
      }
      log('DEBUG', `Output directory from args: ${path.basename(outputDir)}`, { basePath: path.dirname(outputDir) });
    } else {
      log('DEBUG', 'Prompting for output directory');
      const outputPathResponse = await prompts({
        type: 'text',
        name: 'path',
        message: 'Enter the path for the output directory (or press Enter to cancel):',
        validate: value => {
          if (value.trim() === '') return 'Output directory required.';
          const resolvedPath = path.resolve(value);
          if (forbiddenDirs.some(dir => resolvedPath.startsWith(path.resolve(dir)))) {
            return 'System directory not allowed.';
          }
          return true;
        },
      });
      outputDir = outputPathResponse.path ? path.resolve(outputPathResponse.path) : null;
      log('DEBUG', `Output directory provided: ${outputDir ? path.basename(outputDir) : 'none'}`, { basePath: outputDir ? path.dirname(outputDir) : BASE_DIR });
      if (!outputDir) {
        log('INFO', 'No output directory provided, cancelling...');
        return 'cancelled';
      }
    }

    log('DEBUG', `Creating output directory: ${path.basename(outputDir)}`, { basePath: path.dirname(outputDir) });
    await fs.mkdir(outputDir, { recursive: true });
    log('DEBUG', `Output directory created or verified: ${path.basename(outputDir)}`, { basePath: path.dirname(outputDir) });

    const stats = await fs.stat(inputPath);
    log('DEBUG', `Input path stats: ${stats.isFile() ? 'File' : 'Directory'}`, { basePath: path.dirname(inputPath) });

    if (stats.isFile()) {
      if (!inputPath.toLowerCase().endsWith('.gif')) {
        log('ERROR', `Input file ${path.basename(inputPath)} must be a GIF.`, { basePath: path.dirname(inputPath) });
        return 'error';
      }
      if (!isValidFilePath(inputPath)) {
        log('ERROR', `Invalid filename in input path: ${path.basename(inputPath)}`, { basePath: path.dirname(inputPath) });
        return 'error';
      }
      const isValid = await validateAudioStream(inputPath);
      if (!isValid) {
        log('INFO', `Processed 0 of 1 GIF files to MP3.`);
        return 'success';
      }
      const outputFile = path.join(outputDir, path.basename(inputPath, '.gif') + '.mp3');
      if (!isValidFilePath(outputFile)) {
        log('ERROR', `Invalid filename in output path: ${path.basename(outputFile)}`, { basePath: path.dirname(outputDir) });
        return 'error';
      }
      log('DEBUG', `Generated output filename: ${path.basename(outputFile)}`, { basePath: path.dirname(outputDir) });
      try {
        await processGifToMp3(inputFile, outputFile, path.dirname(inputPath), params);
        log('INFO', `Processed 1 of 1 GIF files to MP3.`);
      } catch (error) {
        log('ERROR', `Failed to process ${path.basename(inputPath)}: ${error.message}`, { basePath: path.dirname(inputPath) });
        if (params.verbose) log('DEBUG', `Error stack: ${error.stack}`, { basePath: path.dirname(inputPath) });
        return 'error';
      }
    } else if (stats.isDirectory()) {
      log('DEBUG', `Reading directory: ${path.basename(inputPath)}`, { basePath: path.dirname(inputPath) });
      const files = await fs.readdir(inputPath);
      const gifFiles = [];
      log('DEBUG', `Checking ${files.length} files in directory: ${path.basename(inputPath)}`, { basePath: path.dirname(inputPath) });
      for (const file of files) {
        if (file.toLowerCase().endsWith('.gif') && isValidFilePath(file)) {
          const inputFile = path.join(inputPath, file);
          const isValid = await validateAudioStream(inputFile);
          if (isValid) {
            gifFiles.push(file);
          }
        }
      }
      log('DEBUG', `Found ${gifFiles.length} valid GIF files with audio: ${gifFiles.length > 0 ? gifFiles.map(f => path.relative(inputPath, path.join(inputPath, f))).join(', ') : 'none'}`, { basePath: inputPath });
      if (gifFiles.length === 0) {
        log('INFO', `No valid GIF files with audio found in ${path.basename(inputPath)}`, { basePath: path.dirname(inputPath) });
        return 'success';
      }
      let processedCount = 0;
      for (const file of gifFiles) {
        const inputFile = path.join(inputPath, file);
        const outputFile = path.join(outputDir, path.basename(file, '.gif') + '.mp3');
        if (!isValidFilePath(outputFile)) {
          log('ERROR', `Invalid filename in output path: ${path.basename(outputFile)}`, { basePath: path.dirname(outputDir) });
          continue;
        }
        log('DEBUG', `Generated output filename: ${path.basename(outputFile)}`, { basePath: path.dirname(outputDir) });
        try {
          await processGifToMp3(inputFile, outputFile, inputPath, params);
          processedCount++;
        } catch (error) {
          log('ERROR', `Failed to process ${path.basename(inputFile)}: ${error.message}`, { basePath: inputPath });
          if (params.verbose) log('DEBUG', `Error stack: ${error.stack}`, { basePath: inputPath });
          continue;
        }
      }
      log('INFO', `Processed ${processedCount} of ${gifFiles.length} GIF files to MP3.`);
    }

    log('DEBUG', 'GIF to MP3 Conversion completed successfully');
    return 'success';
  } catch (error) {
    log('ERROR', `Unexpected error in GIF to MP3 Conversion: ${error.message}`, { basePath: inputPath || BASE_DIR });
    if (params.verbose) log('DEBUG', `Error stack: ${error.stack}`, { basePath: inputPath || BASE_DIR });
    return 'error';
  }
}

if (require.main === module) {
  const params = parseArgs(process.argv.slice(2));
  convertGifToMp3(params).then(result => {
    process.exit(result === 'success' ? 0 : 1);
  }).catch(err => {
    log('ERROR', `Fatal error: ${err.message}`, { basePath: BASE_DIR });
    process.exit(1);
  });
}

module.exports = { convertGifToMp3 };