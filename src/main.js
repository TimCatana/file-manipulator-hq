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
// Convert File Type Imports
const { convertGifToMp4 } = require('./feature/convert-file-type/convert-videos/convertGifToMp4');
const { convertGifToWebm } = require('./feature/convert-file-type/convert-videos/convertGifToWebm');
const { convertMp4ToGif } = require('./feature/convert-file-type/convert-videos/convertMp4ToGif');
const { convertMp4ToWebm } = require('./feature/convert-file-type/convert-videos/convertMp4ToWebm');
const { convertWebmToGif } = require('./feature/convert-file-type/convert-videos/convertWebmToGif');
const { convertWebmToMp4 } = require('./feature/convert-file-type/convert-videos/convertWebmToMp4');
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

// Configuration
const BASE_DIR = path.join(__dirname, '..');
const BIN_DIR = path.join(BASE_DIR, 'bin');
const JSON_DIR = path.join(BASE_DIR, 'json');
const LOG_DIR = path.join(BASE_DIR, 'logs');

// Help message
function displayHelp() {
  const helpText = `
main.js - Metadata Update, File Conversion, Resize, Rename, Sort & Image Generation Console Application

Usage:
  node src/main.js [--help] [--verbose]

Options:
  --help        Display this help and exit
  -v, --version Display version and exit
  --verbose     Enable verbose logging

Features:
  - Update Metadata: GIF, JPG, MP4, PNG, WAV, WebP
  - Convert File Type:
    - Videos: GIF to MP4/WebM, MP4 to GIF/WebM, WebM to GIF/MP4
    - Images: JPG to PNG/WebP, PNG to JPG/WebP, WebP to JPG/PNG
  - Resize Files: Images, Videos
  - Rename Files
  - Sort Files:
    - Sort Files By Extension
    - Sort Files By Type (Video & Images)
  - Generate Images:
    - Generate Dalle Image
    - Generate Ideogram Image
    - Generate Midjourney Image

Directories:
  - Bin: ${BIN_DIR}
  - JSON: ${JSON_DIR}
  - Logs: ${LOG_DIR}
  `;
  log('INFO', helpText);
}

// Ensure base directories exist
async function ensureDirectories() {
  const dirs = [BIN_DIR, JSON_DIR, LOG_DIR];
  log('DEBUG', `Ensuring directories exist: ${dirs.join(', ')}`);
  try {
    await Promise.all(
      dirs.map((dir) => fs.promises.mkdir(dir, { recursive: true }))
    );
    log('INFO', 'All required base directories are present.');
    log('DEBUG', `Successfully created/verified directories: ${dirs.join(', ')}`);
  } catch (err) {
    log('ERROR', `Failed to create base directories: ${err.message}`);
    log('DEBUG', `Directory creation error stack: ${err.stack}`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  setupConsoleLogging(args, LOG_DIR); // Pass LOG_DIR to setupConsoleLogging
  log('DEBUG', `Starting main execution with args: ${args.join(', ')}`);

  if (args.includes('--help')) {
    displayHelp();
    return;
  }
  if (args.includes('-v') || args.includes('--version')) {
    log('INFO', 'Metadata Update, File Conversion, Resize, Rename & Sort Console App v1.0.0');
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
        { title: 'Update Metadata', value: 'updateMetadata' },
        { title: 'Convert File Type', value: 'convertFileType' },
        { title: 'Resize Files', value: 'resizeFiles' },
        { title: 'Rename Files', value: 'renameFiles' },
        { title: 'Sort Files', value: 'sortFiles' },
        { title: 'Generate Images', value: 'generateImages' },
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
      case 'updateMetadata':
        log('DEBUG', 'Entering metadata menu');
        await metadataMenu();
        break;
      case 'convertFileType':
        log('DEBUG', 'Entering convert menu');
        await convertMenu();
        break;
      case 'resizeFiles':
        log('DEBUG', 'Entering resize menu');
        await resizeMenu();
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
      case 'generateImages':
        log('DEBUG', 'Entering generate images menu');
        await generateImagesMenu();
        break;
      default:
        log('WARN', `Unknown choice selected: ${initialResponse.choice}`);
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
      default:
        log('WARN', `Invalid metadata type selected: ${metadataResponse.metadataType}`);
        result = 'error';
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
    } else if (convertResponse.convertType === 'images') {
      log('DEBUG', 'Entering image convert menu');
      await imageConvertMenu();
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
        { title: 'GIF to WebM', value: 'gifToWebm' },
        { title: 'MP4 to GIF', value: 'mp4ToGif' },
        { title: 'MP4 to WebM', value: 'mp4ToWebm' },
        { title: 'WebM to GIF', value: 'webmToGif' },
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
      case 'gifToWebm':
        log('DEBUG', 'Starting GIF to WebM conversion');
        result = await convertGifToWebm();
        break;
      case 'mp4ToGif':
        log('DEBUG', 'Starting MP4 to GIF conversion');
        result = await convertMp4ToGif();
        break;
      case 'mp4ToWebm':
        log('DEBUG', 'Starting MP4 to WebM conversion');
        result = await convertMp4ToWebm();
        break;
      case 'webmToGif':
        log('DEBUG', 'Starting WebM to GIF conversion');
        result = await convertWebmToGif();
        break;
      case 'webmToMp4':
        log('DEBUG', 'Starting WebM to MP4 conversion');
        result = await convertWebmToMp4();
        break;
      default:
        log('WARN', `Invalid video conversion selected: ${videoResponse.conversion}`);
        result = 'error';
    }

    log('DEBUG', `Video conversion result: ${result}`);
    if (result === 'cancelled') log('INFO', 'Video conversion cancelled by user.');
    else if (result === 'success') log('INFO', 'Video conversion completed successfully.');
    else log('INFO', 'Video conversion failed.');

    log('DEBUG', 'Returning to video convert menu');
    await videoConvertMenu();
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
    }

    log('DEBUG', `Sort result: ${result}`);
    if (result === 'cancelled') log('INFO', 'Sort cancelled by user.');
    else if (result === 'success') log('INFO', 'Sort completed successfully.');
    else log('INFO', 'Sort failed.');

    log('DEBUG', 'Returning to sort menu');
    await sortMenu();
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
    }

    log('DEBUG', `Image generation result: ${result}`);
    if (result === 'cancelled') log('INFO', 'Image generation cancelled by user.');
    else if (result === 'success') log('INFO', 'Image generation completed successfully.');
    else log('INFO', 'Image generation failed.');

    log('DEBUG', 'Returning to generate images menu');
    await generateImagesMenu();
  }

  log('DEBUG', 'Launching main menu');
  await mainMenu();
}

if (require.main === module) {
  main().catch(err => {
    log('ERROR', `Unexpected error in main: ${err.message}`);
    log('DEBUG', `Main error stack: ${err.stack}`);
    process.exit(1);
  });
}