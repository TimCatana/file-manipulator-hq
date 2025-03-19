#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
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
  try {
    const version = execSync('exiftool -ver', { encoding: 'utf8' }).trim();
    log('INFO', `ExifTool version: ${version}`);
    return true;
  } catch (error) {
    log('ERROR', 'ExifTool is not installed or not in PATH.');
    return false;
  }
}

function checkFFmpeg() {
  try {
    const version = execSync('ffmpeg -version', { encoding: 'utf8' });
    log('INFO', `FFmpeg detected: ${version.split('\n')[0]}`);
    return true;
  } catch (error) {
    log('ERROR', 'FFmpeg is not installed or not in PATH.');
    return false;
  }
}

async function processWavFile(inputFile, outputFile, metadata) {
  const currentDateTime = getCurrentDateTime();
  await new Promise((resolve, reject) => {
    ffmpeg(inputFile)
      .outputOptions([
        `-metadata title="${metadata.title}"`,
        `-metadata comment="${metadata.comment}"`,
        `-metadata description="${metadata.description}"`,
        `-metadata copyright="${metadata.copyright}"`,
        `-metadata genre="${metadata.genre}"`,
        `-metadata keywords="${metadata.keywords}"`,
        `-metadata date="${currentDateTime}"`,
        '-c:a copy'
      ])
      .save(outputFile)
      .on('end', () => {
        log('INFO', `Success: Metadata updated for ${outputFile}`);
        try {
          execSync(
            `exiftool -ModifyDate="${currentDateTime}" -DateTimeOriginal="${currentDateTime}" -CreateDate="${currentDateTime}" -FileCreateDate="${currentDateTime}" -FileModifyDate="${currentDateTime}" -overwrite_original "${outputFile}"`,
            { stdio: 'ignore' }
          );
          log('INFO', `Success: File timestamps updated for ${outputFile}`);
          resolve();
        } catch (exifError) {
          log('ERROR', `ExifTool error for ${outputFile}: ${exifError.message}`);
          reject(exifError);
        }
      })
      .on('error', (err) => {
        log('ERROR', `FFmpeg error processing ${inputFile}: ${err.message}`);
        reject(err);
      });
  });
}

async function updateWavMetadata() {
  try {
    log('INFO', 'Starting Update WAV Metadata Feature');

    if (!checkExifTool() || !checkFFmpeg()) {
      log('ERROR', 'Required tools (ExifTool or FFmpeg) not installed.');
      return 'error';
    }

    const inputPathResponse = await prompts({
      type: 'text',
      name: 'path',
      message: 'Enter the path to the input WAV file or directory (or press Enter to cancel):',
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

    await fs.mkdir(outputDir, { recursive: true });
    const stats = await fs.stat(inputPath);

    if (stats.isFile()) {
      if (!inputPath.toLowerCase().endsWith('.wav')) {
        log('ERROR', 'Input file must be a WAV.');
        return 'error';
      }
      const outputFile = path.join(outputDir, path.basename(inputPath));
      await processWavFile(inputPath, outputFile, metadata);
    } else if (stats.isDirectory()) {
      const files = await fs.readdir(inputPath);
      const wavFiles = files.filter(f => f.toLowerCase().endsWith('.wav'));
      if (wavFiles.length === 0) {
        log('INFO', 'No WAV files found in the directory.');
        return 'success';
      }
      for (const file of wavFiles) {
        const inputFile = path.join(inputPath, file);
        const outputFile = path.join(outputDir, file);
        await processWavFile(inputFile, outputFile, metadata);
      }
      log('INFO', `Processed ${wavFiles.length} WAV files.`);
    }

    return 'success';
  } catch (error) {
    log('ERROR', `Unexpected error in Update WAV Metadata: ${error.message}`);
    return 'error';
  }
}

module.exports = { updateWavMetadata };