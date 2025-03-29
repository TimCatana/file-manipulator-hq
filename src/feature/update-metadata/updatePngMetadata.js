#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const extractChunks = require('png-chunks-extract');
const encodeChunks = require('png-chunks-encode');
const { log } = require('../../backend/utils/logUtils');

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

function checkExifTool() {
  log('DEBUG', 'Checking for ExifTool installation');
  try {
    const version = execSync('exiftool -ver', { encoding: 'utf8' }).trim();
    log('INFO', `ExifTool version: ${version}`);
    log('DEBUG', 'ExifTool check successful');
    return true;
  } catch (error) {
    log('ERROR', 'ExifTool is not installed or not in PATH.');
    log('DEBUG', `ExifTool check failed: ${error.message}`);
    return false;
  }
}

function createTextChunk(keyword, text) {
  const data = Buffer.concat([
    Buffer.from(keyword, 'utf8'),
    Buffer.from([0]),
    Buffer.from(text, 'utf8'),
  ]);
  return { name: 'tEXt', data };
}

function createXMPChunk(xmpXml) {
  const keyword = 'XML:com.adobe.xmp';
  const compressionFlag = 0;
  const compressionMethod = 0;
  const languageTag = '';
  const translatedKeyword = '';
  const data = Buffer.concat([
    Buffer.from(keyword, 'utf8'),
    Buffer.from([0]),
    Buffer.from([compressionFlag]),
    Buffer.from([compressionMethod]),
    Buffer.from(languageTag, 'utf8'),
    Buffer.from([0]),
    Buffer.from(translatedKeyword, 'utf8'),
    Buffer.from([0]),
    Buffer.from(xmpXml, 'utf8'),
  ]);
  return { name: 'iTXt', data };
}

