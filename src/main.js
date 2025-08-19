#!/usr/bin/env node

require('dotenv').config();
const prompts = require('prompts');
const path = require('path');
const fs = require('fs');
const { log, setupConsoleLogging } = require('./backend/utils/logUtils');
// Update Metadata Imports
const { updateGifMetadata } = require('./feature/update-metadata/updateGifMetadata');
const { updateJpgMetadata } = require('./feature/update-metadata/updateJpgMetadata');
const { updateMp4Metadata } = require('./feature/update-metadata/updateMp4Metadata');
const { updatePngMetadata } = require('./feature/update-metadata/updatePngMetadata');
const { updateWavMetadata } = require('./feature/update-metadata/updateWavMetadata');
const { updateWebpMetadata } = require('./feature/update-metadata/updateWebpMetadata');
const { updateWebmMetadata } = require('./feature/update-metadata/updateWebmMetadata');
// Convert Video File Type Imports
const { convertGifToMp4 } = require('./feature/convert-file-type/convert-videos/convertGifToMp4');
const { convertGifToMov } = require('./feature/convert-file-type/convert-videos/convertGifToMov');
const { convertGifToWebm } = require('./feature/convert-file-type/convert-videos/convertGifToWebm');
const { convertMp4ToGif } = require('./feature/convert-file-type/convert-videos/convertMp4ToGif');
const { convertMp4ToMov } = require('./feature/convert-file-type/convert-videos/convertMp4ToMov');
const { convertMp4ToWebm } = require('./feature/convert-file-type/convert-videos/convertMp4ToWebm');
const { convertMovToGif } = require('./feature/convert-file-type/convert-videos/convertMovToGif');
const { convertMovToMp4 } = require('./feature/convert-file-type/convert-videos/convertMovToMp4');
const { convertMovToWebm } = require('./feature/convert-file-type/convert-videos/convertMovToWebm');
const { convertWebmToGif } = require('./feature/convert-file-type/convert-videos/convertWebmToGif');
const { convertWebmToMov } = require('./feature/convert-file-type/convert-videos/convertWebmToMov');
const { convertWebmToMp4 } = require('./feature/convert-file-type/convert-videos/convertWebmToMp4');
// Convert Audio File Type Imports
const { convertGifToMp3 } = require('./feature/convert-file-type/convert-video-to-audio/convertGifToMp3');
const { convertGifToWav } = require('./feature/convert-file-type/convert-video-to-audio/convertGifToWav');
const { convertMovToMp3 } = require('./feature/convert-file-type/convert-video-to-audio/convertMovToMp3');
const { convertMovToWav } = require('./feature/convert-file-type/convert-video-to-audio/convertMovToWav');
const { convertMp4ToMp3 } = require('./feature/convert-file-type/convert-video-to-audio/convertMp4ToMp3');
const { convertMp4ToWav } = require('./feature/convert-file-type/convert-video-to-audio/convertMp4ToWav');
const { convertWebmToMp3 } = require('./feature/convert-file-type/convert-video-to-audio/convertWebmToMp3');
const { convertWebmToWav } = require('./feature/convert-file-type/convert-video-to-audio/convertWebmToWav');
// Convert Image File Type Imports
const { convertJpgToPng } = require('./feature/convert-file-type/convert-images/convertJpgToPng');
const { convertJpgToWebp } = require('./feature/convert-file-type/convert-images/convertJpgToWebp');
const { convertPngToJpg } = require('./feature/convert-file-type/convert-images/convertPngToJpg');
const { convertPngToWebp } = require('./feature/convert-file-type/convert-images/convertPngToWebp');
const { convertWebpToJpg } = require('./feature/convert-file-type/convert-images/convertWebpToJpg');
const { convertWebpToPng } = require('./feature/convert-file-type/convert-images/convertWebpToPng');
// Resize Files Imports
const { resizeImages } = require('./feature/resize-files/resizeImages');
const { resizeVideos } = require('./feature/resize-files/resizeVideos');
// Rename Files Import
const { renameFiles } = require('./feature/rename-files/renameFiles');
// Sort Files Imports
const { sortFilesByExtension } = require('./feature/sort-files/sortFilesByExtension');
const { sortFilesByType } = require('./feature/sort-files/sortFilesByType');
// Generate Images Imports
const { generateDalleImage } = require('./feature/generate-images/generateDalleImage');
const { generateIdeogramImage } = require('./feature/generate-images/generateIdeogramImage');
const { generateGrokImage } = require('./feature/generate-images/generateGrokImage');
// Cleanup Files Imports
const { findDuplicateImages } = require('./feature/cleanup-files/findDuplicateImages');
const { findDuplicateVideos } = require('./feature/cleanup-files/findDuplicateVideos');

