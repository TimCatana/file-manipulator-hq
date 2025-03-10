#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Setup logs directory
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

// Log file setup
const now = new Date();
const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
const scriptName = path.basename(process.argv[1], '.js');
const logFile = path.join(logsDir, `${scriptName}-${timestamp}.log`);

// Constants for media type subfolders (relative to base output folder)
const PNG_SUBFOLDER = 'pngs';       // PNG files
const MP4_SUBFOLDER = 'mp4s';       // MP4 files
const WEBP_SUBFOLDER = 'webps';     // WebP files
const JPEG_SUBFOLDER = 'jpegs';     // JPEG files (jpg, jpeg)
const GIF_SUBFOLDER = 'gifs';       // GIF files
const TIFF_SUBFOLDER = 'tiffs';     // TIFF files (tif, tiff)
const BMP_SUBFOLDER = 'bmps';       // BMP files
const MOV_SUBFOLDER = 'movs';       // MOV files
const AVI_SUBFOLDER = 'avis';       // AVI files
const MKV_SUBFOLDER = 'mkvs';       // MKV files
const WMV_SUBFOLDER = 'wmvs';       // WMV files

// Get command-line arguments
const args = process.argv.slice(2);

// Help message
if (args.includes('--help') || args.includes('-help')) {
    console.log(`
Usage: node ${scriptName} <inputFolder> <baseOutputFolder> [--help | -help]

Description:
  This script sorts media files (images and videos) from the specified input folder into subfolders within the base output folder based on their file extensions. Supported media types include PNG, MP4, WebP, JPEG, GIF, TIFF, BMP, MOV, AVI, MKV, and WMV. Logs are generated for debugging and stored in the ./logs directory.

Arguments:
  <inputFolder>     (Required) The path to the folder containing mixed media files to sort.
  <baseOutputFolder> (Required) The base folder where sorted subfolders (e.g., pngs, mp4s) will be created.
  --help | -help    (Optional) Display this help message and exit.

Supported File Extensions:
  - Images: .png, .webp, .jpg, .jpeg, .gif, .tif, .tiff, .bmp
  - Videos: .mp4, .mov, .avi, .mkv, .wmv

Outputs:
  - Logs: Stored in ./logs/${scriptName}-<timestamp>.log
  - Sorted Files: Organized into subfolders within the specified <baseOutputFolder> (e.g., ${BASE_OUTPUT_FOLDER}/pngs, ${BASE_OUTPUT_FOLDER}/mp4s).

Example:
  node ${scriptName} ./mixed-media ./sorted-media
  node ${scriptName} --help
`);
    process.exit(0);
}

if (args.length !== 2) {
    logToFile('Usage: node sortMediaFiles.js <inputFolder> <baseOutputFolder>');
    process.exit(1);
}

const INPUT_FOLDER = args[0];        // First argument: input folder with mixed files
const BASE_OUTPUT_FOLDER = args[1];  // Second argument: base folder for sorted subfolders

// Map of file extensions to subfolder names
const MEDIA_TYPES = {
    '.png': PNG_SUBFOLDER,
    '.mp4': MP4_SUBFOLDER,
    '.webp': WEBP_SUBFOLDER,
    '.jpg': JPEG_SUBFOLDER,
    '.jpeg': JPEG_SUBFOLDER,
    '.gif': GIF_SUBFOLDER,
    '.tif': TIFF_SUBFOLDER,
    '.tiff': TIFF_SUBFOLDER,
    '.bmp': BMP_SUBFOLDER,
    '.mov': MOV_SUBFOLDER,
    '.avi': AVI_SUBFOLDER,
    '.mkv': MKV_SUBFOLDER,
    '.wmv': WMV_SUBFOLDER
};

// Logging function
function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.log(logMessage.trim());
}

// Function to ensure a directory exists, creating it if necessary
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        logToFile(`Created directory: ${dirPath}`);
    }
}

// Function to sort and move files
function sortMediaFiles(inputFolder, baseOutputFolder) {
    logToFile('Script started');

    // Check if input folder exists
    if (!fs.existsSync(inputFolder)) {
        logToFile(`Error: Input folder does not exist: ${inputFolder}`);
        process.exit(1);
    }

    // Ensure base output folder exists
    ensureDirectoryExists(baseOutputFolder);

    // Ensure all subfolders exist within the base output folder
    Object.values(MEDIA_TYPES).forEach(subfolder => {
        const fullSubfolderPath = path.join(baseOutputFolder, subfolder);
        ensureDirectoryExists(fullSubfolderPath);
    });

    // Read all files in the input folder
    fs.readdir(inputFolder, (err, files) => {
        if (err) {
            logToFile(`Error reading input folder: ${err.message}`);
            process.exit(1);
        }

        // Process each file
        files.forEach(file => {
            const inputFilePath = path.join(inputFolder, file);

            // Skip if it's not a file (e.g., a directory)
            if (!fs.statSync(inputFilePath).isFile()) {
                logToFile(`Skipping non-file: ${file}`);
                return;
            }

            const ext = path.extname(file).toLowerCase();
            const subfolder = MEDIA_TYPES[ext];

            // Check if the extension is a supported media type
            if (!subfolder) {
                logToFile(`Skipping file with unsupported extension: ${file}`);
                return;
            }

            const outputFolder = path.join(baseOutputFolder, subfolder);
            const outputFilePath = path.join(outputFolder, file);

            // Move the file
            try {
                fs.renameSync(inputFilePath, outputFilePath);
                logToFile(`Moved ${file} to ${outputFolder}`);
            } catch (error) {
                logToFile(`Error moving ${file}: ${error.message}`);
            }
        });

        logToFile('Sorting complete.');
        logToFile('Script completed');
    });
}

// Run the script with the provided input and base output folders
sortMediaFiles(INPUT_FOLDER, BASE_OUTPUT_FOLDER);