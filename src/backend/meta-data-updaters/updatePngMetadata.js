#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const extractChunks = require('png-chunks-extract');
const encodeChunks = require('png-chunks-encode');
const { log } = require('../logging/logUtils');

// Log file setup
const LOG_DIR = path.join(__dirname, '..', '..', '..', 'logs');
const now = new Date();
const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
const scriptName = path.basename(__filename, '.js');
const logFile = path.join(LOG_DIR, `${scriptName}-${timestamp}.log`);

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

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
    log('INFO', `ExifTool version: ${version}`);
    return true;
  } catch (error) {
    log('ERROR', 'ExifTool is not installed or not in PATH.');
    return false;
  }
}

// Function to create a tEXt chunk
function createTextChunk(keyword, text) {
  const data = Buffer.concat([
    Buffer.from(keyword, 'utf8'),
    Buffer.from([0]), // Null separator
    Buffer.from(text, 'utf8'),
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
    Buffer.from(xmpXml, 'utf8'),
  ]);
  return { name: 'iTXt', data };
}

// Function to generate XMP XML metadata
function generateXMP(title, description, keywords, copyright, genre, comment) {
  const currentDateTime = getCurrentDateTime();
  const keywordList = keywords
    .split(',')
    .map((k) => k.trim())
    .map((k) => `<rdf:li>${k}</rdf:li>`)
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
async function processPngFolder(inputFile, outputFile, metadata) {
  if (!checkExifTool()) {
    throw new Error('ExifTool not installed');
  }

  const { title, description, keywords, copyright, genre, comment } = metadata;
  const currentDateTime = getCurrentDateTime();

  try {
    // Read the PNG file
    const buffer = fs.readFileSync(inputFile);

    // Extract all chunks
    let chunks = extractChunks(buffer);

    // Remove existing text-related chunks to avoid duplicates
    chunks = chunks.filter((chunk) => !['tEXt', 'zTXt', 'iTXt'].includes(chunk.name));

    // Find insertion point (before first IDAT chunk)
    const idatIndex = chunks.findIndex((c) => c.name === 'IDAT');
    if (idatIndex === -1) {
      throw new Error('Invalid PNG file: No IDAT chunk found.');
    }

    // Create tEXt chunks for basic metadata
    const newTextChunks = [
      createTextChunk('Title', title),
      createTextChunk('Description', description),
      createTextChunk('Keywords', keywords),
      createTextChunk('Copyright', copyright),
      createTextChunk('Genre', genre),
      createTextChunk('Comment', comment),
      createTextChunk('Creation Time', currentDateTime),
    ];

    // Generate XMP metadata
    const xmpXml = generateXMP(title, description, keywords, copyright, genre, comment);
    const xmpChunk = createXMPChunk(xmpXml);

    // Insert new chunks before IDAT
    chunks.splice(idatIndex, 0, ...newTextChunks, xmpChunk);

    // Encode chunks back to PNG format
    const newBuffer = encodeChunks(chunks);

    // Write the modified PNG to output file
    fs.writeFileSync(outputFile, newBuffer);
    log('INFO', `Success: Metadata updated for ${outputFile}`);

    // Set file system timestamps with ExifTool
    execSync(
      `exiftool -ModifyDate="${currentDateTime}" -DateTimeOriginal="${currentDateTime}" -CreateDate="${currentDateTime}" -overwrite_original "${outputFile}"`,
      { stdio: 'inherit' }
    );
  } catch (error) {
    log('ERROR', `Error processing ${inputFile}: ${error.message}`);
    throw error;
  }
}

module.exports = { processPngFolder };