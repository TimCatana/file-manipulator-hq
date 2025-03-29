#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs');
const fsPromises = require('fs').promises;
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
  log('DEBUG', 'Checking for ExifTool installation');
  try {
    const version = execSync('exiftool -ver', { encoding: 'utf8' }).trim();
    log('INFO', `ExifTool version: ${version}`);
    log('DEBUG', 'ExifTool check successful');
    return true;
  } catch (error) {
    log('ERROR', 'ExifTool is not installed or not in PATH.');
    log('DEBUG', `ExifTool check failed: ${error.message}`);
    return false;
  }
}

async function processJpgFile(inputFile, outputFile, metadata) {
  const currentDateTime = getCurrentDateTime();
  log('DEBUG', `Processing JPG file: ${inputFile} -> ${outputFile}`);
  const command = [
    'exiftool',
    `-EXIF:ImageDescription="${metadata.description}"`,
    `-EXIF:Copyright="${metadata.copyright}"`,
    `-EXIF:UserComment="${metadata.comment}"`,
    `-EXIF:Artist="${metadata.copyright.split(' ')[1] || 'Unknown'}"`,
    `-IPTC:ObjectName="${metadata.title}"`,
    `-IPTC:Caption-Abstract="${metadata.description}"`,
    `-IPTC:Keywords="${metadata.keywords}"`,
    `-IPTC:CopyrightNotice="${metadata.copyright}"`,
    `-IPTC:Category="${metadata.genre}"`,
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
  log('DEBUG', `ExifTool command: ${command}`);

  log('DEBUG', `Copying file from ${inputFile} to ${outputFile}`);
  await fsPromises.copyFile(inputFile, outputFile);
  log('INFO', `Copied ${path.basename(inputFile)} to ${outputFile}`);

  log('DEBUG', `Executing ExifTool command for ${outputFile}`);
  execSync(command, { stdio: 'inherit' });
  log('INFO', `Success: Metadata updated for ${outputFile}`);
}

async function updateJpgMetadata() {
  try {
    log('INFO', 'Starting Update JPG Metadata Feature');

    if (!checkExifTool()) {
      log('ERROR', 'ExifTool is not installed.');
      return 'error';
    }

    log('DEBUG', 'Prompting for input path');
    const inputPathResponse = await prompts({
      type: 'text',
      name: 'path',
      message: 'Enter the path to the input JPG file or directory (or press Enter to cancel):',
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

    log('DEBUG', 'Prompting for metadata input');
    const metadata = await prompts([
      { type: 'text', name: 'title', message: 'Enter title:', initial: 'Untitled' },
      { type: 'text', name: 'description', message: 'Enter description:', initial: '' },
      { type: 'text', name: 'keywords', message: 'Enter keywords (comma-separated):', initial: '' },
      { type: 'text', name: 'copyright', message: 'Enter copyright:', initial: '' },
      { type: 'text', name: 'genre', message: 'Enter genre:', initial: '' },
      { type: 'text', name: 'comment', message: 'Enter comment:', initial: '' }
    ]);
    log('DEBUG', `Metadata collected: ${JSON.stringify(metadata)}`);

    log('DEBUG', `Creating output directory: ${outputDir}`);
    await fsPromises.mkdir(outputDir, { recursive: true });
    log('DEBUG', `Output directory created or verified: ${outputDir}`);

    const stats = await fsPromises.stat(inputPath);
    log('DEBUG', `Input path stats: ${stats.isFile() ? 'File' : 'Directory'}`);

    if (stats.isFile()) {
      if (!inputPath.toLowerCase().endsWith('.jpg') && !inputPath.toLowerCase().endsWith('.jpeg')) {
        log('ERROR', 'Input file must be a JPG.');
        return 'error';
      }
      const outputFile = path.join(outputDir, path.basename(inputPath));
      await processJpgFile(inputPath, outputFile, metadata);
    } else if (stats.isDirectory()) {
      log('DEBUG', `Reading directory: ${inputPath}`);
      const files = await fsPromises.readdir(inputPath);
      const jpgFiles = files.filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg'));
      log('DEBUG', `Found ${jpgFiles.length} JPG files: ${jpgFiles.join(', ')}`);
      if (jpgFiles.length === 0) {
        log('INFO', 'No JPG files found in the directory.');
        return 'success';
      }
      for (const file of jpgFiles) {
        const inputFile = path.join(inputPath, file);
        const outputFile = path.join(outputDir, file);
        await processJpgFile(inputFile, outputFile, metadata);
      }
      log('INFO', `Processed ${jpgFiles.length} JPG files.`);
    }

    log('DEBUG', 'Update JPG Metadata completed successfully');
    return 'success';
  } catch (error) {
    log('ERROR', `Unexpected error in Update JPG Metadata: ${error.message}`);
    log('DEBUG', `Error stack: ${error.stack}`);
    return 'error';
  }
}

module.exports = { updateJpgMetadata };