#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const { log } = require('../../backend/utils/logUtils');

async function sortFilesByType() {
  try {
    log('INFO', 'Starting Sort Files By Type Feature');

    const inputDirResponse = await prompts({
      type: 'text',
      name: 'dir',
      message: 'Enter the directory containing files to sort (or press Enter to cancel):',
      validate: value => value.trim() === '' || fs.existsSync(value) ? true : 'Directory not found.'
    });
    const inputDir = inputDirResponse.dir;
    if (!inputDir) {
      log('INFO', 'No input directory provided, cancelling...');
      return 'cancelled';
    }

    const outputDirResponse = await prompts({
      type: 'text',
      name: 'dir',
      message: 'Enter the output directory to sort files into (or press Enter to cancel):',
      validate: value => value.trim() !== '' ? true : 'Output directory required.'
    });
    const outputDir = outputDirResponse.dir;
    if (!outputDir) {
      log('INFO', 'No output directory provided, cancelling...');
      return 'cancelled';
    }

    await fs.mkdir(outputDir, { recursive: true });

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

    const videoExtensions = ['.mp4', '.webm', '.gif'];
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    let processed = 0, failed = 0, skipped = 0;

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      let typeDir;

      if (videoExtensions.includes(ext)) {
        typeDir = path.join(outputDir, 'videos');
      } else if (imageExtensions.includes(ext)) {
        typeDir = path.join(outputDir, 'images');
      } else {
        log('DEBUG', `Skipping file with unsupported type: ${file}`);
        skipped++;
        continue;
      }

      await fs.mkdir(typeDir, { recursive: true });

      const destFile = path.join(typeDir, path.basename(file));
      try {
        await fs.copyFile(file, destFile);
        log('INFO', `Sorted ${path.basename(file)} to ${path.basename(typeDir)} folder`);
        processed++;
      } catch (error) {
        log('ERROR', `Failed to sort ${file} to ${destFile}: ${error.message}`);
        failed++;
      }
    }

    log('INFO', `Sorted ${processed} files, ${failed} failed, ${skipped} skipped.`);
    return failed === 0 ? 'success' : 'error';
  } catch (error) {
    log('ERROR', `Unexpected error in Sort Files By Type: ${error.message}`);
    return 'error';
  }
}

module.exports = { sortFilesByType };