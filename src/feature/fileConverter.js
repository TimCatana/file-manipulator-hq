#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { log } = require('../backend/utils/logUtils');
const { convertPngToWebp } = require('../backend/file-converter/convertPngToWebp');
const { convertPngToJpg } = require('../backend/file-converter/convertPngToJpg');
const { convertJpgToWebp } = require('../backend/file-converter/convertJpgToWebp');
const { convertJpgToPng } = require('../backend/file-converter/convertJpgToPng');
const { convertWebpToPng } = require('../backend/file-converter/convertWebpToPng');
const { convertWebpToJpg } = require('../backend/file-converter/convertWebpToJpg');
const { convertWebmToGif } = require('../backend/file-converter/convertWebmToGif');
const { convertWebmToMp4 } = require('../backend/file-converter/convertWebmToMp4');
const { convertGifToMp4 } = require('../backend/file-converter/convertGifToMp4');
const { convertGifToWebm } = require('../backend/file-converter/convertGifToWebm');
const { convertMp4ToWebm } = require('../backend/file-converter/convertMp4ToWebm');
const { convertMp4ToGif } = require('../backend/file-converter/convertMp4ToGif');

// Conversion type to backend function mapping
const CONVERTERS = {
  'pngToWebp': { fn: convertPngToWebp, sourceExt: '.png', targetExt: '.webp' },
  'pngToJpg': { fn: convertPngToJpg, sourceExt: '.png', targetExt: '.jpg' },
  'jpgToWebp': { fn: convertJpgToWebp, sourceExt: ['.jpg', '.jpeg'], targetExt: '.webp' },
  'jpgToPng': { fn: convertJpgToPng, sourceExt: ['.jpg', '.jpeg'], targetExt: '.png' },
  'webpToPng': { fn: convertWebpToPng, sourceExt: '.webp', targetExt: '.png' },
  'webpToJpg': { fn: convertWebpToJpg, sourceExt: '.webp', targetExt: '.jpg' },
  'webmToGif': { fn: convertWebmToGif, sourceExt: '.webm', targetExt: '.gif' },
  'webmToMp4': { fn: convertWebmToMp4, sourceExt: '.webm', targetExt: '.mp4' },
  'gifToMp4': { fn: convertGifToMp4, sourceExt: '.gif', targetExt: '.mp4' },
  'gifToWebm': { fn: convertGifToWebm, sourceExt: '.gif', targetExt: '.webm' },
  'mp4ToWebm': { fn: convertMp4ToWebm, sourceExt: '.mp4', targetExt: '.webm' },
  'mp4ToGif': { fn: convertMp4ToGif, sourceExt: '.mp4', targetExt: '.gif' },
};

// Generate unique output filename to avoid overwriting within the run
function getUniqueOutputFile(outputDir, baseName, targetExt) {
  let outputFile = path.join(outputDir, `${baseName}${targetExt}`);
  if (!fs.existsSync(outputFile)) return outputFile;

  const timestamp = new Date().toISOString().replace(/[-:.T]/g, '').slice(0, 14); // e.g., 20250310123456
  outputFile = path.join(outputDir, `${baseName}-${timestamp}${targetExt}`);
  let counter = 1;

  while (fs.existsSync(outputFile)) {
    outputFile = path.join(outputDir, `${baseName}-${timestamp}-${counter}${targetExt}`);
    counter++;
  }

  return outputFile;
}

// Convert files or a single file
async function convertFiles(inputPath, conversionType, isDirectory, outputDir) {
  const failed = [];
  const converter = CONVERTERS[conversionType];

  if (!converter) {
    log('ERROR', `Unsupported conversion type: ${conversionType}`);
    throw new Error('Unsupported conversion type');
  }

  log('DEBUG', `Starting file conversion: ${conversionType} to ${outputDir}`);

  // Validate input path
  if (!fs.existsSync(inputPath)) {
    log('ERROR', `${isDirectory ? 'Directory' : 'File'} does not exist: ${inputPath}`);
    throw new Error(`${isDirectory ? 'Directory' : 'File'} does not exist`);
  }

  const sourceExts = Array.isArray(converter.sourceExt) ? converter.sourceExt : [converter.sourceExt];
  const targetExt = converter.targetExt;

  if (isDirectory) {
    // Process all files in the directory
    const files = fs.readdirSync(inputPath)
      .map((file) => path.join(inputPath, file))
      .filter((file) => fs.statSync(file).isFile());

    if (files.length === 0) {
      log('INFO', `No files found in ${inputPath}`);
      return { failed };
    }

    const filesToConvert = files.filter((file) =>
      sourceExts.includes(path.extname(file).toLowerCase())
    );

    if (filesToConvert.length === 0) {
      log('INFO', `No files with extension ${sourceExts.join(' or ')} found in ${inputPath}`);
      return { failed };
    }

    log('INFO', `Processing ${filesToConvert.length} files`);

    for (const file of filesToConvert) {
      const baseName = path.basename(file, path.extname(file));
      const outputFile = getUniqueOutputFile(outputDir, baseName, targetExt);
      log('DEBUG', `Converting: ${file} -> ${outputFile}`);
      try {
        await converter.fn(file, outputFile);
      } catch (error) {
        log('ERROR', `Failed to convert ${file}: ${error.message}`);
        failed.push({ file, reason: error.message });
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile); // Clean up failed output
      }
    }
  } else {
    // Process a single file
    const ext = path.extname(inputPath).toLowerCase();
    if (!sourceExts.includes(ext)) {
      log('ERROR', `File ${inputPath} does not match required extension (${sourceExts.join(' or ')})`);
      return { failed: [{ file: inputPath, reason: `Invalid extension, expected ${sourceExts.join(' or ')}` }] };
    }

    const baseName = path.basename(inputPath, path.extname(inputPath));
    const outputFile = getUniqueOutputFile(outputDir, baseName, targetExt);
    log('DEBUG', `Converting: ${inputPath} -> ${outputFile}`);
    try {
      await converter.fn(inputPath, outputFile);
    } catch (error) {
      log('ERROR', `Failed to convert ${inputPath}: ${error.message}`);
      failed.push({ file: inputPath, reason: error.message });
      if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile); // Clean up failed output
    }
  }

  log('DEBUG', 'File conversion completed');
  return { failed };
}

module.exports = { convertFiles };