#!/usr/bin/env node

const prompts = require('prompts');
const path = require('path');
const fs = require('fs');
const { log, setupConsoleLogging } = require('./backend/logging/logUtils');
const { updateMetadata } = require('./feature/metaDataUpdater');
const { resizeImages } = require('./feature/imageResizer');
const { sortFilesByExtension } = require('./feature/fileSorter');
const { renameFiles } = require('./feature/fileRenamer');
const { convertFiles } = require('./feature/fileConverter');

// Configuration
const BASE_DIR = path.join(__dirname, '..');
const BIN_DIR = path.join(BASE_DIR, 'bin');
const IMG_DIR = path.join(BIN_DIR, 'img');
const VID_DIR = path.join(BIN_DIR, 'vid');
const CSV_DIR = path.join(BIN_DIR, 'csv');
const JSON_DIR = path.join(BASE_DIR, 'json');
const LOG_DIR = path.join(BASE_DIR, 'logs');
const UPDATED_METADATA_BASE_DIR = path.join(BIN_DIR, 'updated-metadata');
const RESIZED_BASE_DIR = path.join(BIN_DIR, 'resized-images');
const SORTED_BASE_DIR = path.join(BIN_DIR, 'file-sorter');
const CONVERTED_BASE_DIR = path.join(BIN_DIR, 'converted-files');

// Help message
function displayHelp() {
  const helpText = `
main.js - File manipulation console application.

Usage:
  node main.js [--help]

Options:
  --help  Display this help and exit
  -v, --version  Display version and exit

Features:
  - Meta Data Updater: Update metadata for files or folders (GIF, JPEG, MP4, PNG, WebP).
  - Image Resizer: Resize images to specified dimensions (supports files or folders).
  - File Sorter: Sort files in a directory by extension into subfolders (e.g., organized/png, organized/jpg).
  - File Renaming: Tools for renaming files (e.g., File Renamer).
  - File Converter: Convert file types (e.g., PNG to WebP, JPG to PNG) for a single file or directory.

Directories:
  - Bin: ${BIN_DIR}
  - Images: ${IMG_DIR}
  - Videos: ${VID_DIR}
  - CSV: ${CSV_DIR}
  - JSON: ${JSON_DIR}
  - Logs: ${LOG_DIR}
  - Updated Metadata: ${UPDATED_METADATA_BASE_DIR}/<timestamp>/{successful,failed}/{gif,jpeg,mp4,png,webp}
  - Resized Images: ${RESIZED_BASE_DIR}/<timestamp>
  - Sorted Files: ${SORTED_BASE_DIR}/<timestamp>/<input-folder-name>/organized
  - Converted Files: ${CONVERTED_BASE_DIR}/<timestamp>
  `;
  log('INFO', helpText);
  process.exit(0);
}

// Ensure base directories exist
async function ensureDirectories() {
  const dirs = [
    BIN_DIR,
    IMG_DIR,
    VID_DIR,
    CSV_DIR,
    JSON_DIR,
    LOG_DIR,
    UPDATED_METADATA_BASE_DIR,
    RESIZED_BASE_DIR,
    SORTED_BASE_DIR,
    CONVERTED_BASE_DIR,
  ];
  try {
    await Promise.all(
      dirs.map((dir) => fs.promises.mkdir(dir, { recursive: true }))
    );
    log('INFO', 'All required base directories are present.');
  } catch (err) {
    log('ERROR', `Failed to create base directories: ${err.message}`);
  }
}

// Generate a unique output directory for each feature run
function generateRunDir(baseDir) {
  const timestamp = new Date().toISOString().replace(/[-:.T]/g, '').slice(0, 14); // e.g., 20250310123456
  const runDir = path.join(baseDir, timestamp);
  try {
    fs.mkdirSync(runDir, { recursive: true });
    log('INFO', `Created output directory: ${runDir}`);
  } catch (err) {
    log('ERROR', `Failed to create output directory ${runDir}: ${err.message}`);
  }
  return runDir;
}

