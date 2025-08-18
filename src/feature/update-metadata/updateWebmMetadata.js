#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
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

function checkFFmpeg() {
  log('DEBUG', 'Checking for FFmpeg installation');
  try {
    const version = execSync('ffmpeg -version', { encoding: 'utf8' });
    log('INFO', `FFmpeg detected: ${version.split('\n')[0]}`);
    log('DEBUG', 'FFmpeg check successful');
    return true;
  } catch (error) {
    log('ERROR', 'FFmpeg is not installed or not in PATH.');
    log('DEBUG', `FFmpeg check failed: ${error.message}`);
    return false;
  }
}

async function processWebmFile(inputFile, outputFile, metadata) {
  const currentDateTime = getCurrentDateTime();
  log('DEBUG', `Processing WebM file: ${inputFile} -> ${outputFile}`);
  await new Promise((resolve, reject) => {
    const command = ffmpeg(inputFile)
      .outputOptions([
        `-metadata title="${metadata.title}"`,
        `-metadata comment="${metadata.comment}"`,
        `-metadata description="${metadata.description}"`,
        `-metadata copyright="${metadata.copyright}"`,
        `-metadata genre="${metadata.genre}"`,
        `-metadata keywords="${metadata.keywords}"`,
        `-metadata creation_time="${currentDateTime}"`,
        '-c:v copy',
        '-c:a copy'
      ])
      .save(outputFile)
      .on('start', (cmd) => log('DEBUG', `FFmpeg command: ${cmd}`))
      .on('end', async () => {
        log('INFO', `Success: Metadata updated for ${outputFile}`);
        try {
          const exifCommand = `exiftool -ModifyDate="${currentDateTime}" -DateTimeOriginal="${currentDateTime}" -CreateDate="${currentDateTime}" -FileCreateDate="${currentDateTime}" -FileModifyDate="${currentDateTime}" -overwrite_original "${outputFile}"`;
          log('DEBUG', `Executing ExifTool command: ${exifCommand}`);
          execSync(exifCommand, { stdio: 'ignore' });
          log('INFO', `Success: File timestamps updated for ${outputFile}`);
          try {
            const stats = await fsPromises.stat(outputFile);
            log('DEBUG', `Processed file size: ${stats.size} bytes for ${outputFile}`);
          } catch (statError) {
            log('DEBUG', `Failed to retrieve file size for ${outputFile}: ${statError.message}`);
          }
          resolve();
        } catch (exifError) {
          log('ERROR', `ExifTool error for ${outputFile}: ${exifError.message}`);
          log('DEBUG', `ExifTool error stack: ${exifError.stack}`);
          reject(exifError);
        }
      })
      .on('error', (err) => {
        log('ERROR', `FFmpeg error processing ${inputFile}: ${err.message}`);
        log('DEBUG', `FFmpeg error stack: ${err.stack}`);
        reject(err);
      });
  });
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

async function updateWebmMetadata(args = process.argv.slice(2)) {
  try {
    log('INFO', 'Starting Update WebM Metadata Feature');

    if (!checkExifTool() || !checkFFmpeg()) {
      log('ERROR', 'Required tools (ExifTool or FFmpeg) not installed.');
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
        message: 'Enter the path to the input WebM file or directory (or press Enter to cancel):',
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
      if (!inputPath.toLowerCase().endsWith('.webm')) {
        log('ERROR', 'Input file must be a WebM.');
        return 'error';
      }
      const outputFile = path.join(outputDir, path.basename(inputPath));
      await processWebmFile(inputFile, outputFile, metadata);
    } else if (stats.isDirectory()) {
      log('DEBUG', `Reading directory: ${inputPath}`);
      const files = await fsPromises.readdir(inputPath);
      const webmFiles = files.filter(f => f.toLowerCase().endsWith('.webm'));
      log('DEBUG', `Found ${webmFiles.length} WebM files: ${webmFiles.join(', ')}`);
      if (webmFiles.length === 0) {
        log('INFO', 'No WebM files found in the directory.');
        return 'success';
      }
      for (const file of webmFiles) {
        const inputFile = path.join(inputPath, file);
        const outputFile = path.join(outputDir, file);
        await processWebmFile(inputFile, outputFile, metadata);
      }
      log('INFO', `Processed ${webmFiles.length} WebM files.`);
    }

    log('DEBUG', 'Update WebM Metadata completed successfully');
    return 'success';
  } catch (error) {
    log('ERROR', `Unexpected error in Update WebM Metadata: ${error.message}`);
    log('DEBUG', `Error stack: ${error.stack}`);
    return 'error';
  }
}

if (require.main === module) {
  updateWebmMetadata().then(result => {
    process.exit(result === 'success' ? 0 : 1);
  }).catch(err => {
    log('ERROR', `Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { updateWebmMetadata };