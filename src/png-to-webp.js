#!/usr/bin/env node

const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

// Setup logs directory
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

// Log file setup
const now = new Date();
const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
const scriptName = path.basename(process.argv[1], ".js");
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
if (args.includes("--help") || args.includes("-help")) {
    console.log(`
Usage: node ${scriptName} <inputFolder> <outputFolder> [--help | -help]

Description:
  This script converts PNG files from the specified input folder to WebP format and saves them in the output folder using the cwebp tool. It uses lossy compression with high quality and maximum compression settings. Logs are generated for debugging and stored in the ./logs directory.

Arguments:
  <inputFolder>   (Required) The path to the folder containing PNG files to convert.
  <outputFolder>  (Required) The path to the folder where WebP files will be saved.
  --help | -help  (Optional) Display this help message and exit.

Prerequisites:
  - The cwebp tool must be installed and accessible in your PATH (e.g., install via 'libwebp' package on Linux or download from Google's WebP site).
  - Node.js must be installed.

Outputs:
  - Logs: Stored in ./logs/${scriptName}-<timestamp>.log
  - Converted WebP files: Saved to the specified <outputFolder> with names matching the input files (e.g., input.png -> input.webp).

Example:
  node ${scriptName} ./png ./webp
  node ${scriptName} --help
`);
    process.exit(0);
}

if (args.length !== 2) {
    logToFile("Usage: node convertPngToWebp.js <inputFolder> <outputFolder>");
    process.exit(1);
}

const inputFolder = path.resolve(args[0]);
const outputFolder = path.resolve(args[1]);

// Ensure the output folder exists
if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
    logToFile(`Created output folder: ${outputFolder}`);
}

// Read all files in the input folder
fs.readdir(inputFolder, (err, files) => {
    if (err) {
        logToFile(`Error reading folder: ${err.message}`);
        process.exit(1);
    }

    logToFile(`Script started: Converting PNG files from ${inputFolder} to ${outputFolder}`);

    // Filter for PNG files and convert them
    const pngFiles = files.filter((filename) => filename.toLowerCase().endsWith(".png"));
    if (pngFiles.length === 0) {
        logToFile(`No PNG files found in ${inputFolder}`);
        return;
    }

    logToFile(`Found ${pngFiles.length} PNG files to process`);

    pngFiles.forEach((filename) => {
        const inputFile = path.join(inputFolder, filename);
        const outputFile = path.join(outputFolder, `${path.basename(filename, ".png")}.webp`);

        // Optimized lossy command: high quality, max compression
        const command = `cwebp "${inputFile}" -q 90 -m 6 -pass 10 -o "${outputFile}"`;

        // Alternative lossless command (uncomment to use instead):
        // const command = `cwebp -lossless -z 9 "${inputFile}" -o "${outputFile}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                logToFile(`Error converting ${filename}: ${error.message}`);
                return;
            }
            if (stderr) {
                logToFile(`cwebp stderr for ${filename}: ${stderr}`);
                return;
            }
            logToFile(`Converted ${filename} to ${path.basename(outputFile)}`);
        });
    });

    logToFile("Script completed");
});