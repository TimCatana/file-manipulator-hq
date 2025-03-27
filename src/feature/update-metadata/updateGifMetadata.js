#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs'); // Added for existsSync
const fsPromises = require('fs').promises; // Renamed to avoid conflict
const path = require('path');
const { execSync } = require('child_process');
const { log } = require('../../backend/utils/logUtils');

function getCurrentDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;
}

function checkExifTool() {
  try {
    const version = execSync('exiftool -ver', { encoding: 'utf8' }).trim();
    log('INFO', `ExifTool version: ${version}`);
    return true;
  } catch (error) {
    log('ERROR', 'ExifTool is not installed or not in PATH.');
    return false;
  }
}

async function processGifFile(inputFile, outputFile, metadata) {
  const currentDateTime = getCurrentDateTime();
  const command = [
    'exiftool',
    `-Comment="${metadata.comment}"`,
    `-XMP-dc:Title="${metadata.title}"`,
    `-XMP-dc:Description="${metadata.description}"`,
    `-XMP-dc:Subject="${metadata.keywords}"`,
    `-XMP-dc:Rights="${metadata.copyright}"`,
    `-XMP-dc:Type="${metadata.genre}"`,
    `-XMP-xmp:Comment="${metadata.comment}"`,
    `-XMP-xmp:CreateDate="${currentDateTime}"`,
    `-XMP-xmp:ModifyDate="${currentDateTime}"`,
    `-XMP-xmp:DateTimeOriginal="${currentDateTime}"`,
    `-ModifyDate="${currentDateTime}"`,
    `-DateTimeOriginal="${currentDateTime}"`,
    `-CreateDate="${currentDateTime}"`,
    '-overwrite_original',
    `"${outputFile}"`
  ].join(' ');

  await fsPromises.copyFile(inputFile, outputFile);
  log('INFO', `Copied ${path.basename(inputFile)} to ${outputFile}`);
  execSync(command, { stdio: 'inherit' });
  log('INFO', `Success: Metadata updated for ${outputFile}`);
}

async function updateGifMetadata() {
  try {
    log('INFO', 'Starting Update GIF Metadata Feature');

    if (!checkExifTool()) {
      log('ERROR', 'ExifTool is not installed.');
      return 'error';
    }

    const inputPathResponse = await prompts({
      type: 'text',
      name: 'path',
      message: 'Enter the path to the input GIF file or directory (or press Enter to cancel):',
      validate: value => value.trim() === '' || fs.existsSync(value) ? true : 'Path not found.'
    });
    const inputPath = inputPathResponse.path;
    if (!inputPath) {
      log('INFO', 'No input path provided, cancelling...');
      return 'cancelled';
    }

    const outputPathResponse = await prompts({
      type: 'text',
      name: 'path',
      message: 'Enter the path for the output directory (or press Enter to cancel):',
      validate: value => value.trim() !== '' ? true : 'Output directory required.'
    });
    const outputDir = outputPathResponse.path;
    if (!outputDir) {
      log('INFO', 'No output directory provided, cancelling...');
      return 'cancelled';
    }

    const metadata = await prompts([
      { type: 'text', name: 'title', message: 'Enter title:', initial: 'Untitled' },
      { type: 'text', name: 'description', message: 'Enter description:', initial: '' },
      { type: 'text', name: 'keywords', message: 'Enter keywords (comma-separated):', initial: '' },
      { type: 'text', name: 'copyright', message: 'Enter copyright:', initial: '' },
      { type: 'text', name: 'genre', message: 'Enter genre:', initial: '' },
      { type: 'text', name: 'comment', message: 'Enter comment:', initial: '' }
    ]);

    await fsPromises.mkdir(outputDir, { recursive: true });
    const stats = await fsPromises.stat(inputPath);

    if (stats.isFile()) {
      if (!inputPath.toLowerCase().endsWith('.gif')) {
        log('ERROR', 'Input file must be a GIF.');
        return 'error';
      }
      const outputFile = path.join(outputDir, path.basename(inputPath));
      await processGifFile(inputPath, outputFile, metadata);
    } else if (stats.isDirectory()) {
      const files = await fsPromises.readdir(inputPath);
      const gifFiles = files.filter(f => f.toLowerCase().endsWith('.gif'));
      if (gifFiles.length === 0) {
        log('INFO', 'No GIF files found in the directory.');
        return 'success';
      }
      for (const file of gifFiles) {
        const inputFile = path.join(inputPath, file);
        const outputFile = path.join(outputDir, file);
        await processGifFile(inputFile, outputFile, metadata);
      }
      log('INFO', `Processed ${gifFiles.length} GIF files.`);
    }

    return 'success';
  } catch (error) {
    log('ERROR', `Unexpected error in Update GIF Metadata: ${error.message}`);
    return 'error';
  }
}

module.exports = { updateGifMetadata };