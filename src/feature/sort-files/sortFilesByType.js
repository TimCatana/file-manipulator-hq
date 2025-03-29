#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const { log } = require('../../backend/utils/logUtils');

function parseArgs(args) {
  const params = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const flag = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : '';
      params[flag] = value;
      i++;
    }
  }
  return params;
}

async function sortFilesByType(args = process.argv.slice(2)) {
  try {
    log('INFO', 'Starting Sort Files By Type Feature');

    const params = parseArgs(args);
    const hasArgs = Object.keys(params).length > 0;

    let inputDir;
    if (params['input']) {
      inputDir = params['input'];
      if (!await fs.stat(inputDir).then(stats => stats.isDirectory()).catch(() => false)) {
        log('ERROR', `Input path not found or not a directory: ${inputDir}`);
        return 'error';
      }
      log('DEBUG', `Input directory from args: ${inputDir}`);
    } else if (!hasArgs) {
      log('DEBUG', 'Prompting for input directory');
      const inputDirResponse = await prompts({
        type: 'text',
        name: 'dir',
        message: 'Enter the directory containing files to sort (or press Enter to cancel):',
        validate: value => value.trim() === '' || fs.existsSync(value) ? true : 'Directory not found.'
      });
      inputDir = inputDirResponse.dir;
      log('DEBUG', `Input directory provided: ${inputDir}`);
      if (!inputDir) {
        log('INFO', 'No input directory provided, cancelling...');
        return 'cancelled';
      }
    } else {
      log('ERROR', 'Missing required --input argument');
      return 'error';
    }

    let outputDir;
    if (params['output']) {
      outputDir = params['output'];
      log('DEBUG', `Output directory from args: ${outputDir}`);
    } else if (!hasArgs) {
      log('DEBUG', 'Prompting for output directory');
      const outputDirResponse = await prompts({
        type: 'text',
        name: 'dir',
        message: 'Enter the output directory to sort files into (or press Enter to cancel):',
        validate: value => value.trim() !== '' ? true : 'Output directory required.'
      });
      outputDir = outputDirResponse.dir;
      log('DEBUG', `Output directory provided: ${outputDir}`);
      if (!outputDir) {
        log('INFO', 'No output directory provided, cancelling...');
        return 'cancelled';
      }
    } else {
      log('ERROR', 'Missing required --output argument');
      return 'error';
    }

    log('DEBUG', `Creating output directory: ${outputDir}`);
    await fs.mkdir(outputDir, { recursive: true });
    log('DEBUG', `Output directory created or verified: ${outputDir}`);

    log('DEBUG', `Reading directory: ${inputDir}`);
    const dirEntries = await fs.readdir(inputDir);
    const files = [];
    for (const entry of dirEntries) {
      const fullPath = path.join(inputDir, entry);
      const stats = await fs.stat(fullPath);
      if (stats.isFile()) {
        files.push(fullPath);
      }
    }
    log('DEBUG', `Found ${files.length} files in ${inputDir}: ${files.join(', ')}`);

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

      log('DEBUG', `Creating type directory: ${typeDir}`);
      await fs.mkdir(typeDir, { recursive: true });
      log('DEBUG', `Type directory created or verified: ${typeDir}`);

      const destFile = path.join(typeDir, path.basename(file));
      log('DEBUG', `Copying ${file} to ${destFile}`);
      try {
        await fs.copyFile(file, destFile);
        log('INFO', `Sorted ${path.basename(file)} to ${path.basename(typeDir)} folder`);
        processed++;
      } catch (error) {
        log('ERROR', `Failed to sort ${file} to ${destFile}: ${error.message}`);
        log('DEBUG', `Copy error stack: ${error.stack}`);
        failed++;
      }
    }

    log('INFO', `Sorted ${processed} files, ${failed} failed, ${skipped} skipped.`);
    log('DEBUG', `Sort Files By Type completed: ${processed} processed, ${failed} failed, ${skipped} skipped`);
    return failed === 0 ? 'success' : 'error';
  } catch (error) {
    log('ERROR', `Unexpected error in Sort Files By Type: ${error.message}`);
    log('DEBUG', `Error stack: ${error.stack}`);
    return 'error';
  }
}

if (require.main === module) {
  sortFilesByType().then(result => {
    process.exit(result === 'success' ? 0 : 1);
  }).catch(err => {
    log('ERROR', `Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { sortFilesByType };