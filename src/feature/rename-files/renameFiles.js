#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const { log } = require('../../backend/utils/logUtils');

async function renameFiles() {
  try {
    log('INFO', 'Starting Rename Files Feature');

    const inputDirResponse = await prompts({
      type: 'text',
      name: 'dir',
      message: 'Enter the directory containing files to rename (or press Enter to cancel):',
      validate: value => value.trim() === '' || fs.existsSync(value) ? true : 'Directory not found.'
    });
    const inputDir = inputDirResponse.dir;
    if (!inputDir) {
      log('INFO', 'No input directory provided, cancelling...');
      return 'cancelled';
    }

    const fileNameBaseResponse = await prompts({
      type: 'text',
      name: 'base',
      message: 'Enter the base name for renamed files (e.g., "file" becomes "file-1", "file-2", etc.):',
      validate: value => value.trim() !== '' ? true : 'Base name required.'
    });
    const fileNameBase = fileNameBaseResponse.base;
    if (!fileNameBase) {
      log('INFO', 'No base name provided, cancelling...');
      return 'cancelled';
    }

    // Read directory and filter files asynchronously
    const dirEntries = await fs.readdir(inputDir);
    const files = [];
    for (const entry of dirEntries) {
      const fullPath = path.join(inputDir, entry);
      const stats = await fs.stat(fullPath);
      if (stats.isFile()) {
        files.push(fullPath);
      }
    }

    if (files.length === 0) {
      log('INFO', `No files found in ${inputDir}`);
      return 'success';
    }

    log('INFO', `Processing ${files.length} files`);
    let failed = 0;

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const originalExt = path.extname(file);
      const newFileName = `${fileNameBase}-${index + 1}${originalExt}`;
      const newFilePath = path.join(inputDir, newFileName);

      try {
        if (file !== newFilePath) {
          await fs.rename(file, newFilePath);
          log('INFO', `Renamed ${path.basename(file)} to ${newFileName}`);
        } else {
          log('DEBUG', `File already named correctly: ${file}`);
        }
      } catch (error) {
        log('ERROR', `Error renaming ${file} to ${newFileName}: ${error.message}`);
        failed++;
      }
    }

    log('INFO', `Renamed ${files.length - failed} files, ${failed} failed.`);
    return failed === 0 ? 'success' : 'error';
  } catch (error) {
    log('ERROR', `Unexpected error in Rename Files: ${error.message}`);
    return 'error';
  }
}

module.exports = { renameFiles };