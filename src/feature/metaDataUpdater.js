const path = require('path');
const fs = require('fs');
const { log } = require('../backend/logging/logUtils');
const { processGifFolder } = require('../backend/meta-data-updaters/updateGifMetadata');
const { processJpegFolder } = require('../backend/meta-data-updaters/updateJpegMetadata');
const { processMp4Folder } = require('../backend/meta-data-updaters/updateMp4Metadata');
const { processPngFolder } = require('../backend/meta-data-updaters/updatePngMetadata');
const { processWebpFolder } = require('../backend/meta-data-updaters/updateWebpMetadata');

// Map file extensions to their respective updater functions
const metadataUpdaters = {
  '.gif': processGifFolder,
  '.jpg': processJpegFolder,
  '.jpeg': processJpegFolder,
  '.mp4': processMp4Folder,
  '.png': processPngFolder,
  '.webp': processWebpFolder,
};

// Generate a unique filename with timestamp
function generateUniqueFilename(originalPath) {
  const timestamp = new Date().toISOString().replace(/[-:.T]/g, '').slice(0, 14); // e.g., 20250310123456
  const baseName = path.basename(originalPath, path.extname(originalPath));
  const ext = path.extname(originalPath);
  return `${baseName}-${timestamp}${ext}`;
}

async function updateMetadata(inputPath, isDirectory, metadata, successfulDir, failedDir) {
  const skipped = [];
  const supportedExtensions = Object.keys(metadataUpdaters);

  if (isDirectory) {
    // Batch update for folder
    const files = fs.readdirSync(inputPath).map((file) => path.join(inputPath, file));
    for (const file of files) {
      if (fs.statSync(file).isDirectory()) continue; // Skip subdirectories
      const fileExt = path.extname(file).toLowerCase();
      const updater = metadataUpdaters[fileExt];
      const outputDir = updater ? successfulDir : failedDir;
      const typeDir = path.join(outputDir, fileExt.slice(1) || 'unknown');
      const uniqueFilename = generateUniqueFilename(file);
      const outputFilePath = path.join(typeDir, uniqueFilename);

      if (updater) {
        log('DEBUG', `Processing file: ${file} -> ${outputFilePath}`);
        try {
          await updater(file, outputFilePath, metadata);
        } catch (err) {
          log('ERROR', `Failed to update ${file}: ${err.message}`);
          fs.copyFileSync(file, path.join(failedDir, fileExt.slice(1), uniqueFilename));
        }
      } else {
        log('DEBUG', `Skipping unsupported file: ${file} -> ${outputFilePath}`);
        fs.copyFileSync(file, outputFilePath); // Copy to failed dir without metadata update
        skipped.push(file);
      }
    }
  } else {
    // Single file update
    const fileExt = path.extname(inputPath).toLowerCase();
    const updater = metadataUpdaters[fileExt];
    const outputDir = updater ? successfulDir : failedDir;
    const typeDir = path.join(outputDir, fileExt.slice(1) || 'unknown');
    const uniqueFilename = generateUniqueFilename(inputPath);
    const outputFilePath = path.join(typeDir, uniqueFilename);

    if (updater) {
      log('DEBUG', `Processing file: ${inputPath} -> ${outputFilePath}`);
      try {
        await updater(inputPath, outputFilePath, metadata);
      } catch (err) {
        log('ERROR', `Failed to update ${inputPath}: ${err.message}`);
        fs.copyFileSync(inputPath, path.join(failedDir, fileExt.slice(1), uniqueFilename));
      }
    } else {
      log('DEBUG', `Skipping unsupported file: ${inputPath} -> ${outputFilePath}`);
      fs.copyFileSync(inputPath, outputFilePath); // Copy to failed dir without metadata update
      skipped.push(inputPath);
    }
  }

  return { skipped };
}

module.exports = { updateMetadata };