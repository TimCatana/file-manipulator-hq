#!/usr/bin/env node

const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');

// Setup logs directory
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

// Log file setup
const now = new Date();
const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
const scriptName = path.basename(process.argv[1], '.js');
const logFile = path.join(logsDir, `${scriptName}-${timestamp}.log`);

// Logging function
function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.log(logMessage.trim());
}

// Command-line arguments
const args = process.argv.slice(2);

// Help message
if (args.includes('--help') || args.includes('-help')) {
    console.log(`
Usage: node ${scriptName} <inputFolder> <outputFolder> <fileNameBase> <maxFiles> [--help | -help]

Description:
  This script renames and moves files from the specified input folder to the output folder, using a provided base filename and appending an index number (e.g., baseName-0.ext, baseName-1.ext). It processes up to a specified maximum number of files. Logs are generated for debugging and stored in the ./logs directory.

Arguments:
  <inputFolder>   (Required) The path to the folder containing files to rename.
  <outputFolder>  (Required) The path to the folder where renamed files will be saved.
  <fileNameBase>  (Required) The base name to use for renamed files (e.g., "image" results in "image-0.ext").
  <maxFiles>      (Required) The maximum number of files to process (integer).
  --help | -help  (Optional) Display this help message and exit.

Outputs:
  - Logs: Stored in ./logs/${scriptName}-<timestamp>.log
  - Renamed Files: Saved to the specified <outputFolder> with names like <fileNameBase>-<index>.<originalExtension>.

Example:
  node ${scriptName} ./input-files ./output-files image 10
  node ${scriptName} --help
`);
    process.exit(0);
}

if (args.length !== 4) {
    logToFile('Usage: node renameFiles.js <inputFolder> <outputFolder> <fileNameBase> <maxFiles>');
    process.exit(1);
}

const INPUT_FOLDER = args[0];
const OUTPUT_FOLDER = args[1];
const FILE_NAME_BASE = args[2];
const MAX_FILES = parseInt(args[3], 10);

// Ensure directory exists
const ensureDirectoryExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        logToFile(`Created directory: ${dirPath}`);
    }
};

// Generate a unique filename in the output folder
const getUniqueFileName = (baseName, extension, outputFolder) => {
    let newName = `${baseName}${extension}`;
    let newPath = path.join(outputFolder, newName);
    let counter = 1;

    while (fs.existsSync(newPath)) {
        newName = `${baseName}-${counter}${extension}`;
        newPath = path.join(outputFolder, newName);
        counter++;
    }

    return { fileName: newName, filePath: newPath };
};

// Rename and move files
const renameFiles = (inputFolder, outputFolder, fileNameBase, maxFiles) => {
    logToFile('Script started');

    if (!fs.existsSync(inputFolder)) {
        logToFile(`Error: Input folder does not exist: ${inputFolder}`);
        process.exit(1);
    }

    ensureDirectoryExists(outputFolder);

    const allFiles = fs.readdirSync(inputFolder).filter((file) =>
        fs.statSync(path.join(inputFolder, file)).isFile()
    );

    if (allFiles.length === 0) {
        logToFile(`No files found in ${inputFolder}`);
        return;
    }

    const files = allFiles.slice(0, Math.min(maxFiles, allFiles.length));
    logToFile(`Processing ${files.length} of ${allFiles.length} files (maxFiles: ${maxFiles})`);

    files.forEach((file, index) => {
        const originalPath = path.join(inputFolder, file);
        const originalExt = path.extname(file);
        const baseName = `${fileNameBase}-${index}`;
        const { fileName: newFileName, filePath: newPath } = getUniqueFileName(baseName, originalExt, outputFolder);

        try {
            fse.moveSync(originalPath, newPath, { overwrite: false });
            logToFile(`Renamed and moved ${file} to ${newFileName} in ${outputFolder}`);
        } catch (error) {
            logToFile(`Error renaming/moving ${file}: ${error.message}`);
        }
    });

    logToFile(`Renaming complete. Processed ${files.length} files.`);
    logToFile('Script completed');
};

// Run the script
renameFiles(INPUT_FOLDER, OUTPUT_FOLDER, FILE_NAME_BASE, MAX_FILES);