// Configuration
const BASE_DIR = path.join(__dirname, '..');
const BIN_DIR = path.join(BASE_DIR, 'bin');
const JSON_DIR = path.join(BASE_DIR, 'json');
const LOG_DIR = path.join(BASE_DIR, 'logs');

// Parse command-line arguments
function parseArgs(args) {
  const validFlags = ['help', 'v', 'version', 'verbose'];
  const params = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const flag = args[i].slice(2);
      if (validFlags.includes(flag)) {
        params[flag] = true;
      } else {
        log('WARN', `Ignoring unrecognized argument: --${flag}`);
      }
    } else if (args[i].startsWith('-')) {
      const flag = args[i].slice(1);
      if (validFlags.includes(flag)) {
        params[flag] = true;
      } else {
        log('WARN', `Ignoring unrecognized argument: -${flag}`);
      }
    }
  }
  return params;
}

// Help message
function displayHelp() {
  const helpText = `
main.js - Metadata Update, File Conversion, Resize, Rename, Sort, Cleanup & Media Generation Console Application

Usage:
  node src/main.js [--help] [--verbose]

Options:
  --help        Display this help and exit
  -v, --version Display version and exit
  --verbose     Enable verbose logging

Features:
  - Convert File Type:
    - Videos: GIF to MP4/MOV/WebM, MOV to GIF/MP4/WebM, MP4 to GIF/MOV/WebM, WebM to GIF/MOV/MP4
    - Video to Audio: GIF to MP3/WAV, MOV to MP3/WAV, MP4 to MP3/WAV, WebM to MP3/WAV
    - Images: JPG to PNG/WebP, PNG to JPG/WebP, WebP to JPG/PNG
  - Rename Files
  - Sort Files:
    - Sort Files By Extension
    - Sort Files By Type (Video & Images)
  - Cleanup Files:
    - Find Duplicate Images
    - Find Duplicate Videos
  - Resize Files: Images, Videos
  - Update Metadata: GIF, JPG, MP4, PNG, WAV, WebP, WebM
  - Generate Images:
    - Generate Dalle Image
    - Generate Ideogram Image
    - Generate Grok Image
  - Generate Videos:

Directories:
  - Bin: ${path.relative(BASE_DIR, BIN_DIR)}
  - JSON: ${path.relative(BASE_DIR, JSON_DIR)}
  - Logs: ${path.relative(BASE_DIR, LOG_DIR)}
  `;
  log('INFO', helpText, { basePath: BASE_DIR });
}

