#!/usr/bin/env node

const prompts = require('prompts');
const path = require('path');
const fs = require('fs');
const { log, setupConsoleLogging } = require('./backend/logging/logUtils');
const { updateMetadata } = require('./feature/metaDataUpdater');

// Configuration
const BASE_DIR = path.join(__dirname, '..'); // One level up from main.js
const BIN_DIR = path.join(BASE_DIR, 'bin');
const IMG_DIR = path.join(BIN_DIR, 'img');
const VID_DIR = path.join(BIN_DIR, 'vid');
const CSV_DIR = path.join(BIN_DIR, 'csv');
const JSON_DIR = path.join(BASE_DIR, 'json');
const LOG_DIR = path.join(BASE_DIR, 'logs');
const UPDATED_METADATA_DIR = path.join(BIN_DIR, 'updated-metadata');
const SUCCESSFUL_DIR = path.join(UPDATED_METADATA_DIR, 'successful');
const FAILED_DIR = path.join(UPDATED_METADATA_DIR, 'failed');

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
  - Meta Data Updater: Update metadata for a single file or batch of files (GIF, JPEG, MP4, PNG, WebP).

Directories:
  - Bin: ${BIN_DIR}
  - Images: ${IMG_DIR}
  - Videos: ${VID_DIR}
  - CSV: ${CSV_DIR}
  - JSON: ${JSON_DIR}
  - Logs: ${LOG_DIR}
  - Updated Metadata: ${UPDATED_METADATA_DIR}/{successful,failed}/{gif,jpeg,mp4,png,webp}

Logs:
  - Console logs saved to: ${LOG_DIR}/main-<timestamp>.log
  `;
  log('INFO', helpText);
  process.exit(0);
}

// Ensure directories exist
async function ensureDirectories() {
  const dirs = [
    BIN_DIR,
    IMG_DIR,
    VID_DIR,
    CSV_DIR,
    JSON_DIR,
    LOG_DIR,
    path.join(SUCCESSFUL_DIR, 'gif'),
    path.join(SUCCESSFUL_DIR, 'jpeg'),
    path.join(SUCCESSFUL_DIR, 'mp4'),
    path.join(SUCCESSFUL_DIR, 'png'),
    path.join(SUCCESSFUL_DIR, 'webp'),
    path.join(FAILED_DIR, 'gif'),
    path.join(FAILED_DIR, 'jpeg'),
    path.join(FAILED_DIR, 'mp4'),
    path.join(FAILED_DIR, 'png'),
    path.join(FAILED_DIR, 'webp'),
  ];
  await Promise.all(
    dirs.map((dir) =>
      fs.promises.mkdir(dir, { recursive: true }).catch((err) => {
        log('ERROR', `Failed to create directory ${dir}: ${err.message}`);
        process.exit(1);
      })
    )
  );
  log('INFO', 'All required directories are present.');
}

// Prompt for metadata
async function promptForMetadata() {
  const questions = [
    {
      type: 'text',
      name: 'title',
      message: 'Enter the title for the metadata:',
      initial: 'Default Title',
      validate: (value) => (value ? true : 'Title is required'),
    },
    {
      type: 'text',
      name: 'description',
      message: 'Enter the description for the metadata:',
      initial: 'Default description',
      validate: (value) => (value ? true : 'Description is required'),
    },
    {
      type: 'text',
      name: 'keywords',
      message: 'Enter keywords (comma-separated):',
      initial: 'default, keywords',
      validate: (value) => (value ? true : 'Keywords are required'),
    },
    {
      type: 'text',
      name: 'copyright',
      message: 'Enter copyright notice:',
      initial: '© 2025 YourName',
      validate: (value) => (value ? true : 'Copyright is required'),
    },
    {
      type: 'text',
      name: 'genre',
      message: 'Enter genre:',
      initial: 'General',
      validate: (value) => (value ? true : 'Genre is required'),
    },
    {
      type: 'text',
      name: 'comment',
      message: 'Enter comment:',
      initial: 'Default comment',
      validate: (value) => (value ? true : 'Comment is required'),
    },
  ];

  const response = await prompts(questions);
  if (!response.title) {
    log('INFO', 'Metadata input cancelled.');
    process.exit(0);
  }
  return response;
}

// Main execution
(async () => {
  try {
    setupConsoleLogging(); // Initialize logging
    log('DEBUG', 'Starting main execution');

    const args = process.argv.slice(2);
    if (args.includes('--help')) return displayHelp();
    if (args.includes('-v') || args.includes('--version')) {
      log('INFO', 'File Manipulation App v1.0.0');
      process.exit(0);
    }

    log('DEBUG', 'Ensuring directories');
    await ensureDirectories();

    log('DEBUG', 'Prompting for initial selection');
    const initialResponse = await prompts({
      type: 'select',
      name: 'choice',
      message: 'Choose an option:',
      choices: [
        { title: 'Meta Data Updater', value: 'metadata' },
        { title: 'Exit', value: 'exit' },
      ],
      initial: 0,
    });

    log('DEBUG', `Initial response: ${JSON.stringify(initialResponse)}`);
    if (!initialResponse.choice || initialResponse.choice === 'exit') {
      log('INFO', 'Exiting application.');
      process.exit(0);
    }

    if (initialResponse.choice === 'metadata') {
      log('DEBUG', 'Prompting for file or folder path');
      const pathResponse = await prompts({
        type: 'text',
        name: 'path',
        message: 'Enter the path to a file or folder for metadata update (or "back" to return):',
        validate: (value) => {
          if (value.toLowerCase() === 'back') return true;
          return fs.existsSync(value) ? true : 'Path not found. Please enter a valid path or "back".';
        },
      });

      log('DEBUG', `Path response: ${JSON.stringify(pathResponse)}`);
      if (!pathResponse.path) {
        log('INFO', 'No path provided. Exiting.');
        process.exit(0);
      }

      if (pathResponse.path.toLowerCase() === 'back') {
        log('INFO', 'Returning to main menu.');
        return; // Loop back to initial prompt
      }

      const inputPath = path.resolve(pathResponse.path);
      const isDirectory = fs.statSync(inputPath).isDirectory();
      const metadata = await promptForMetadata();

      log('INFO', `Updating metadata for ${isDirectory ? 'folder' : 'file'}: ${inputPath}`);
      const result = await updateMetadata(inputPath, isDirectory, metadata, SUCCESSFUL_DIR, FAILED_DIR);

      log('INFO', 'Metadata update completed.');
      if (result.skipped.length > 0) {
        log('INFO', 'Skipped files (unsupported extensions):');
        result.skipped.forEach((file) => log('INFO', `  - ${file}`));
      }
    }

    log('INFO', 'Task completed. You can run the tool again.');
  } catch (err) {
    log('ERROR', `Unexpected error: ${err.message}`);
    process.exit(1);
  }
})();