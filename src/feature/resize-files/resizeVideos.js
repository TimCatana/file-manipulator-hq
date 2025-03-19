#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
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

      ffmpegCmd
        .videoFilter(filter)
        .outputOptions(['-c:v libx264', '-preset fast', '-c:a copy'])
        .save(outputPath)
        .on('end', () => {
          log('INFO', `${method.charAt(0).toUpperCase() + method.slice(1)}: ${path.basename(inputPath)} -> ${path.basename(outputPath)} (${width}x${height})`);
          resolve(true);
        })
        .on('error', (err) => {
          log('ERROR', `Error processing ${inputPath}: ${err.message}`);
          resolve(false);
        });
    } catch (error) {
      log('ERROR', `Error processing ${inputPath}: ${error.message}`);
      resolve(false);
    }
  });
}

async function resizeVideos() {
  try {
    log('INFO', 'Starting Video Resize Feature');

    const inputPathResponse = await prompts({
      type: 'text',
      name: 'path',
      message: 'Enter the path to the input video file or directory (or press Enter to cancel):',
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

    const formatChoices = [
      { title: 'Vertical (1080x1920)', value: { width: 1080, height: 1920 } },
      { title: 'Custom size', value: 'custom' },
    ];

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

    if (!resizeResponse.format) {
      log('INFO', 'Resize options cancelled.');
      return 'cancelled';
    }

    const width = resizeResponse.format === 'custom' ? resizeResponse.width : resizeResponse.format.width;
    const height = resizeResponse.format === 'custom' ? resizeResponse.height : resizeResponse.format.height;
    const method = resizeResponse.method;

    let processed = 0, failed = 0;

    if (stats.isFile()) {
      const ext = path.extname(inputPath).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        log('ERROR', `Input file must be one of ${SUPPORTED_EXTENSIONS.join(', ')}.`);
        return 'error';
      }
      const outputFile = path.join(outputDir, generateUniqueFilename(inputPath));
      const success = await processVideo(inputPath, outputFile, width, height, method);
      if (success) processed++;
      else failed++;
    } else if (stats.isDirectory()) {
      const files = await fs.readdir(inputPath);
      const videoFiles = files.filter(f => SUPPORTED_EXTENSIONS.includes(path.extname(f).toLowerCase()));
      if (videoFiles.length === 0) {
        log('INFO', 'No supported video files found in the directory.');
        return 'success';
      }
      for (const file of videoFiles) {
        const inputFile = path.join(inputPath, file);
        const outputFile = path.join(outputDir, generateUniqueFilename(file));
        const success = await processVideo(inputFile, outputFile, width, height, method);
        if (success) processed++;
        else failed++;
      }
      log('INFO', `Processed ${processed} videos, ${failed} failed.`);
    }

    return failed === 0 ? 'success' : 'error';
  } catch (error) {
    log('ERROR', `Unexpected error in Video Resize: ${error.message}`);
    return 'error';
  }
}

module.exports = { resizeVideos };