function generateXMP(title, description, keywords, copyright, genre, comment) {
  const currentDateTime = getCurrentDateTime();
  const keywordList = keywords
    .split(',')
    .map(k => k.trim())
    .map(k => `<rdf:li>${k}</rdf:li>`)
    .join('');
  log('DEBUG', `Generating XMP metadata with date: ${currentDateTime}`);
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

async function processPngFile(inputFile, outputFile, metadata) {
  const currentDateTime = getCurrentDateTime();
  log('DEBUG', `Processing PNG file: ${inputFile} -> ${outputFile}`);
  const buffer = await fsPromises.readFile(inputFile);
  log('DEBUG', `Read ${inputFile} with buffer length: ${buffer.length}`);
  let chunks = extractChunks(buffer);
  log('DEBUG', `Extracted ${chunks.length} chunks from ${inputFile}`);
  chunks = chunks.filter(chunk => !['tEXt', 'zTXt', 'iTXt'].includes(chunk.name));
  log('DEBUG', `Filtered out text chunks, remaining: ${chunks.length}`);
  const idatIndex = chunks.findIndex(c => c.name === 'IDAT');
  if (idatIndex === -1) {
    throw new Error('Invalid PNG file: No IDAT chunk found.');
  }
  log('DEBUG', `IDAT chunk found at index: ${idatIndex}`);

  const newTextChunks = [
    createTextChunk('Title', metadata.title),
    createTextChunk('Description', metadata.description),
    createTextChunk('Keywords', metadata.keywords),
    createTextChunk('Copyright', metadata.copyright),
    createTextChunk('Genre', metadata.genre),
    createTextChunk('Comment', metadata.comment),
    createTextChunk('Creation Time', currentDateTime),
  ];
  log('DEBUG', `Created ${newTextChunks.length} new text chunks`);

  const xmpXml = generateXMP(metadata.title, metadata.description, metadata.keywords, metadata.copyright, metadata.genre, metadata.comment);
  const xmpChunk = createXMPChunk(xmpXml);
  log('DEBUG', `Generated XMP chunk with length: ${xmpChunk.data.length}`);

  chunks.splice(idatIndex, 0, ...newTextChunks, xmpChunk);
  log('DEBUG', `Inserted new chunks, total now: ${chunks.length}`);
  const newBuffer = encodeChunks(chunks);
  log('DEBUG', `Encoded new buffer with length: ${newBuffer.length}`);

  log('DEBUG', `Writing new buffer to ${outputFile}`);
  await fsPromises.writeFile(outputFile, newBuffer);
  log('INFO', `Success: Metadata updated for ${outputFile}`);

  const exifCommand = `exiftool -ModifyDate="${currentDateTime}" -DateTimeOriginal="${currentDateTime}" -CreateDate="${currentDateTime}" -overwrite_original "${outputFile}"`;
  log('DEBUG', `Executing ExifTool command: ${exifCommand}`);
  execSync(exifCommand, { stdio: 'inherit' });
}

async function updatePngMetadata() {
  try {
    log('INFO', 'Starting Update PNG Metadata Feature');

    if (!checkExifTool()) {
      log('ERROR', 'ExifTool is not installed.');
      return 'error';
    }

    log('DEBUG', 'Prompting for input path');
    const inputPathResponse = await prompts({
      type: 'text',
      name: 'path',
      message: 'Enter the path to the input PNG file or directory (or press Enter to cancel):',
      validate: value => value.trim() === '' || fs.existsSync(value) ? true : 'Path not found.'
    });
    const inputPath = inputPathResponse.path;
    log('DEBUG', `Input path provided: ${inputPath}`);
    if (!inputPath) {
      log('INFO', 'No input path provided, cancelling...');
      return 'cancelled';
    }

    log('DEBUG', 'Prompting for output directory');
    const outputPathResponse = await prompts({
      type: 'text',
      name: 'path',
      message: 'Enter the path for the output directory (or press Enter to cancel):',
      validate: value => value.trim() !== '' ? true : 'Output directory required.'
    });
    const outputDir = outputPathResponse.path;
    log('DEBUG', `Output directory provided: ${outputDir}`);
    if (!outputDir) {
      log('INFO', 'No output directory provided, cancelling...');
      return 'cancelled';
    }

    log('DEBUG', 'Prompting for metadata input');
    const metadata = await prompts([
      { type: 'text', name: 'title', message: 'Enter title:', initial: 'Untitled' },
      { type: 'text', name: 'description', message: 'Enter description:', initial: '' },
      { type: 'text', name: 'keywords', message: 'Enter keywords (comma-separated):', initial: '' },
      { type: 'text', name: 'copyright', message: 'Enter copyright:', initial: '' },
      { type: 'text', name: 'genre', message: 'Enter genre:', initial: '' },
      { type: 'text', name: 'comment', message: 'Enter comment:', initial: '' }
    ]);
    log('DEBUG', `Metadata collected: ${JSON.stringify(metadata)}`);

    log('DEBUG', `Creating output directory: ${outputDir}`);
    await fsPromises.mkdir(outputDir, { recursive: true });
    log('DEBUG', `Output directory created or verified: ${outputDir}`);

    const stats = await fsPromises.stat(inputPath);
    log('DEBUG', `Input path stats: ${stats.isFile() ? 'File' : 'Directory'}`);

    if (stats.isFile()) {
      if (!inputPath.toLowerCase().endsWith('.png')) {
        log('ERROR', 'Input file must be a PNG.');
        return 'error';
      }
      const outputFile = path.join(outputDir, path.basename(inputPath));
      await processPngFile(inputFile, outputFile, metadata);
    } else if (stats.isDirectory()) {
      log('DEBUG', `Reading directory: ${inputPath}`);
      const files = await fsPromises.readdir(inputPath);
      const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png'));
      log('DEBUG', `Found ${pngFiles.length} PNG files: ${pngFiles.join(', ')}`);
      if (pngFiles.length === 0) {
        log('INFO', 'No PNG files found in the directory.');
        return 'success';
      }
      for (const file of pngFiles) {
        const inputFile = path.join(inputPath, file);
        const outputFile = path.join(outputDir, file);
        await processPngFile(inputFile, outputFile, metadata);
      }
      log('INFO', `Processed ${pngFiles.length} PNG files.`);
    }

    log('DEBUG', 'Update PNG Metadata completed successfully');
    return 'success';
  } catch (error) {
    log('ERROR', `Unexpected error in Update PNG Metadata: ${error.message}`);
    log('DEBUG', `Error stack: ${error.stack}`);
    return 'error';
  }
}

module.exports = { updatePngMetadata };