#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const prompts = require('prompts');
const { log } = require('../backend/utils/logUtils');

// Supported image extensions
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// Generate unique filename
function generateUniqueFilename(originalPath) {
  const timestamp = new Date().toISOString().replace(/[-:.T]/g, '').slice(0, 14); // e.g., 20250310123456
  const baseName = path.basename(originalPath, path.extname(originalPath));
  const ext = path.extname(originalPath);
  return `${baseName}-${timestamp}${ext}`;
}

// Process a single image
async function processImage(inputPath, outputPath, width, height, method) {
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    switch (method) {
      case 'stretch':
        await image.resize(width, height, { fit: 'fill' }).toFile(outputPath);
        log('INFO', `Stretched: ${path.basename(inputPath)} -> ${outputPath} (${width}x${height})`);
        break;
      case 'crop':
        const aspectRatio = width / height;
        let newWidth, newHeight;
        if (metadata.width / metadata.height > aspectRatio) {
          newHeight = height;
          newWidth = Math.round(height * (metadata.width / metadata.height));
        } else {
          newWidth = width;
          newHeight = Math.round(width * (metadata.height / metadata.width));
        }
        await image
          .resize(newWidth, newHeight)
          .extract({
            left: Math.round((newWidth - width) / 2),
            top: Math.round((newHeight - height) / 2),
            width,
            height,
          })
          .toFile(outputPath);
        log('INFO', `Cropped: ${path.basename(inputPath)} -> ${outputPath} (${width}x${height})`);
        break;
      case 'contain':
        await image.resize(width, height, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).toFile(outputPath);
        log('INFO', `Contained: ${path.basename(inputPath)} -> ${outputPath} (${width}x${height})`);
        break;
      default:
        throw new Error(`Invalid resize method: ${method}`);
    }
    return { success: true };
  } catch (error) {
    log('ERROR', `Error processing ${inputPath}: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

// Prompt for resize dimensions and method
async function promptForResizeOptions() {
  const formatChoices = [
    { title: 'Instagram (1080x1080)', value: { width: 1080, height: 1080 } },
    { title: 'Facebook (1200x630)', value: { width: 1200, height: 630 } },
    { title: 'Pinterest (1000x1500)', value: { width: 1000, height: 1500 } },
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
      type: (prev) => (prev === 'custom' && typeof prev !== 'object' ? 'number' : null), // Only trigger if 'custom' and not a predefined size
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
async function resizeImages(inputPath, isDirectory, outputDir) {
  const skipped = [];
  const failed = [];

  const resizeOptions = await promptForResizeOptions();
  if (!resizeOptions) return { skipped, failed };

  const { width, height, method } = resizeOptions;

  if (isDirectory) {
    const files = fs.readdirSync(inputPath).map((file) => path.join(inputPath, file));
    for (const file of files) {
      if (fs.statSync(file).isDirectory()) continue; // Skip subdirectories
      const fileExt = path.extname(file).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(fileExt)) {
        log('DEBUG', `Skipping unsupported file: ${file}`);
        skipped.push(file);
        continue;
      }

      const outputFile = path.join(outputDir, generateUniqueFilename(file));
      log('DEBUG', `Resizing: ${file} -> ${outputFile}`);
      const result = await processImage(file, outputFile, width, height, method);
      if (!result.success) {
        failed.push({ file, reason: result.reason });
        fs.unlinkSync(outputFile); // Remove failed output
      }
    }
  } else {
    const fileExt = path.extname(inputPath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(fileExt)) {
      log('DEBUG', `Skipping unsupported file: ${inputPath}`);
      skipped.push(inputPath);
    } else {
      const outputFile = path.join(outputDir, generateUniqueFilename(inputPath));
      log('DEBUG', `Resizing: ${inputPath} -> ${outputFile}`);
      const result = await processImage(inputPath, outputFile, width, height, method);
      if (!result.success) {
        failed.push({ file: inputPath, reason: result.reason });
        fs.unlinkSync(outputFile); // Remove failed output
      }
    }
  }

  return { skipped, failed };
}

module.exports = { resizeImages };