// Prompt for metadata with explicit back option
async function promptForMetadata() {
  const questions = [
    {
      type: 'text',
      name: 'title',
      message: 'Enter the title for the metadata (or press Enter to go back):',
      initial: 'Default Title',
      validate: (value) => (value.trim() !== '' ? true : 'back'),
    },
    {
      type: (prev) => (prev !== 'back' ? 'text' : null),
      name: 'description',
      message: 'Enter the description for the metadata (or press Enter to go back):',
      initial: 'Default description',
      validate: (value) => (value.trim() !== '' ? true : 'back'),
    },
    {
      type: (prev) => (prev !== 'back' ? 'text' : null),
      name: 'keywords',
      message: 'Enter keywords (comma-separated, or press Enter to go back):',
      initial: 'default, keywords',
      validate: (value) => (value.trim() !== '' ? true : 'back'),
    },
    {
      type: (prev) => (prev !== 'back' ? 'text' : null),
      name: 'copyright',
      message: 'Enter copyright notice (or press Enter to go back):',
      initial: '© 2025 YourName',
      validate: (value) => (value.trim() !== '' ? true : 'back'),
    },
    {
      type: (prev) => (prev !== 'back' ? 'text' : null),
      name: 'genre',
      message: 'Enter genre (or press Enter to go back):',
      initial: 'General',
      validate: (value) => (value.trim() !== '' ? true : 'back'),
    },
    {
      type: (prev) => (prev !== 'back' ? 'text' : null),
      name: 'comment',
      message: 'Enter comment (or press Enter to go back):',
      initial: 'Default comment',
      validate: (value) => (value.trim() !== '' ? true : 'back'),
    },
  ];

  const response = await prompts(questions, {
    onCancel: () => ({ title: 'back' }),
  });
  if (response.title === 'back' || Object.values(response).some((val) => val === 'back')) {
    log('INFO', 'Metadata input cancelled, returning to menu.');
    return null;
  }
  return response;
}

