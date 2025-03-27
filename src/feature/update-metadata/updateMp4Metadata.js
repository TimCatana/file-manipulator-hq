#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs'); // Added for existsSync
const fsPromises = require('fs').promises; // Renamed to avoid conflict
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

async function processMp4File(inputFile, outputFile, metadata) {
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
        `-metadata creation_time="${currentDateTime}"`,
        '-c:v copy',
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

async function updateMp4Metadata() {
  try {
    log('INFO', 'Starting Update MP4 Metadata Feature');

    if (!checkExifTool() || !checkFFmpeg()) {
      log('ERROR', 'Required tools (ExifTool or FFmpeg) not installed.');
      return 'error';
    }

    const inputPathResponse = await prompts({
      type: 'text',
      name: 'path',
      message: 'Enter the path to the input MP4 file or directory (or press Enter to cancel):',
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
      if (!inputPath.toLowerCase().endsWith('.mp4')) {
        log('ERROR', 'Input file must be an MP4.');
        return 'error';
      }
      const outputFile = path.join(outputDir, path.basename(inputPath));
      await processMp4File(inputPath, outputFile, metadata);
    } else if (stats.isDirectory()) {
      const files = await fsPromises.readdir(inputPath);
      const mp4Files = files.filter(f => f.toLowerCase().endsWith('.mp4'));
      if (mp4Files.length === 0) {
        log('INFO', 'No MP4 files found in the directory.');
        return 'success';
      }
      for (const file of mp4Files) {
        const inputFile = path.join(inputPath, file);
        const outputFile = path.join(outputDir, file);
        await processMp4File(inputFile, outputFile, metadata);
      }
      log('INFO', `Processed ${mp4Files.length} MP4 files.`);
    }

    return 'success';
  } catch (error) {
    log('ERROR', `Unexpected error in Update MP4 Metadata: ${error.message}`);
    return 'error';
  }
}

module.exports = { updateMp4Metadata };