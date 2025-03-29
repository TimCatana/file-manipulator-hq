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

async function processGifFile(inputFile, outputFile, metadata) {
  const currentDateTime = getCurrentDateTime();
  log('DEBUG', `Processing GIF file: ${inputFile} -> ${outputFile}`);
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
  log('DEBUG', `ExifTool command: ${command}`);

  log('DEBUG', `Copying file from ${inputFile} to ${outputFile}`);
  await fsPromises.copyFile(inputFile, outputFile);
  log('INFO', `Copied ${path.basename(inputFile)} to ${outputFile}`);

  log('DEBUG', `Executing ExifTool command for ${outputFile}`);
  execSync(command, { stdio: 'inherit' });
  log('INFO', `Success: Metadata updated for ${outputFile}`);
}

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

async function updateGifMetadata(args = process.argv.slice(2)) {
  try {
    log('INFO', 'Starting Update GIF Metadata Feature');

    if (!checkExifTool()) {
      log('ERROR', 'ExifTool is not installed.');
      return 'error';
    }

    const params = parseArgs(args);
    const hasArgs = Object.keys(params).length > 0;

    let inputPath;
    if (params['input']) {
      inputPath = params['input'];
      if (!fs.existsSync(inputPath)) {
        log('ERROR', `Input path not found: ${inputPath}`);
        return 'error';
      }
      log('DEBUG', `Input path from args: ${inputPath}`);
    } else if (!hasArgs) {
      log('DEBUG', 'Prompting for input path');
      const inputPathResponse = await prompts({
        type: 'text',
        name: 'path',
        message: 'Enter the path to the input GIF file or directory (or press Enter to cancel):',
        validate: value => value.trim() === '' || fs.existsSync(value) ? true : 'Path not found.'
      });
      inputPath = inputPathResponse.path;
      log('DEBUG', `Input path provided: ${inputPath}`);
      if (!inputPath) {
        log('INFO', 'No input path provided, cancelling...');
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
      const outputPathResponse = await prompts({
        type: 'text',
        name: 'path',
        message: 'Enter the path for the output directory (or press Enter to cancel):',
        validate: value => value.trim() !== '' ? true : 'Output directory required.'
      });
      outputDir = outputPathResponse.path;
      log('DEBUG', `Output directory provided: ${outputDir}`);
      if (!outputDir) {
        log('INFO', 'No output directory provided, cancelling...');
        return 'cancelled';
      }
    } else {
      log('ERROR', 'Missing required --output argument');
      return 'error';
    }

    const defaultMetadata = {
      title: 'Untitled',
      description: '',
      keywords: '',
      copyright: '',
      genre: '',
      comment: ''
    };
    let metadata;
    if (hasArgs) {
      metadata = {
        title: params['title'] || defaultMetadata.title,
        description: params['description'] || defaultMetadata.description,
        keywords: params['keywords'] || defaultMetadata.keywords,
        copyright: params['copyright'] || defaultMetadata.copyright,
        genre: params['genre'] || defaultMetadata.genre,
        comment: params['comment'] || defaultMetadata.comment
      };
      log('DEBUG', `Metadata from args: ${JSON.stringify(metadata)}`);
    } else {
      log('DEBUG', 'Prompting for metadata input');
      metadata = await prompts([
        { type: 'text', name: 'title', message: 'Enter title:', initial: defaultMetadata.title },
        { type: 'text', name: 'description', message: 'Enter description:', initial: defaultMetadata.description },
        { type: 'text', name: 'keywords', message: 'Enter keywords (comma-separated):', initial: defaultMetadata.keywords },
        { type: 'text', name: 'copyright', message: 'Enter copyright:', initial: defaultMetadata.copyright },
        { type: 'text', name: 'genre', message: 'Enter genre:', initial: defaultMetadata.genre },
        { type: 'text', name: 'comment', message: 'Enter comment:', initial: defaultMetadata.comment }
      ]);
      log('DEBUG', `Metadata collected: ${JSON.stringify(metadata)}`);
    }

    log('DEBUG', `Creating output directory: ${outputDir}`);
    await fsPromises.mkdir(outputDir, { recursive: true });
    log('DEBUG', `Output directory created or verified: ${outputDir}`);

    const stats = await fsPromises.stat(inputPath);
    log('DEBUG', `Input path stats: ${stats.isFile() ? 'File' : 'Directory'}`);

    if (stats.isFile()) {
      if (!inputPath.toLowerCase().endsWith('.gif')) {
        log('ERROR', 'Input file must be a GIF.');
        return 'error';
      }
      const outputFile = path.join(outputDir, path.basename(inputPath));
      await processGifFile(inputPath, outputFile, metadata);
    } else if (stats.isDirectory()) {
      log('DEBUG', `Reading directory: ${inputPath}`);
      const files = await fsPromises.readdir(inputPath);
      const gifFiles = files.filter(f => f.toLowerCase().endsWith('.gif'));
      log('DEBUG', `Found ${gifFiles.length} GIF files: ${gifFiles.join(', ')}`);
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

    log('DEBUG', 'Update GIF Metadata completed successfully');
    return 'success';
  } catch (error) {
    log('ERROR', `Unexpected error in Update GIF Metadata: ${error.message}`);
    log('DEBUG', `Error stack: ${error.stack}`);
    return 'error';
  }
}

if (require.main === module) {
  updateGifMetadata().then(result => {
    process.exit(result === 'success' ? 0 : 1);
  }).catch(err => {
    log('ERROR', `Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { updateGifMetadata };