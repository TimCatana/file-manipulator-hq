#!/usr/bin/env node

const { execSync } = require('child_process');
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

// Get command-line arguments
const args = process.argv.slice(2);

// Help message
if (args.includes('--help') || args.includes('-help')) {
    console.log(`
Usage: node ${scriptName} <inputFolder> <outputFolder> [-v] [--help | -help]

Description:
  This script processes GIF files in the specified input folder, updates their metadata using ExifTool, and saves the modified files to the output folder. Metadata includes title, description, keywords, copyright, genre, and timestamps. Logs are generated for debugging and stored in the ./logs directory.

Arguments:
  <inputFolder>  (Required) The path to the folder containing input GIF files.
  <outputFolder> (Required) The path to the folder where processed GIF files will be saved.
  -v             (Optional) Enable verbose mode to display metadata after processing.
  --help | -help (Optional) Display this help message and exit.

Prerequisites:
  - ExifTool must be installed and accessible in your PATH (e.g., install via 'brew install exiftool' on macOS).
  - Node.js must be installed.

Outputs:
  - Logs: Stored in ./logs/${scriptName}-<timestamp>.log
  - Processed GIF files: Saved to the specified <outputFolder> with updated metadata.

Example:
  node ${scriptName} ./input-gifs ./output-gifs
  node ${scriptName} ./input-gifs ./output-gifs -v
  node ${scriptName} --help
`);
    process.exit(0);
}

if (args.length < 2 || args.length > 3) {
    console.error('Usage: node updateGifMetadata.js <inputFolder> <outputFolder> [-v]');
    process.exit(1);
}

const INPUT_FOLDER = args[0];  // First argument: input folder
const OUTPUT_FOLDER = args[1]; // Second argument: output folder
const VERBOSE = args[2] === '-v'; // Third argument (optional): verbose flag

// Metadata constants
const TITLE = "White Kitchen GIF";
const DESCRIPTION = "Modern white kitchen with marble countertops and sleek cabinets";
const KEYWORDS = "kitchen, interior design, home decor, marble, modern";
const COPYRIGHT = "© 2025 Mynza"; // Updated from "YourName" to "Mynza"
const GENRE = "Home Decor";
const COMMENT = "Optimized for Pinterest Home Decor feed";

// Logging function
function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.log(logMessage.trim());
}

// Function to get current date and time in ExifTool format (YYYY:MM:DD HH:mm:ss)
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

// Function to check if ExifTool is installed
function checkExifTool() {
    try {
        const version = execSync('exiftool -ver', { encoding: 'utf8' }).trim();
        logToFile(`ExifTool version: ${version}`);
        return true;
    } catch (error) {
        logToFile("Error: ExifTool is not installed or not in PATH.");
        return false;
    }
}

// Function to update metadata for a single GIF file
function updateGifMetadata(inputPath, outputPath) {
    const currentDateTime = getCurrentDateTime();
    const command = [
        'exiftool',
        `-Comment="${COMMENT}"`,
        `-XMP-dc:Title="${TITLE}"`,
        `-XMP-dc:Description="${DESCRIPTION}"`,
        `-XMP-dc:Subject="${KEYWORDS}"`,
        `-XMP-dc:Rights="${COPYRIGHT}"`,
        `-XMP-dc:Type="${GENRE}"`,
        `-XMP-xmp:Comment="${COMMENT}"`,
        `-XMP-xmp:CreateDate="${currentDateTime}"`,
        `-XMP-xmp:ModifyDate="${currentDateTime}"`,
        `-XMP-xmp:DateTimeOriginal="${currentDateTime}"`,
        `-ModifyDate="${currentDateTime}"`,
        `-DateTimeOriginal="${currentDateTime}"`,
        `-CreateDate="${currentDateTime}"`,
        '-overwrite_original',
        `"${inputPath}"`
    ].join(' ');

    try {
        fs.copyFileSync(inputPath, outputPath);
        logToFile(`Copied ${path.basename(inputPath)} to ${outputPath}`);
        execSync(command.replace(inputPath, outputPath), { stdio: 'inherit' });
        logToFile(`Success: Metadata updated for ${outputPath}`);

        if (VERBOSE) {
            logToFile(`Verifying metadata for ${path.basename(outputPath)}:`);
            execSync(`exiftool "${outputPath}"`, { stdio: 'inherit' });
        }
    } catch (error) {
        logToFile(`Error processing ${inputPath}: ${error.message}`);
    }
}

// Function to process all GIF files in the input folder
function processGifFolder(inputFolder, outputFolder) {
    logToFile('Script started');
    
    if (!checkExifTool()) {
        logToFile("Please install ExifTool (e.g., `brew install exiftool` on macOS).");
        process.exit(1);
    }

    if (!fs.existsSync(inputFolder)) {
        logToFile(`Error: Input folder not found: ${inputFolder}`);
        process.exit(1);
    }

    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
        logToFile(`Created output folder: ${outputFolder}`);
    }

    const files = fs.readdirSync(inputFolder).filter(file => 
        path.extname(file).toLowerCase() === '.gif'
    );

    if (files.length === 0) {
        logToFile(`No GIF files found in ${inputFolder}`);
        return;
    }

    files.forEach(file => {
        const inputFilePath = path.join(inputFolder, file);
        const outputFilePath = path.join(outputFolder, file);
        updateGifMetadata(inputFilePath, outputFilePath);
    });

    logToFile('All GIF files processed.');
    logToFile('Script completed');
}

// Run the script
processGifFolder(INPUT_FOLDER, OUTPUT_FOLDER);