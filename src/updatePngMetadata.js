#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const extractChunks = require('png-chunks-extract');
const encodeChunks = require('png-chunks-encode');

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
  This script processes PNG files in the specified input folder, updates their metadata using PNG chunks and ExifTool, and saves the modified files to the output folder. Metadata includes title, description, keywords, copyright, genre, and timestamps. Logs are generated for debugging and stored in the ./logs directory.

Arguments:
  <inputFolder>  (Required) The path to the folder containing input PNG files.
  <outputFolder> (Required) The path to the folder where processed PNG files will be saved.
  -v             (Optional) Enable verbose mode to display metadata after processing.
  --help | -help (Optional) Display this help message and exit.

Prerequisites:
  - ExifTool must be installed and accessible in your PATH (e.g., install via 'brew install exiftool' on macOS).
  - Node.js must be installed.
  - Required Node.js packages: png-chunks-extract, png-chunks-encode (install via npm).

Outputs:
  - Logs: Stored in ./logs/${scriptName}-<timestamp>.log
  - Processed PNG files: Saved to the specified <outputFolder> with updated metadata.

Example:
  node ${scriptName} ./input-pngs ./output-pngs
  node ${scriptName} ./input-pngs ./output-pngs -v
  node ${scriptName} --help
`);
    process.exit(0);
}

if (args.length < 2 || args.length > 3) {
    console.error('Usage: node updatePngMetadata.js <inputFolder> <outputFolder> [-v]');
    process.exit(1);
}

const INPUT_FOLDER = args[0];       // First argument: input folder
const OUTPUT_FOLDER = args[1];      // Second argument: output folder
const VERBOSE = args[2] === '-v';   // Third argument (optional): verbose flag

// Metadata constants (customize these as needed for SEO optimization)
const TITLE = "White Kitchen";
const DESCRIPTION = "White kitchen interior design idea";
const KEYWORDS = "white kitchen, kitchen, interior design";
const COPYRIGHT = "© 2025 Mynza"; // Updated to include copyright symbol for consistency
const GENRE = "Interior Design";
const COMMENT = "Optimized for Pinterest";

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
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based
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

// Function to create a tEXt chunk
function createTextChunk(keyword, text) {
    const data = Buffer.concat([
        Buffer.from(keyword, 'utf8'),
        Buffer.from([0]), // Null separator
        Buffer.from(text, 'utf8')
    ]);
    return { name: 'tEXt', data };
}

// Function to create an iTXt chunk for XMP metadata
function createXMPChunk(xmpXml) {
    const keyword = 'XML:com.adobe.xmp';
    const compressionFlag = 0; // Uncompressed
    const compressionMethod = 0; // No compression used
    const languageTag = ''; // Empty language tag
    const translatedKeyword = ''; // Empty translated keyword
    const data = Buffer.concat([
        Buffer.from(keyword, 'utf8'),
        Buffer.from([0]), // Null separator
        Buffer.from([compressionFlag]),
        Buffer.from([compressionMethod]),
        Buffer.from(languageTag, 'utf8'),
        Buffer.from([0]), // Null separator
        Buffer.from(translatedKeyword, 'utf8'),
        Buffer.from([0]), // Null separator
        Buffer.from(xmpXml, 'utf8')
    ]);
    return { name: 'iTXt', data };
}

// Function to generate XMP XML metadata with Genre and Comment
function generateXMP(title, description, keywords, copyright, genre, comment) {
    const currentDateTime = getCurrentDateTime();
    const keywordList = keywords
        .split(',')
        .map(k => k.trim())
        .map(k => `<rdf:li>${k}</rdf:li>`)
        .join('');
    return `<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="XMP Core 5.1.2">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/">
   <dc:title>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${title}</rdf:li>
    </rdf:Alt>
   </dc:title>
   <dc:description>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${description}</rdf:li>
    </rdf:Alt>
   </dc:description>
   <dc:subject>
    <rdf:Bag>
     ${keywordList}
    </rdf:Bag>
   </dc:subject>
   <dc:rights>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${copyright}</rdf:li>
    </rdf:Alt>
   </dc:rights>
   <dc:type>
    <rdf:Bag>
     <rdf:li>${genre}</rdf:li>
    </rdf:Bag>
   </dc:type>
   <xmp:CreateDate>${currentDateTime}</xmp:CreateDate>
   <xmp:ModifyDate>${currentDateTime}</xmp:ModifyDate>
   <xmp:DateTimeOriginal>${currentDateTime}</xmp:DateTimeOriginal>
   <xmp:Comment>${comment}</xmp:Comment>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>`;
}

// Function to update metadata for a single PNG file
function updatePngMetadata(inputPath, outputPath) {
    try {
        // Read the PNG file
        const buffer = fs.readFileSync(inputPath);

        // Extract all chunks
        let chunks = extractChunks(buffer);

        // Remove existing text-related chunks to avoid duplicates
        chunks = chunks.filter(chunk => !['tEXt', 'zTXt', 'iTXt'].includes(chunk.name));

        // Find insertion point (before first IDAT chunk)
        const idatIndex = chunks.findIndex(c => c.name === 'IDAT');
        if (idatIndex === -1) {
            throw new Error('Invalid PNG file: No IDAT chunk found.');
        }

        const currentDateTime = getCurrentDateTime();

        // Create tEXt chunks for basic metadata, including Genre and Comment
        const newTextChunks = [
            createTextChunk('Title', TITLE),
            createTextChunk('Description', DESCRIPTION),
            createTextChunk('Keywords', KEYWORDS),
            createTextChunk('Copyright', COPYRIGHT),
            createTextChunk('Genre', GENRE),
            createTextChunk('Comment', COMMENT),
            createTextChunk('Creation Time', currentDateTime)
        ];

        // Generate XMP metadata with current date, Genre, and Comment
        const xmpXml = generateXMP(TITLE, DESCRIPTION, KEYWORDS, COPYRIGHT, GENRE, COMMENT);
        const xmpChunk = createXMPChunk(xmpXml);

        // Insert new chunks before IDAT
        chunks.splice(idatIndex, 0, ...newTextChunks, xmpChunk);

        // Encode chunks back to PNG format
        const newBuffer = encodeChunks(chunks);

        // Write the modified PNG to output file
        fs.writeFileSync(outputPath, newBuffer);
        logToFile(`Success: Metadata updated for ${outputPath}`);

        // Set file system timestamps and additional ExifTool fields
        execSync(`exiftool -ModifyDate="${currentDateTime}" -DateTimeOriginal="${currentDateTime}" -CreateDate="${currentDateTime}" -overwrite_original "${outputPath}"`, { stdio: 'inherit' });

        // Verify changes with ExifTool if verbose flag is set
        if (VERBOSE) {
            logToFile(`Verifying metadata for ${path.basename(outputPath)}:`);
            execSync(`exiftool "${outputPath}"`, { stdio: 'inherit' });
        }
    } catch (error) {
        logToFile(`Error processing ${inputPath}: ${error.message}`);
    }
}

// Function to process all PNG files in the input folder
function processPngFolder(inputFolder, outputFolder) {
    logToFile('Script started');

    if (!checkExifTool()) {
        logToFile("Please install ExifTool (e.g., `brew install exiftool` on macOS).");
        process.exit(1);
    }

    if (!fs.existsSync(inputFolder)) {
        logToFile(`Error: Input folder not found: ${inputFolder}`);
        process.exit(1);
    }

    // Create output folder if it doesn’t exist
    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
        logToFile(`Created output folder: ${outputFolder}`);
    }

    // Read all files in the input folder
    const files = fs.readdirSync(inputFolder).filter(file => 
        path.extname(file).toLowerCase() === '.png'
    );

    if (files.length === 0) {
        logToFile(`No PNG files found in ${inputFolder}`);
        return;
    }

    // Process each PNG file
    files.forEach(file => {
        const inputFilePath = path.join(inputFolder, file);
        const outputFilePath = path.join(outputFolder, file); // Keep the same file name
        updatePngMetadata(inputFilePath, outputFilePath);
    });

    logToFile('All PNG files processed.');
    logToFile('Script completed');
}

// Run the script
processPngFolder(INPUT_FOLDER, OUTPUT_FOLDER);