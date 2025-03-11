#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { log } = require('../backend/utils/logUtils');

async function sortFilesByExtension(inputDir, outputDir) {
  const failed = [];
  const skipped = [];

  log('DEBUG', `Starting file sorting in ${inputDir} to ${outputDir}`);

  if (!fs.existsSync(inputDir)) {
    log('ERROR', `Input directory does not exist: ${inputDir}`);
    throw new Error('Input directory does not exist');
  }

  const files = fs.readdirSync(inputDir)
    .map((file) => path.join(inputDir, file))
    .filter((file) => fs.statSync(file).isFile());

  if (files.length === 0) {
    log('INFO', `No files found in ${inputDir}`);
    return { failed, skipped };
  }

  const supportedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.mp4', '.webp'];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!supportedExtensions.includes(ext)) {
      log('DEBUG', `Skipping file with unsupported extension: ${file}`);
      skipped.push(file);
      continue;
    }

    const extDir = path.join(outputDir, ext.slice(1)); // e.g., 'png' from '.png'
    await fs.promises.mkdir(extDir, { recursive: true }).catch((err) => {
      log('ERROR', `Failed to create directory ${extDir}: ${err.message}`);
      failed.push({ file, reason: err.message });
      return;
    });

    const destFile = path.join(extDir, path.basename(file));
    try {
      await fs.promises.copyFile(file, destFile);
      log('DEBUG', `Sorted ${file} to ${destFile}`);
    } catch (err) {
      log('ERROR', `Failed to sort ${file} to ${destFile}: ${err.message}`);
      failed.push({ file, reason: err.message });
    }
  }

  log('DEBUG', 'File sorting completed');
  return { failed, skipped };
}

module.exports = { sortFilesByExtension };