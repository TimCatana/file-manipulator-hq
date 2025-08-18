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

  try {
    const stats = await fsPromises.stat(outputFile);
    log('DEBUG', `Processed file size: ${stats.size} bytes for ${outputFile}`);
  } catch (statError) {
    log('DEBUG', `Failed to retrieve file size for ${outputFile}: ${statError.message}`);
  }
}

function parseArgs(args) {
  const params = {};
  const validFlags = ['input', 'output', 'title', 'description', 'keywords', 'copyright', 'genre', 'comment'];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const flag = args[i].slice(2);
      if (validFlags.includes(flag)) {
        const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : '';
        params[flag] = value;
        i++;
      } else {
        log('DEBUG', `Ignoring unrecognized argument: --${flag}`);
        if (args[i + 1] && !args[i + 1].startsWith('--')) i++; // Skip value of unrecognized flag
      }
    }
  }
  return params;
}

async function updateJpgMetadata(args = process.argv.slice(2)) {
  try {
    log('INFO', 'Starting Update JPG Metadata Feature');

    if (!checkExifTool()) {
      log('ERROR', 'ExifTool is not installed.');
      return 'error';
    }

    const params = parseArgs(args);
    if (params.error) return 'error';

    let inputPath;
    if (params['input']) {
      inputPath = params['input'];
      if (!fs.existsSync(inputPath)) {
        log('ERROR', `Input path not found: ${inputPath}`);
        return 'error';
      }
      log('DEBUG', `Input path from args: ${inputPath}`);
    } else {
      log('DEBUG', 'Prompting for input path');
      const inputPathResponse = await prompts({
        type: 'text',
        name: 'path',
        message: 'Enter the path to the input JPG file or directory (or press Enter to cancel):',
        validate: value => value.trim() === '' || fs.existsSync(value) ? true : 'Path not found.'
      });
      inputPath = inputPathResponse.path;
      log('DEBUG', `Input path provided: ${inputPath}`);
      if (!inputPath) {
        log('INFO', 'No input path provided, cancelling...');
        return 'cancelled';
      }
    }

    let outputDir;
    if (params['output']) {
      outputDir = params['output'];
      log('DEBUG', `Output directory from args: ${outputDir}`);
    } else {
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
    if (params['title'] || params['description'] || params['keywords'] || params['copyright'] || params['genre'] || params['comment']) {
      metadata = {
        title: params['title'] || null,
        description: params['description'] || null,
        keywords: params['keywords'] || null,
        copyright: params['copyright'] || null,
        genre: params['genre'] || null,
        comment: params['comment'] || null
      };

      const metadataPrompts = [];
      if (!metadata.title) metadataPrompts.push({ type: 'text', name: 'title', message: 'Enter title:', initial: defaultMetadata.title });
      if (!metadata.description) metadataPrompts.push({ type: 'text', name: 'description', message: 'Enter description:', initial: defaultMetadata.description });
      if (!metadata.keywords) metadataPrompts.push({ type: 'text', name: 'keywords', message: 'Enter keywords (comma-separated):', initial: defaultMetadata.keywords });
      if (!metadata.copyright) metadataPrompts.push({ type: 'text', name: 'copyright', message: 'Enter copyright:', initial: defaultMetadata.copyright });
      if (!metadata.genre) metadataPrompts.push({ type: 'text', name: 'genre', message: 'Enter genre:', initial: defaultMetadata.genre });
      if (!metadata.comment) metadataPrompts.push({ type: 'text', name: 'comment', message: 'Enter comment:', initial: defaultMetadata.comment });

      if (metadataPrompts.length > 0) {
        log('DEBUG', 'Prompting for missing metadata fields');
        const additionalMetadata = await prompts(metadataPrompts);
        metadata = { ...defaultMetadata, ...metadata, ...additionalMetadata };
      } else {
        metadata = { ...defaultMetadata, ...metadata };
      }
      log('DEBUG', `Metadata from args/prompts: ${JSON.stringify(metadata)}`);
    } else {
      log('DEBUG', 'Prompting for full metadata input');
      metadata = await prompts([
        { type: 'text', name: 'title', message: 'Enter title:', initial: defaultMetadata.title },
        { type: 'text', name: 'description', message: 'Enter description:', initial: defaultMetadata.description },
        { type: 'text', name: 'keywords', message: 'Enter keywords (comma-separated):', initial: defaultMetadata.keywords },
        { type: 'text', name: 'copyright', message: 'Enter copyright:', initial: defaultMetadata.copyright },
        { type: 'text', name: 'genre', message: 'Enter genre:', initial: defaultMetadata.genre },
        { type: 'text', name: 'comment', message: 'Enter comment:', initial: defaultMetadata.comment }
      ]);
      log('DEBUG', `Metadata collected: ${JSON.stringify(metadata)}`);
      if (!metadata.title) {
        log('INFO', 'Metadata input cancelled.');
        return 'cancelled';
      }
      metadata = { ...defaultMetadata, ...metadata };
    }

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
      await processJpgFile(inputFile, outputFile, metadata);
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

if (require.main === module) {
  updateJpgMetadata().then(result => {
    process.exit(result === 'success' ? 0 : 1);
  }).catch(err => {
    log('ERROR', `Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { updateJpgMetadata };