#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { log } = require('../backend/logging/logUtils');

// Rename files in the directory with a base name and index
async function renameFiles(inputDir, fileNameBase) {
  const failed = [];

  log('DEBUG', 'Starting file renaming');

  // Validate input directory
  if (!fs.existsSync(inputDir)) {
    log('ERROR', `Input directory does not exist: ${inputDir}`);
    throw new Error('Input directory does not exist');
  }

  // Read all files in the directory
  const files = fs.readdirSync(inputDir)
    .map((file) => path.join(inputDir, file))
    .filter((file) => fs.statSync(file).isFile());

  if (files.length === 0) {
    log('INFO', `No files found in ${inputDir}`);
    return { failed };
  }

  log('INFO', `Processing ${files.length} files`);

  files.forEach((file, index) => {
    const originalExt = path.extname(file);
    const newFileName = `${fileNameBase}-${index + 1}${originalExt}`; // Start from 1
    const newFilePath = path.join(inputDir, newFileName);

    try {
      if (file !== newFilePath) { // Avoid renaming if already correct
        fs.renameSync(file, newFilePath);
        log('INFO', `Renamed ${path.basename(file)} to ${newFileName}`);
      } else {
        log('DEBUG', `File already named correctly: ${file}`);
      }
    } catch (error) {
      log('ERROR', `Error renaming ${file} to ${newFileName}: ${error.message}`);
      failed.push({ file, reason: error.message });
    }
  });

  log('DEBUG', 'File renaming completed');
  return { failed };
}

module.exports = { renameFiles };