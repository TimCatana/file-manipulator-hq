#!/usr/bin/env node

const prompts = require('prompts');
const fsPromises = require('fs').promises; // For async operations
const fs = require('fs'); // For sync operations like existsSync
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { log } = require('../../backend/utils/logUtils');

// Supported video extensions
const SUPPORTED_EXTENSIONS = ['.mp4', '.webm', '.gif'];

// Generate unique filename
function generateUniqueFilename(originalPath) {
  const timestamp = new Date().toISOString().replace(/[-:.T]/g, '').slice(0, 14); // e.g., 20250310123456
  const baseName = path.basename(originalPath, path.extname(originalPath));
  const ext = path.extname(originalPath);
  return `${baseName}-${timestamp}${ext}`;
}

// Process a single video
async function processVideo(inputPath, outputPath, width, height, method) {
  return new Promise((resolve) => {
    try {
      log('DEBUG', `Processing video: ${inputPath} -> ${outputPath} (${width}x${height}, method: ${method})`);
      const ffmpegCmd = ffmpeg(inputPath);
      let filter = '';

      switch (method) {
        case 'stretch':
          filter = `scale=${width}:${height}:force_original_aspect_ratio=disable`;
          break;
        case 'crop':
          filter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
          break;
        case 'contain':
          filter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`;
          break;
        default:
          throw new Error(`Invalid resize method: ${method}`);
      }
      log('DEBUG', `FFmpeg filter: ${filter}`);

      ffmpegCmd
        .videoFilter(filter)
        .outputOptions(['-c:v libx264', '-preset fast', '-c:a copy'])
        .save(outputPath)
        .on('start', (cmd) => log('DEBUG', `FFmpeg command: ${cmd}`))
        .on('end', () => {
          log('INFO', `${method.charAt(0).toUpperCase() + method.slice(1)}: ${path.basename(inputPath)} -> ${path.basename(outputPath)} (${width}x${height})`);
          log('DEBUG', `Successfully processed ${inputPath} to ${outputPath}`);
          resolve(true);
        })
        .on('error', (err) => {
          log('ERROR', `Error processing ${inputPath}: ${err.message}`);
          log('DEBUG', `FFmpeg error stack: ${err.stack}`);
          resolve(false);
        });
    } catch (error) {
      log('ERROR', `Error processing ${inputPath}: ${error.message}`);
      log('DEBUG', `Process video error stack: ${error.stack}`);
      resolve(false);
    }
  });
}

function parseArgs(args) {
  const params = {};
  const validFlags = ['input', 'output', 'width', 'height', 'method'];
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

async function resizeVideos(args = process.argv.slice(2)) {
  try {
    log('INFO', 'Starting Video Resize Feature');

    const params = parseArgs(args);
    if (params.error) return 'error';

    let inputPath;
    if (params['input']) {
      inputPath = params['input'];
      if (!fs.existsSync(inputPath)) {
        log('ERROR', `Input path not found: ${inputPath}`);
        return 'error';
      }
      log('DEBUG', `Input path from args: ${inputPath}`);
    } else {
      log('DEBUG', 'Prompting for input path');
      const inputPathResponse = await prompts({
        type: 'text',
        name: 'path',
        message: 'Enter the path to the input video file or directory (or press Enter to cancel):',
        validate: value => value.trim() === '' || fs.existsSync(value) ? true : 'Path not found.'
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
        validate: value => value.trim() !== '' ? true : 'Output directory required.'
      });
      outputDir = outputPathResponse.path;
      log('DEBUG', `Output directory provided: ${outputDir}`);
      if (!outputDir) {
        log('INFO', 'No output directory provided, cancelling...');
        return 'cancelled';
      }
    }

    log('DEBUG', `Creating output directory: ${outputDir}`);
    await fsPromises.mkdir(outputDir, { recursive: true });
    log('DEBUG', `Output directory created or verified: ${outputDir}`);

    const stats = await fsPromises.stat(inputPath);
    log('DEBUG', `Input path stats: ${stats.isFile() ? 'File' : 'Directory'}`);

    let width, height, method;
    if (params['width'] || params['height'] || params['method']) {
      width = params['width'] ? parseInt(params['width'], 10) : null;
      height = params['height'] ? parseInt(params['height'], 10) : null;
      method = params['method'] || null;

      if (width === null || height === null || method === null) {
        log('DEBUG', 'Prompting for missing resize parameters');
        const resizeResponse = await prompts([
          {
            type: width === null ? 'number' : null,
            name: 'width',
            message: 'Enter width in pixels:',
            validate: value => value > 0 ? true : 'Width must be greater than 0'
          },
          {
            type: height === null ? 'number' : null,
            name: 'height',
            message: 'Enter height in pixels:',
            validate: value => value > 0 ? true : 'Height must be greater than 0'
          },
          {
            type: method === null ? 'select' : null,
            name: 'method',
            message: 'Choose resize method:',
            choices: [
              { title: 'Crop (cuts to fit)', value: 'crop' },
              { title: 'Stretch (distorts to fit)', value: 'stretch' },
              { title: 'Contain (letterboxed)', value: 'contain' },
            ],
            initial: 0,
          },
        ]);

        width = width !== null ? width : resizeResponse.width;
        height = height !== null ? height : resizeResponse.height;
        method = method !== null ? method : resizeResponse.method;

        if (!width || !height || !method) {
          log('INFO', 'Resize options cancelled.');
          return 'cancelled';
        }
      }

      if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0 || !['stretch', 'crop', 'contain'].includes(method)) {
        log('ERROR', 'Invalid arguments: --width and --height must be positive numbers, --method must be stretch, crop, or contain');
        return 'error';
      }
      log('DEBUG', `Resize parameters from args/prompts: width=${width}, height=${height}, method=${method}`);
    } else {
      const formatChoices = [
        { title: 'Vertical (1080x1920)', value: { width: 1080, height: 1920 } },
        { title: 'Custom size', value: 'custom' },
      ];

      log('DEBUG', 'Prompting for resize options');
      const resizeResponse = await prompts([
        {
          type: 'select',
          name: 'format',
          message: 'Choose output format:',
          choices: formatChoices,
          initial: 0,
        },
        {
          type: prev => (prev === 'custom' ? 'number' : null),
          name: 'width',
          message: 'Enter custom width in pixels:',
          validate: value => value > 0 ? true : 'Width must be greater than 0',
        },
        {
          type: prev => (prev === 'custom' ? 'number' : null),
          name: 'height',
          message: 'Enter custom height in pixels:',
          validate: value => value > 0 ? true : 'Height must be greater than 0',
        },
        {
          type: 'select',
          name: 'method',
          message: 'Choose resize method:',
          choices: [
            { title: 'Crop (cuts to fit)', value: 'crop' },
            { title: 'Stretch (distorts to fit)', value: 'stretch' },
            { title: 'Contain (letterboxed)', value: 'contain' },
          ],
          initial: 0,
        },
      ]);

      log('DEBUG', `Resize options selected: ${JSON.stringify(resizeResponse)}`);
      if (!resizeResponse.format) {
        log('INFO', 'Resize options cancelled.');
        return 'cancelled';
      }

      width = resizeResponse.format === 'custom' ? resizeResponse.width : resizeResponse.format.width;
      height = resizeResponse.format === 'custom' ? resizeResponse.height : resizeResponse.format.height;
      method = resizeResponse.method;
      log('DEBUG', `Resize parameters: width=${width}, height=${height}, method=${method}`);
    }

    let processed = 0, failed = 0;

    if (stats.isFile()) {
      const ext = path.extname(inputPath).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        log('ERROR', `Input file must be one of ${SUPPORTED_EXTENSIONS.join(', ')}.`);
        return 'error';
      }
      const outputFile = path.join(outputDir, generateUniqueFilename(inputPath));
      log('DEBUG', `Generated output filename: ${outputFile}`);
      const success = await processVideo(inputPath, outputFile, width, height, method);
      if (success) processed++;
      else failed++;
    } else if (stats.isDirectory()) {
      log('DEBUG', `Reading directory: ${inputPath}`);
      const files = await fsPromises.readdir(inputPath);
      const videoFiles = files.filter(f => SUPPORTED_EXTENSIONS.includes(path.extname(f).toLowerCase()));
      log('DEBUG', `Found ${videoFiles.length} supported video files: ${videoFiles.join(', ')}`);
      if (videoFiles.length === 0) {
        log('INFO', 'No supported video files found in the directory.');
        return 'success';
      }
      for (const file of videoFiles) {
        const inputFile = path.join(inputPath, file);
        const outputFile = path.join(outputDir, generateUniqueFilename(file));
        log('DEBUG', `Generated output filename: ${outputFile}`);
        const success = await processVideo(inputFile, outputFile, width, height, method);
        if (success) processed++;
        else failed++;
      }
      log('INFO', `Processed ${processed} videos, ${failed} failed.`);
    }

    log('DEBUG', `Video Resize completed: ${processed} processed, ${failed} failed`);
    return failed === 0 ? 'success' : 'error';
  } catch (error) {
    log('ERROR', `Unexpected error in Video Resize: ${error.message}`);
    log('DEBUG', `Error stack: ${error.stack}`);
    return 'error';
  }
}

if (require.main === module) {
  resizeVideos().then(result => {
    process.exit(result === 'success' ? 0 : 1);
  }).catch(err => {
    log('ERROR', `Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { resizeVideos };