// Ensure base directories exist
async function ensureDirectories() {
  const dirs = [BIN_DIR, JSON_DIR, LOG_DIR];
  const forbiddenDirs = ['/etc', '/usr', '/var', '/bin', '/sbin', 'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)'];
  log('DEBUG', `Ensuring directories exist: ${dirs.map(dir => path.relative(BASE_DIR, dir)).join(', ')}`, { basePath: BASE_DIR });
  try {
    for (const dir of dirs) {
      if (forbiddenDirs.some(forbidden => path.resolve(dir).startsWith(path.resolve(forbidden)))) {
        log('ERROR', `Directory ${path.relative(BASE_DIR, dir)} is a system directory and cannot be created.`, { basePath: BASE_DIR });
        throw new Error('System directory access denied');
      }
      if (!path.resolve(dir).startsWith(path.resolve(BASE_DIR))) {
        log('ERROR', `Directory ${path.relative(BASE_DIR, dir)} is outside project root.`, { basePath: BASE_DIR });
        throw new Error('Directory outside project root');
      }
    }
    await Promise.all(
      dirs.map((dir) => fs.promises.mkdir(dir, { recursive: true }))
    );
    log('INFO', 'All required base directories are present.');
    log('DEBUG', `Successfully created/verified directories: ${dirs.map(dir => path.relative(BASE_DIR, dir)).join(', ')}`, { basePath: BASE_DIR });
  } catch (err) {
    log('ERROR', `Failed to create base directories: ${err.message}`, { basePath: BASE_DIR });
    if (params.verbose) log('DEBUG', `Directory creation error stack: ${err.stack}`, { basePath: BASE_DIR });
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const params = parseArgs(args);
  setupConsoleLogging(args, LOG_DIR); // Pass LOG_DIR to setupConsoleLogging
  log('DEBUG', `Starting main execution with args: ${args.join(', ')}`, { basePath: BASE_DIR });

  if (params.help) {
    displayHelp();
    return;
  }
  if (params.v || params.version) {
    log('INFO', 'Metadata Update, File Conversion, Resize, Rename, Sort, Cleanup & Media Generation Console App v1.0.0');
    return;
  }

  log('DEBUG', 'Ensuring directories');
  await ensureDirectories();

  async function mainMenu() {
    log('DEBUG', 'Prompting for initial selection');
    const initialResponse = await prompts({
      type: 'select',
      name: 'choice',
      message: 'Choose an option:',
      choices: [
        { title: 'Convert File Type', value: 'convertFileType' },
        { title: 'Rename Files', value: 'renameFiles' },
        { title: 'Sort Files', value: 'sortFiles' },
        { title: 'Cleanup Files', value: 'cleanupFiles' },
        { title: 'Resize Files', value: 'resizeFiles' },
        { title: 'Update Metadata', value: 'updateMetadata' },
        { title: 'Generate Images', value: 'generateImages' },
        { title: 'Generate Videos', value: 'generateVideos' },
        { title: 'Exit', value: 'exit' },
      ],
      initial: 0,
    });

    log('DEBUG', `User selected choice: ${initialResponse.choice}`);
    if (!initialResponse.choice || initialResponse.choice === 'exit') {
      log('INFO', 'Exiting application.');
      process.exit(0);
    }

    switch (initialResponse.choice) {
      case 'convertFileType':
        log('DEBUG', 'Entering convert menu');
        await convertMenu();
        break;
      case 'renameFiles':
        log('DEBUG', 'Starting rename files feature');
        const renameResult = await renameFiles();
        log('DEBUG', `Rename result: ${renameResult}`);
        if (renameResult === 'cancelled') log('INFO', 'Rename cancelled by user.');
        else if (renameResult === 'success') log('INFO', 'Rename completed successfully.');
        else log('INFO', 'Rename failed.');
        break;
      case 'sortFiles':
        log('DEBUG', 'Entering sort menu');
        await sortMenu();
        break;
      case 'cleanupFiles':
        log('DEBUG', 'Entering cleanup menu');
        await cleanupMenu();
        break;
      case 'resizeFiles':
        log('DEBUG', 'Entering resize menu');
        await resizeMenu();
        break;
      case 'updateMetadata':
        log('DEBUG', 'Entering metadata menu');
        await metadataMenu();
        break;
      case 'generateImages':
        log('DEBUG', 'Entering generate images menu');
        await generateImagesMenu();
        break;
      case 'generateVideos':
        log('DEBUG', 'Entering generate videos menu');
        await generateVideosMenu();
        break;
      default:
        log('WARN', `Invalid choice selected: ${initialResponse.choice}`);
        break;
    }

    log('DEBUG', 'Returning to main menu');
    await mainMenu();
  }

  async function metadataMenu() {
    log('DEBUG', 'Prompting for metadata update selection');
    const metadataResponse = await prompts({
      type: 'select',
      name: 'metadataType',
      message: 'Choose a metadata update type:',
      choices: [
        { title: 'Update GIF Metadata', value: 'gif' },
        { title: 'Update JPG Metadata', value: 'jpg' },
        { title: 'Update MP4 Metadata', value: 'mp4' },
        { title: 'Update PNG Metadata', value: 'png' },
        { title: 'Update WAV Metadata', value: 'wav' },
        { title: 'Update WebP Metadata', value: 'webp' },
        { title: 'Update WebM Metadata', value: 'webm' },
        { title: 'Back', value: 'back' },
      ],
      initial: 0,
    });

    log('DEBUG', `User selected metadata type: ${metadataResponse.metadataType}`);
    if (!metadataResponse.metadataType || metadataResponse.metadataType === 'back') {
      log('INFO', 'Returning to main menu.');
      return;
    }

    let result;
    switch (metadataResponse.metadataType) {
      case 'gif':
        log('DEBUG', 'Starting GIF metadata update');
        result = await updateGifMetadata();
        break;
      case 'jpg':
        log('DEBUG', 'Starting JPG metadata update');
        result = await updateJpgMetadata();
        break;
      case 'mp4':
        log('DEBUG', 'Starting MP4 metadata update');
        result = await updateMp4Metadata();
        break;
      case 'png':
        log('DEBUG', 'Starting PNG metadata update');
        result = await updatePngMetadata();
        break;
      case 'wav':
        log('DEBUG', 'Starting WAV metadata update');
        result = await updateWavMetadata();
        break;
      case 'webp':
        log('DEBUG', 'Starting WebP metadata update');
        result = await updateWebpMetadata();
        break;
      case 'webm':
        log('DEBUG', 'Starting WebM metadata update');
        result = await updateWebmMetadata();
        break;
      default:
        log('WARN', `Invalid metadata type selected: ${metadataResponse.metadataType}`);
        result = 'error';
        break;
    }

    log('DEBUG', `Metadata update result: ${result}`);
    if (result === 'cancelled') log('INFO', 'Metadata update cancelled by user.');
    else if (result === 'success') log('INFO', 'Metadata update completed successfully.');
    else log('INFO', 'Metadata update failed.');

    log('DEBUG', 'Returning to metadata menu');
    await metadataMenu();
  }

  async function convertMenu() {
    log('DEBUG', 'Prompting for conversion type selection');
    const convertResponse = await prompts({
      type: 'select',
      name: 'convertType',
      message: 'Choose a conversion type:',
      choices: [
        { title: 'Convert Videos', value: 'videos' },
        { title: 'Convert Video to Audio', value: 'audio' },
        { title: 'Convert Images', value: 'images' },
        { title: 'Back', value: 'back' },
      ],
      initial: 0,
    });

    log('DEBUG', `User selected convert type: ${convertResponse.convertType}`);
    if (!convertResponse.convertType || convertResponse.convertType === 'back') {
      log('INFO', 'Returning to main menu.');
      return;
    }

    if (convertResponse.convertType === 'videos') {
      log('DEBUG', 'Entering video convert menu');
      await videoConvertMenu();
    } else if (convertResponse.convertType === 'audio') {
      log('DEBUG', 'Entering audio convert menu');
      await audioConvertMenu();
    } else if (convertResponse.convertType === 'images') {
      log('DEBUG', 'Entering image convert menu');
      await imageConvertMenu();
    } else {
      log('WARN', `Invalid convert type selected: ${convertResponse.convertType}`);
    }

    log('DEBUG', 'Returning to convert menu');
    await convertMenu();
  }

  async function videoConvertMenu() {
    log('DEBUG', 'Prompting for video conversion selection');
    const videoResponse = await prompts({
      type: 'select',
      name: 'conversion',
      message: 'Choose a video conversion:',
      choices: [
        { title: 'GIF to MP4', value: 'gifToMp4' },
        { title: 'GIF to MOV', value: 'gifToMov' },
        { title: 'GIF to WebM', value: 'gifToWebm' },
        { title: 'MOV to GIF', value: 'movToGif' },
        { title: 'MOV to MP4', value: 'movToMp4' },
        { title: 'MOV to WebM', value: 'movToWebm' },
        { title: 'MP4 to GIF', value: 'mp4ToGif' },
        { title: 'MP4 to MOV', value: 'mp4ToMov' },
        { title: 'MP4 to WebM', value: 'mp4ToWebm' },
        { title: 'WebM to GIF', value: 'webmToGif' },
        { title: 'WebM to MOV', value: 'webmToMov' },
        { title: 'WebM to MP4', value: 'webmToMp4' },
        { title: 'Back', value: 'back' },
      ],
      initial: 0,
    });

    log('DEBUG', `User selected video conversion: ${videoResponse.conversion}`);
    if (!videoResponse.conversion || videoResponse.conversion === 'back') {
      log('INFO', 'Returning to conversion type menu.');
      return;
    }

    let result;
    switch (videoResponse.conversion) {
      case 'gifToMp4':
        log('DEBUG', 'Starting GIF to MP4 conversion');
        result = await convertGifToMp4();
        break;
      case 'gifToMov':
        log('DEBUG', 'Starting GIF to MOV conversion');
        result = await convertGifToMov();
        break;
      case 'gifToWebm':
        log('DEBUG', 'Starting GIF to WebM conversion');
        result = await convertGifToWebm();
        break;
      case 'movToGif':
        log('DEBUG', 'Starting MOV to GIF conversion');
        result = await convertMovToGif();
        break;
      case 'movToMp4':
        log('DEBUG', 'Starting MOV to MP4 conversion');
        result = await convertMovToMp4();
        break;
      case 'movToWebm':
        log('DEBUG', 'Starting MOV to WebM conversion');
        result = await convertMovToWebm();
        break;
      case 'mp4ToGif':
        log('DEBUG', 'Starting MP4 to GIF conversion');
        result = await convertMp4ToGif();
        break;
      case 'mp4ToMov':
        log('DEBUG', 'Starting MP4 to MOV conversion');
        result = await convertMp4ToMov();
        break;
      case 'mp4ToWebm':
        log('DEBUG', 'Starting MP4 to WebM conversion');
        result = await convertMp4ToWebm();
        break;
      case 'webmToGif':
        log('DEBUG', 'Starting WebM to GIF conversion');
        result = await convertWebmToGif();
        break;
      case 'webmToMov':
        log('DEBUG', 'Starting WebM to MOV conversion');
        result = await convertWebmToMov();
        break;
      case 'webmToMp4':
        log('DEBUG', 'Starting WebM to MP4 conversion');
        result = await convertWebmToMp4();
        break;
      default:
        log('WARN', `Invalid video conversion selected: ${videoResponse.conversion}`);
        result = 'error';
        break;
    }

    log('DEBUG', `Video conversion result: ${result}`);
    if (result === 'cancelled') log('INFO', 'Video conversion cancelled by user.');
    else if (result === 'success') log('INFO', 'Video conversion completed successfully.');
    else log('INFO', 'Video conversion failed.');

    log('DEBUG', 'Returning to video convert menu');
    await videoConvertMenu();
  }

  async function audioConvertMenu() {
    log('DEBUG', 'Prompting for audio conversion selection');
    const audioResponse = await prompts({
      type: 'select',
      name: 'conversion',
      message: 'Choose a video to audio conversion:',
      choices: [
        { title: 'GIF to MP3', value: 'gifToMp3' },
        { title: 'GIF to WAV', value: 'gifToWav' },
        { title: 'MOV to MP3', value: 'movToMp3' },
        { title: 'MOV to WAV', value: 'movToWav' },
        { title: 'MP4 to MP3', value: 'mp4ToMp3' },
        { title: 'MP4 to WAV', value: 'mp4ToWav' },
        { title: 'WebM to MP3', value: 'webmToMp3' },
        { title: 'WebM to WAV', value: 'webmToWav' },
        { title: 'Back', value: 'back' },
      ],
      initial: 0,
    });

    log('DEBUG', `User selected audio conversion: ${audioResponse.conversion}`);
    if (!audioResponse.conversion || audioResponse.conversion === 'back') {
      log('INFO', 'Returning to conversion type menu.');
      return;
    }

    let result;
    switch (audioResponse.conversion) {
      case 'gifToMp3':
        log('DEBUG', 'Starting GIF to MP3 conversion');
        result = await convertGifToMp3();
        break;
      case 'gifToWav':
        log('DEBUG', 'Starting GIF to WAV conversion');
        result = await convertGifToWav();
        break;
      case 'movToMp3':
        log('DEBUG', 'Starting MOV to MP3 conversion');
        result = await convertMovToMp3();
        break;
      case 'movToWav':
        log('DEBUG', 'Starting MOV to WAV conversion');
        result = await convertMovToWav();
        break;
      case 'mp4ToMp3':
        log('DEBUG', 'Starting MP4 to MP3 conversion');
        result = await convertMp4ToMp3();
        break;
      case 'mp4ToWav':
        log('DEBUG', 'Starting MP4 to WAV conversion');
        result = await convertMp4ToWav();
        break;
      case 'webmToMp3':
        log('DEBUG', 'Starting WebM to MP3 conversion');
        result = await convertWebmToMp3();
        break;
      case 'webmToWav':
        log('DEBUG', 'Starting WebM to WAV conversion');
        result = await convertWebmToWav();
        break;
      default:
        log('WARN', `Invalid audio conversion selected: ${audioResponse.conversion}`);
        result = 'error';
        break;
    }

    log('DEBUG', `Audio conversion result: ${result}`);
    if (result === 'cancelled') log('INFO', 'Audio conversion cancelled by user.');
    else if (result === 'success') log('INFO', 'Audio conversion completed successfully.');
    else log('INFO', 'Audio conversion failed.');

    log('DEBUG', 'Returning to audio convert menu');
    await audioConvertMenu();
  }

  async function imageConvertMenu() {
    log('DEBUG', 'Prompting for image conversion selection');
    const imageResponse = await prompts({
      type: 'select',
      name: 'conversion',
      message: 'Choose an image conversion:',
      choices: [
        { title: 'JPG to PNG', value: 'jpgToPng' },
        { title: 'JPG to WebP', value: 'jpgToWebp' },
        { title: 'PNG to JPG', value: 'pngToJpg' },
        { title: 'PNG to WebP', value: 'pngToWebp' },
        { title: 'WebP to JPG', value: 'webpToJpg' },
        { title: 'WebP to PNG', value: 'webpToPng' },
        { title: 'Back', value: 'back' },
      ],
      initial: 0,
    });

    log('DEBUG', `User selected image conversion: ${imageResponse.conversion}`);
    if (!imageResponse.conversion || imageResponse.conversion === 'back') {
      log('INFO', 'Returning to conversion type menu.');
      return;
    }

    let result;
    switch (imageResponse.conversion) {
      case 'jpgToPng':
        log('DEBUG', 'Starting JPG to PNG conversion');
        result = await convertJpgToPng();
        break;
      case 'jpgToWebp':
        log('DEBUG', 'Starting JPG to WebP conversion');
        result = await convertJpgToWebp();
        break;
      case 'pngToJpg':
        log('DEBUG', 'Starting PNG to JPG conversion');
        result = await convertPngToJpg();
        break;
      case 'pngToWebp':
        log('DEBUG', 'Starting PNG to WebP conversion');
        result = await convertPngToWebp();
        break;
      case 'webpToJpg':
        log('DEBUG', 'Starting WebP to JPG conversion');
        result = await convertWebpToJpg();
        break;
      case 'webpToPng':
        log('DEBUG', 'Starting WebP to PNG conversion');
        result = await convertWebpToPng();
        break;
      default:
        log('WARN', `Invalid image conversion selected: ${imageResponse.conversion}`);
        result = 'error';
        break;
    }

    log('DEBUG', `Image conversion result: ${result}`);
    if (result === 'cancelled') log('INFO', 'Image conversion cancelled by user.');
    else if (result === 'success') log('INFO', 'Image conversion completed successfully.');
    else log('INFO', 'Image conversion failed.');

    log('DEBUG', 'Returning to image convert menu');
    await imageConvertMenu();
  }

  async function resizeMenu() {
    log('DEBUG', 'Prompting for resize type selection');
    const resizeResponse = await prompts({
      type: 'select',
      name: 'resizeType',
      message: 'Choose a resize type:',
      choices: [
        { title: 'Resize Images', value: 'images' },
        { title: 'Resize Videos', value: 'videos' },
        { title: 'Back', value: 'back' },
      ],
      initial: 0,
    });

    log('DEBUG', `User selected resize type: ${resizeResponse.resizeType}`);
    if (!resizeResponse.resizeType || resizeResponse.resizeType === 'back') {
      log('INFO', 'Returning to main menu.');
      return;
    }

    let result;
    switch (resizeResponse.resizeType) {
      case 'images':
        log('INFO', 'Starting Resize Images Feature');
        result = await resizeImages();
        break;
      case 'videos':
        log('INFO', 'Starting Resize Videos Feature');
        result = await resizeVideos();
        break;
      default:
        log('WARN', `Invalid resize type selected: ${resizeResponse.resizeType}`);
        result = 'error';
        break;
    }

    log('DEBUG', `Resize result: ${result}`);
    if (result === 'cancelled') log('INFO', 'Resize cancelled by user.');
    else if (result === 'success') log('INFO', 'Resize completed successfully.');
    else log('INFO', 'Resize failed.');

    log('DEBUG', 'Returning to resize menu');
    await resizeMenu();
  }

  async function sortMenu() {
    log('DEBUG', 'Prompting for sort type selection');
    const sortResponse = await prompts({
      type: 'select',
      name: 'sortType',
      message: 'Choose a sort type:',
      choices: [
        { title: 'Sort Files By Extension', value: 'byExtension' },
        { title: 'Sort Files By Type (Video & Images)', value: 'byType' },
        { title: 'Back', value: 'back' },
      ],
      initial: 0,
    });

    log('DEBUG', `User selected sort type: ${sortResponse.sortType}`);
    if (!sortResponse.sortType || sortResponse.sortType === 'back') {
      log('INFO', 'Returning to main menu.');
      return;
    }

    let result;
    switch (sortResponse.sortType) {
      case 'byExtension':
        log('INFO', 'Starting Sort Files By Extension Feature');
        result = await sortFilesByExtension();
        break;
      case 'byType':
        log('INFO', 'Starting Sort Files By Type Feature');
        result = await sortFilesByType();
        break;
      default:
        log('WARN', `Invalid sort type selected: ${sortResponse.sortType}`);
        result = 'error';
        break;
    }

    log('DEBUG', `Sort result: ${result}`);
    if (result === 'cancelled') log('INFO', 'Sort cancelled by user.');
    else if (result === 'success') log('INFO', 'Sort completed successfully.');
    else log('INFO', 'Sort failed.');

    log('DEBUG', 'Returning to sort menu');
    await sortMenu();
  }

  async function cleanupMenu() {
    log('DEBUG', 'Prompting for cleanup type selection');
    const cleanupResponse = await prompts({
      type: 'select',
      name: 'cleanupType',
      message: 'Choose a cleanup type:',
      choices: [
        { title: 'Find Duplicate Images', value: 'findDuplicateImages' },
        { title: 'Find Duplicate Videos', value: 'findDuplicateVideos' },
        { title: 'Back', value: 'back' },
      ],
      initial: 0,
    });

    log('DEBUG', `User selected cleanup type: ${cleanupResponse.cleanupType}`);
    if (!cleanupResponse.cleanupType || cleanupResponse.cleanupType === 'back') {
      log('INFO', 'Returning to main menu.');
      return;
    }

    let result;
    switch (cleanupResponse.cleanupType) {
      case 'findDuplicateImages':
        log('INFO', 'Starting Find Duplicate Images Feature');
        result = await findDuplicateImages();
        break;
      case 'findDuplicateVideos':
        log('INFO', 'Starting Find Duplicate Videos Feature');
        result = await findDuplicateVideos();
        break;
      default:
        log('WARN', `Invalid cleanup type selected: ${cleanupResponse.cleanupType}`);
        result = 'error';
        break;
    }

    log('DEBUG', `Cleanup result: ${result}`);
    if (result === 'cancelled') log('INFO', 'Cleanup cancelled by user.');
    else if (result === 'success') log('INFO', 'Cleanup completed successfully.');
    else log('INFO', 'Cleanup failed.');

    log('DEBUG', 'Returning to cleanup menu');
    await cleanupMenu();
  }

  async function generateImagesMenu() {
    log('DEBUG', 'Prompting for image generation selection');
    const generateResponse = await prompts({
      type: 'select',
      name: 'generateType',
      message: 'Choose an image generation type:',
      choices: [
        { title: 'Generate Dalle Image', value: 'dalle' },
        { title: 'Generate Ideogram Image', value: 'ideogram' },
        { title: 'Generate Grok Image', value: 'grok' },
        { title: 'Back', value: 'back' },
      ],
      initial: 0,
    });

    log('DEBUG', `User selected generate type: ${generateResponse.generateType}`);
    if (!generateResponse.generateType || generateResponse.generateType === 'back') {
      log('INFO', 'Returning to main menu.');
      return;
    }

    let result;
    switch (generateResponse.generateType) {
      case 'dalle':
        log('DEBUG', 'Starting Dalle image generation');
        result = await generateDalleImage();
        break;
      case 'ideogram':
        log('DEBUG', 'Starting Ideogram image generation');
        result = await generateIdeogramImage();
        break;
      case 'grok':
        log('DEBUG', 'Starting Grok image generation');
        result = await generateGrokImage();
        break;
      default:
        log('WARN', `Invalid generate type selected: ${generateResponse.generateType}`);
        result = 'error';
        break;
    }

    log('DEBUG', `Image generation result: ${result}`);
    if (result === 'cancelled') log('INFO', 'Image generation cancelled by user.');
    else if (result === 'success') log('INFO', 'Image generation completed successfully.');
    else log('INFO', 'Image generation failed.');

    log('DEBUG', 'Returning to generate images menu');
    await generateImagesMenu();
  }

  async function generateVideosMenu() {
    log('DEBUG', 'Prompting for video generation selection');
    const generateResponse = await prompts({
      type: 'select',
      name: 'generateType',
      message: 'Choose a video generation type:',
      choices: [
        { title: 'Back', value: 'back' },
      ],
      initial: 0,
    });

    log('DEBUG', `User selected generate type: ${generateResponse.generateType}`);
    if (!generateResponse.generateType || generateResponse.generateType === 'back') {
      log('INFO', 'Returning to main menu.');
      return;
    }

    log('WARN', `Invalid generate type selected: ${generateResponse.generateType}`);
    const result = 'error';
    log('DEBUG', `Video generation result: ${result}`);
    log('INFO', 'Video generation failed.');
    log('DEBUG', 'Returning to generate videos menu');
    await generateVideosMenu();
  }

  log('DEBUG', 'Launching main menu');
  await mainMenu();
}

if (require.main === module) {
  let params = {};
  main().catch(err => {
    log('ERROR', `Unexpected error in main: ${err.message}`, { basePath: BASE_DIR });
    if (params.verbose) log('DEBUG', `Main error stack: ${err.stack}`, { basePath: BASE_DIR });
    process.exit(1);
  });
}