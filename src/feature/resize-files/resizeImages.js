#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { log } = require('../../backend/utils/logUtils');

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
    log('DEBUG', `Processing image: ${inputPath} -> ${outputPath} (${width}x${height}, method: ${method})`);
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    log('DEBUG', `Image metadata: width=${metadata.width}, height=${metadata.height}`);

    switch (method) {
      case 'stretch':
        await image.resize(width, height, { fit: 'fill' }).toFile(outputPath);
        log('INFO', `Stretched: ${path.basename(inputPath)} -> ${path.basename(outputPath)} (${width}x${height})`);
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
        log('DEBUG', `Crop resizing to intermediate: ${newWidth}x${newHeight}`);
        await image
          .resize(newWidth, newHeight)
          .extract({
            left: Math.round((newWidth - width) / 2),
            top: Math.round((newHeight - height) / 2),
            width,
            height,
          })
          .toFile(outputPath);
        log('INFO', `Cropped: ${path.basename(inputPath)} -> ${path.basename(outputPath)} (${width}x${height})`);
        break;
      case 'contain':
        await image.resize(width, height, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).toFile(outputPath);
        log('INFO', `Contained: ${path.basename(inputPath)} -> ${path.basename(outputPath)} (${width}x${height})`);
        break;
      default:
        throw new Error(`Invalid resize method: ${method}`);
    }
    log('DEBUG', `Successfully processed ${inputPath} to ${outputPath}`);
    return true;
  } catch (error) {
    log('ERROR', `Error processing ${inputPath}: ${error.message}`);
    log('DEBUG', `Process image error stack: ${error.stack}`);
    return false;
  }
}

async function resizeImages() {
  try {
    log('INFO', 'Starting Image Resize Feature');

    log('DEBUG', 'Prompting for input path');
    const inputPathResponse = await prompts({
      type: 'text',
      name: 'path',
      message: 'Enter the path to the input image file or directory (or press Enter to cancel):',
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

    const formatChoices = [
      { title: 'Instagram (1080x1080)', value: { width: 1080, height: 1080 } },
      { title: 'Facebook (1200x630)', value: { width: 1200, height: 630 } },
      { title: 'Pinterest (1000x1500)', value: { width: 1000, height: 1500 } },
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

    const width = resizeResponse.format === 'custom' ? resizeResponse.width : resizeResponse.format.width;
    const height = resizeResponse.format === 'custom' ? resizeResponse.height : resizeResponse.format.height;
    const method = resizeResponse.method;
    log('DEBUG', `Resize parameters: width=${width}, height=${height}, method=${method}`);

    let processed = 0, failed = 0;

    if (stats.isFile()) {
      const ext = path.extname(inputPath).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        log('ERROR', `Input file must be one of ${SUPPORTED_EXTENSIONS.join(', ')}.`);
        return 'error';
      }
      const outputFile = path.join(outputDir, generateUniqueFilename(inputPath));
      log('DEBUG', `Generated output filename: ${outputFile}`);
      const success = await processImage(inputPath, outputFile, width, height, method);
      if (success) processed++;
      else failed++;
    } else if (stats.isDirectory()) {
      log('DEBUG', `Reading directory: ${inputPath}`);
      const files = await fs.readdir(inputPath);
      const imageFiles = files.filter(f => SUPPORTED_EXTENSIONS.includes(path.extname(f).toLowerCase()));
      log('DEBUG', `Found ${imageFiles.length} supported image files: ${imageFiles.join(', ')}`);
      if (imageFiles.length === 0) {
        log('INFO', 'No supported image files found in the directory.');
        return 'success';
      }
      for (const file of imageFiles) {
        const inputFile = path.join(inputPath, file);
        const outputFile = path.join(outputDir, generateUniqueFilename(file));
        log('DEBUG', `Generated output filename: ${outputFile}`);
        const success = await processImage(inputFile, outputFile, width, height, method);
        if (success) processed++;
        else failed++;
      }
      log('INFO', `Processed ${processed} images, ${failed} failed.`);
    }

    log('DEBUG', `Image Resize completed: ${processed} processed, ${failed} failed`);
    return failed === 0 ? 'success' : 'error';
  } catch (error) {
    log('ERROR', `Unexpected error in Image Resize: ${error.message}`);
    log('DEBUG', `Error stack: ${error.stack}`);
    return 'error';
  }
}

module.exports = { resizeImages };