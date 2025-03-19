#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const prompts = require('prompts');
const { log } = require('../backend/utils/logUtils');

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
        .outputOptions(['-c:v libx264', '-preset fast', '-c:a copy']) // Re-encode video, copy audio
        .save(outputPath)
        .on('end', () => {
          log('INFO', `${method.charAt(0).toUpperCase() + method.slice(1)}: ${path.basename(inputPath)} -> ${outputPath} (${width}x${height})`);
          resolve({ success: true });
        })
        .on('error', (err) => {
          log('ERROR', `Error processing ${inputPath}: ${err.message}`);
          resolve({ success: false, reason: err.message });
        });
    } catch (error) {
      log('ERROR', `Error processing ${inputPath}: ${error.message}`);
      resolve({ success: false, reason: error.message });
    }
  });
}

// Prompt for resize dimensions and method
async function promptForResizeOptions() {
  const formatChoices = [
    { title: 'Vertical (1080x1920)', value: { width: 1080, height: 1920 } },
    { title: 'Custom size', value: 'custom' },
  ];

  const questions = [
    {
      type: 'select',
      name: 'format',
      message: 'Choose output format (or press Enter to go back):',
      choices: formatChoices,
      initial: 0,
      validate: (value) => (value !== undefined ? true : 'back'),
    },
    {
      type: (prev) => (prev === 'custom' ? 'number' : null),
      name: 'width',
      message: 'Enter custom width in pixels (or press Enter to go back):',
      validate: (value) => (value === '' ? 'back' : value > 0 ? true : 'Width must be greater than 0'),
    },
    {
      type: (prev, values) => (values.format === 'custom' && prev !== 'back' ? 'number' : null),
      name: 'height',
      message: 'Enter custom height in pixels (or press Enter to go back):',
      validate: (value) => (value === '' ? 'back' : value > 0 ? true : 'Height must be greater than 0'),
    },
    {
      type: 'select',
      name: 'method',
      message: 'Choose resize method (or press Enter to go back):',
      choices: [
        { title: 'Crop (cuts to fit)', value: 'crop' },
        { title: 'Stretch (distorts to fit)', value: 'stretch' },
        { title: 'Contain (letterboxed)', value: 'contain' },
      ],
      initial: 0,
      validate: (value) => (value !== undefined ? true : 'back'),
    },
  ];

  const response = await prompts(questions, {
    onCancel: () => ({ format: '' }), // Handle Ctrl+C
  });

  if (
    response.format === '' ||
    Object.values(response).some((val) => val === 'back' || val === undefined)
  ) {
    log('INFO', 'Resize options cancelled, returning to menu.');
    return null;
  }

  const width = response.format === 'custom' ? response.width : response.format.width;
  const height = response.format === 'custom' ? response.height : response.format.height;
  return { width, height, method: response.method };
}

// Main resize function
async function resizeVideos(inputPath, isDirectory, outputDir) {
  const skipped = [];
  const failed = [];

  const resizeOptions = await promptForResizeOptions();
  if (!resizeOptions) return { skipped, failed };

  const { width, height, method } = resizeOptions;

  if (isDirectory) {
    const files = fs.readdirSync(inputPath).map((file) => path.join(inputPath, file));
    for (const file of files) {
      if (fs.statSync(file).isDirectory()) continue; // Skip subdirectories
      const outputFile = path.join(outputDir, generateUniqueFilename(file));
      log('DEBUG', `Resizing: ${file} -> ${outputFile}`);
      const result = await processVideo(file, outputFile, width, height, method);
      if (!result.success) {
        failed.push({ file, reason: result.reason });
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile); // Remove failed output
      }
    }
  } else {
    const outputFile = path.join(outputDir, generateUniqueFilename(inputPath));
    log('DEBUG', `Resizing: ${inputPath} -> ${outputFile}`);
    const result = await processVideo(inputPath, outputFile, width, height, method);
    if (!result.success) {
      failed.push({ file: inputPath, reason: result.reason });
      if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile); // Remove failed output
    }
  }

  return { skipped, failed };
}

module.exports = { resizeVideos };