// Main execution
(async () => {
  try {
    setupConsoleLogging();
    log('DEBUG', 'Starting main execution');

    const args = process.argv.slice(2);
    if (args.includes('--help')) return displayHelp();
    if (args.includes('-v') || args.includes('--version')) {
      log('INFO', 'File Manipulation App v1.0.0');
      process.exit(0);
    }

    log('DEBUG', 'Ensuring directories');
    await ensureDirectories();

    while (true) {
      log('DEBUG', 'Prompting for initial selection');
      const initialResponse = await prompts({
        type: 'select',
        name: 'choice',
        message: 'Choose an option:',
        choices: [
          { title: 'Meta Data Updater', value: 'metadata' },
          { title: 'Image Resizer', value: 'resizer' },
          { title: 'File Sorter', value: 'sorter' },
          { title: 'File Renaming', value: 'renaming' },
          { title: 'File Converter', value: 'converter' },
          { title: 'Exit', value: 'exit' },
        ],
        initial: 0,
      });

      if (!initialResponse.choice || initialResponse.choice === 'exit') {
        log('INFO', 'Exiting application.');
        process.exit(0);
      }

      if (initialResponse.choice === 'metadata') {
        log('DEBUG', 'Prompting for file or folder path (Metadata Updater)');
        const pathResponse = await prompts({
          type: 'text',
          name: 'path',
          message: 'Enter the path to a file or folder for metadata update (or press Enter to go back):',
          validate: (value) => {
            if (value.trim() === '') return true; // Empty input goes back
            return fs.existsSync(value) ? true : 'Path not found. Please enter a valid path.';
          },
        });

        if (!pathResponse.path || pathResponse.path.trim() === '') {
          log('INFO', 'No path provided, returning to menu.');
          continue;
        }

        const inputPath = path.resolve(pathResponse.path);
        const isDirectory = fs.statSync(inputPath).isDirectory();
        const metadata = await promptForMetadata();

        if (!metadata) continue;

        const outputDir = generateRunDir(UPDATED_METADATA_BASE_DIR);
        const successfulDir = path.join(outputDir, 'successful');
        const failedDir = path.join(outputDir, 'failed');
        const types = ['gif', 'jpeg', 'mp4', 'png', 'webp'];
        try {
          await Promise.all([
            ...types.map((type) => fs.promises.mkdir(path.join(successfulDir, type), { recursive: true })),
            ...types.map((type) => fs.promises.mkdir(path.join(failedDir, type), { recursive: true })),
          ]);

          log('INFO', `Updating metadata for ${isDirectory ? 'folder' : 'file'}: ${inputPath}`);
          const result = await updateMetadata(inputPath, isDirectory, metadata, successfulDir, failedDir);

          log('INFO', 'Metadata update completed.');
          if (result.skipped.length > 0) {
            log('INFO', 'Skipped files (unsupported extensions):');
            result.skipped.forEach((file) => log('INFO', `  - ${file}`));
          }
          log('INFO', `Output stored in: ${outputDir}`);
        } catch (err) {
          log('ERROR', `Metadata update failed: ${err.message}`);
          log('INFO', `Partial output (if any) stored in: ${outputDir}`);
        }
      } else if (initialResponse.choice === 'resizer') {
        log('DEBUG', 'Prompting for file or folder path (Image Resizer)');
        const pathResponse = await prompts({
          type: 'text',
          name: 'path',
          message: 'Enter the path to a file or folder to resize (or press Enter to go back):',
          validate: (value) => {
            if (value.trim() === '') return true; // Empty input goes back
            return fs.existsSync(value) ? true : 'Path not found. Please enter a valid path.';
          },
        });

        if (!pathResponse.path || pathResponse.path.trim() === '') {
          log('INFO', 'No path provided, returning to menu.');
          continue;
        }

        const inputPath = path.resolve(pathResponse.path);
        const isDirectory = fs.statSync(inputPath).isDirectory();
        const outputDir = generateRunDir(RESIZED_BASE_DIR);

        try {
          log('INFO', `Resizing ${isDirectory ? 'folder' : 'file'}: ${inputPath}`);
          const result = await resizeImages(inputPath, isDirectory, outputDir);

          log('INFO', 'Image resizing completed.');
          if (result.skipped.length > 0) {
            log('INFO', 'Skipped files (unsupported extensions):');
            result.skipped.forEach((file) => log('INFO', `  - ${file}`));
          }
          if (result.failed.length > 0) {
            log('INFO', 'Failed files (processing errors):');
            result.failed.forEach(({ file, reason }) => log('INFO', `  - ${file}: ${reason}`));
          }
          log('INFO', `Output stored in: ${outputDir}`);
        } catch (err) {
          log('ERROR', `Image resizing failed: ${err.message}`);
          log('INFO', `Partial output (if any) stored in: ${outputDir}`);
        }
      } else if (initialResponse.choice === 'sorter') {
        log('DEBUG', 'Prompting for directory path (File Sorter)');
        const pathResponse = await prompts({
          type: 'text',
          name: 'path',
          message: 'Enter the directory path to sort files by extension (or press Enter to go back):',
          validate: (value) => {
            if (value.trim() === '') return true; // Empty input goes back
            return fs.existsSync(value) && fs.statSync(value).isDirectory()
              ? true
              : 'Path must be a valid directory. Please enter a valid path.';
          },
        });

        if (!pathResponse.path || pathResponse.path.trim() === '') {
          log('INFO', 'No path provided, returning to menu.');
          continue;
        }

        const inputDir = path.resolve(pathResponse.path);
        const inputFolderName = path.basename(inputDir);
        const runDir = generateRunDir(SORTED_BASE_DIR);
        const outputDir = path.join(runDir, inputFolderName, 'organized');
        try {
          await fs.promises.mkdir(outputDir, { recursive: true });

          log('INFO', `Sorting files from directory: ${inputDir}`);
          const result = await sortFilesByExtension(inputDir, outputDir);

          log('INFO', 'File sorting completed.');
          if (result.skipped.length > 0) {
            log('INFO', 'Skipped files (unsupported extensions):');
            result.skipped.forEach((file) => log('INFO', `  - ${file}`));
          }
          log('INFO', `Output stored in: ${outputDir}`);
        } catch (err) {
          log('ERROR', `File sorting failed: ${err.message}`);
          log('INFO', `Partial output (if any) stored in: ${outputDir}`);
        }
      } else if (initialResponse.choice === 'renaming') {
        log('DEBUG', 'Prompting for File Renaming Tools selection');
        const toolResponse = await prompts({
          type: 'select',
          name: 'tool',
          message: 'Choose a File Renaming Tool:',
          choices: [
            { title: 'File Renamer', value: 'renamer' },
            { title: 'Back', value: 'back' },
          ],
          initial: 0,
        });

        if (!toolResponse.tool || toolResponse.tool === 'back') {
          log('INFO', 'Returning to main menu.');
          continue;
        }

        if (toolResponse.tool === 'renamer') {
          log('DEBUG', 'Prompting for directory and base filename (File Renamer)');
          const renameResponse = await prompts([
            {
              type: 'text',
              name: 'dir',
              message: 'Enter the directory path to rename files (or press Enter to go back):',
              validate: (value) => {
                if (value.trim() === '') return true; // Empty input goes back
                return fs.existsSync(value) && fs.statSync(value).isDirectory()
                  ? true
                  : 'Path must be a valid directory. Please enter a valid path.';
              },
            },
            {
              type: (prev) => (prev && prev.trim() !== '' ? 'text' : null),
              name: 'baseName',
              message: 'Enter the base filename (e.g., "image" for image-1.jpg, or press Enter to go back):',
              validate: (value) => (value.trim() !== '' ? true : 'back'),
            },
          ]);

          if (!renameResponse.dir || renameResponse.dir.trim() === '' || renameResponse.baseName === 'back') {
            log('INFO', 'No directory or base name provided, returning to menu.');
            continue;
          }

          const inputDir = path.resolve(renameResponse.dir);
          const baseName = renameResponse.baseName;

          try {
            log('INFO', `Renaming files in directory: ${inputDir} with base name: ${baseName}`);
            const result = await renameFiles(inputDir, baseName);

            log('INFO', 'File renaming completed.');
            if (result.failed.length > 0) {
              log('INFO', 'Failed files:');
              result.failed.forEach(({ file, reason }) => log('INFO', `  - ${file}: ${reason}`));
            }
            log('INFO', `Output stored in: ${inputDir}`);
          } catch (err) {
            log('ERROR', `File renaming failed: ${err.message}`);
            log('INFO', `Partial output (if any) stored in: ${inputDir}`);
          }
        }
      } else if (initialResponse.choice === 'converter') {
        log('DEBUG', 'Prompting for conversion type (File Converter)');
        const conversionResponse = await prompts({
          type: 'select',
          name: 'conversionType',
          message: 'Choose conversion type:',
          choices: [
            { title: 'PNG to WebP', value: 'pngToWebp' },
            { title: 'PNG to JPG', value: 'pngToJpg' },
            { title: 'JPG to WebP', value: 'jpgToWebp' },
            { title: 'JPG to PNG', value: 'jpgToPng' },
            { title: 'WebP to PNG', value: 'webpToPng' },
            { title: 'WebP to JPG', value: 'webpToJpg' },
            { title: 'WebM to GIF', value: 'webmToGif' },
            { title: 'WebM to MP4', value: 'webmToMp4' },
            { title: 'GIF to MP4', value: 'gifToMp4' },
            { title: 'GIF to WebM', value: 'gifToWebm' },
            { title: 'MP4 to WebM', value: 'mp4ToWebm' },
            { title: 'MP4 to GIF', value: 'mp4ToGif' },
            { title: 'Back', value: 'back' },
          ],
          initial: 0,
        });

        if (!conversionResponse.conversionType || conversionResponse.conversionType === 'back') {
          log('INFO', 'No conversion type provided, returning to menu.');
          continue;
        }

        const conversionType = conversionResponse.conversionType;

        log('DEBUG', 'Prompting for conversion scope (single file or directory)');
        const scopeResponse = await prompts({
          type: 'select',
          name: 'scope',
          message: 'Convert a single file or a directory?',
          choices: [
            { title: 'Single File', value: 'file' },
            { title: 'Directory', value: 'directory' },
            { title: 'Back', value: 'back' },
          ],
          initial: 0,
        });

        if (!scopeResponse.scope || scopeResponse.scope === 'back') {
          log('INFO', 'No scope provided, returning to previous menu.');
          continue;
        }

        const scopePrompt = scopeResponse.scope === 'file' 
          ? {
              type: 'text',
              name: 'path',
              message: `Enter the file path to convert to ${conversionType.split('To')[1]} (or press Enter to go back):`,
              validate: (value) => {
                if (value.trim() === '') return true; // Empty input goes back
                return fs.existsSync(value) && fs.statSync(value).isFile()
                  ? true
                  : 'Path must be a valid file. Please enter a valid path.';
              },
            }
          : {
              type: 'text',
              name: 'path',
              message: `Enter the directory path to convert files to ${conversionType.split('To')[1]} (or press Enter to go back):`,
              validate: (value) => {
                if (value.trim() === '') return true; // Empty input goes back
                return fs.existsSync(value) && fs.statSync(value).isDirectory()
                  ? true
                  : 'Path must be a valid directory. Please enter a valid path.';
              },
            };

        const pathResponse = await prompts(scopePrompt);

        if (!pathResponse.path || pathResponse.path.trim() === '') {
          log('INFO', 'No path provided, returning to previous menu.');
          continue;
        }

        const inputPath = path.resolve(pathResponse.path);
        const isDirectory = scopeResponse.scope === 'directory';
        const outputDir = generateRunDir(CONVERTED_BASE_DIR);

        try {
          log('INFO', `Converting ${isDirectory ? 'directory' : 'file'} at ${inputPath} to ${conversionType}`);
          const result = await convertFiles(inputPath, conversionType, isDirectory, outputDir);

          log('INFO', 'File conversion completed.');
          if (result.failed.length > 0) {
            log('INFO', 'Failed files:');
            result.failed.forEach(({ file, reason }) => log('INFO', `  - ${file}: ${reason}`));
          }
          log('INFO', `Output stored in: ${outputDir}`);
        } catch (err) {
          log('ERROR', `File conversion failed: ${err.message}`);
          log('INFO', `Partial output (if any) stored in: ${outputDir}`);
        }
      }

      log('INFO', 'Task completed. Returning to menu.');
    }
  } catch (err) {
    log('ERROR', `Unexpected error in main execution: ${err.message}`);
    log('INFO', 'Continuing to main menu despite error.');
  }
})();