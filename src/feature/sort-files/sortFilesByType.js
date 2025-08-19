#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg'); // Optional, for video detection
const { log } = require('../../backend/utils/logUtils');

function parseArgs(args) {
  const params = {};
  const validFlags = ['input', 'output'];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const flag = args[i].slice(2);
      if (validFlags.includes(flag)) {
        const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : '';
        params[flag] = value;
        i++;
      } else {
        log('DEBUG', `Ignoring unrecognized argument: --${flag}`);
        if (args[i + 1] && !args[i + 1].startsWith('--')) i++; // Skip value of unrecognized flag
      }
    }
  }
  return params;
}

// Function to detect file type based on magic numbers
async function detectFileType(filePath) {
  const buffer = await fs.readFile(filePath, { encoding: null, flag: 'r' }, 12); // Read first 12 bytes
  log('DEBUG', `Detecting type for ${path.basename(filePath)} with buffer: ${buffer.toString('hex')}`);

  // Image magic numbers (excluding GIF)
  const imageSignatures = [
    { type: 'image', signature: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), offset: 0 }, // PNG
    { type: 'image', signature: Buffer.from([0xFF, 0xD8, 0xFF]), offset: 0 } // JPEG
  ];

  // Video magic numbers (including GIF)
  const videoSignatures = [
    { type: 'video', signature: Buffer.from([0x1A, 0x45, 0xDF, 0xA3]), offset: 0 }, // WebM
    { type: 'video', signature: Buffer.from([0x00, 0x00, 0x01, 0xB3]), offset: 0 }, // MP4 (partial)
    { type: 'video', signature: Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), offset: 0 }, // GIF87a
    { type: 'video', signature: Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), offset: 0 } // GIF89a
  ];

  for (const sig of imageSignatures) {
    if (buffer.slice(sig.offset, sig.offset + sig.signature.length).equals(sig.signature)) {
      log('DEBUG', `${path.basename(filePath)} identified as image by magic number`);
      return 'image';
    }
  }
  for (const sig of videoSignatures) {
    if (buffer.slice(sig.offset, sig.offset + sig.signature.length).equals(sig.signature)) {
      log('DEBUG', `${path.basename(filePath)} identified as video by magic number: ${sig.signature.toString('hex')}`);
      return 'video';
    }
  }

  // Optional FFprobe check for video if installed
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (!err) {
        const isVideo = metadata.streams.some(stream => stream.codec_type === 'video');
        log('DEBUG', `FFprobe result for ${path.basename(filePath)}: ${isVideo ? 'Video' : 'Not video'}, streams: ${JSON.stringify(metadata.streams)}`);
        if (isVideo) {
          resolve('video');
        } else {
          resolve(null);
        }
      } else {
        log('DEBUG', `FFprobe error for ${path.basename(filePath)}: ${err.message}, falling back to magic numbers`);
        resolve(null);
      }
    });
  }).catch((err) => {
    log('DEBUG', `FFprobe promise failed for ${path.basename(filePath)}: ${err.message}, treating as unrecognized`);
    return null;
  });
}

async function sortFilesByType(args = process.argv.slice(2)) {
  try {
    log('INFO', 'Starting Sort Files By Type Feature');

    const params = parseArgs(args);
    if (params.error) return 'error';

    let inputDir;
    if (params['input']) {
      inputDir = params['input'];
      const resolvedInput = path.resolve(inputDir);
      const realPath = await fs.realpath(resolvedInput); // Check for forbidden directories
      const forbiddenDirs = ['/etc', '/usr', '/var', '/bin', '/sbin', 'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)'];
      if (forbiddenDirs.some(dir => realPath.startsWith(path.resolve(dir)))) {
        log('ERROR', `Input directory ${inputDir} is in a system directory.`);
        return 'error';
      }
      if (!await fs.stat(inputDir).then(stats => stats.isDirectory()).catch(() => false)) {
        log('ERROR', `Input path not found or not a directory: ${inputDir}`);
        return 'error';
      }
      log('DEBUG', `Input directory from args: ${inputDir}`);
    } else {
      log('DEBUG', 'Prompting for input directory');
      const inputDirResponse = await prompts({
        type: 'text',
        name: 'dir',
        message: 'Enter the directory containing files to sort (or press Enter to cancel):',
        validate: async (value) => {
          if (value.trim() === '') return true;
          const resolvedPath = path.resolve(value);
          const realPath = await fs.realpath(resolvedPath); // Check for forbidden directories
          const forbiddenDirs = ['/etc', '/usr', '/var', '/bin', '/sbin', 'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)'];
          if (forbiddenDirs.some(dir => realPath.startsWith(path.resolve(dir)))) {
            return 'System directory not allowed.';
          }
          if (!await fs.stat(resolvedPath).then(stats => stats.isDirectory()).catch(() => false)) {
            return 'Path not found or not a directory.';
          }
          return true;
        }
      });
      inputDir = inputDirResponse.dir;
      log('DEBUG', `Input directory provided: ${inputDir}`);
      if (!inputDir) {
        log('INFO', 'No input directory provided, cancelling...');
        return 'cancelled';
      }
    }

    let outputDir;
    if (params['output']) {
      outputDir = params['output'];
      const resolvedOutput = path.resolve(outputDir);
      const realPath = await fs.realpath(resolvedOutput); // Check for forbidden directories
      const forbiddenDirs = ['/etc', '/usr', '/var', '/bin', '/sbin', 'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)'];
      if (forbiddenDirs.some(dir => realPath.startsWith(path.resolve(dir)))) {
        log('ERROR', `Output directory ${outputDir} is in a system directory.`);
        return 'error';
      }
      log('DEBUG', `Output directory from args: ${outputDir}`);
    } else {
      log('DEBUG', 'Prompting for output directory');
      const outputDirResponse = await prompts({
        type: 'text',
        name: 'dir',
        message: 'Enter the output directory to sort files into (or press Enter to cancel):',
        validate: async (value) => {
          if (value.trim() === '') return 'Output directory required.';
          const resolvedPath = path.resolve(value);
          const realPath = await fs.realpath(resolvedPath); // Check for forbidden directories
          const forbiddenDirs = ['/etc', '/usr', '/var', '/bin', '/sbin', 'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)'];
          if (forbiddenDirs.some(dir => realPath.startsWith(path.resolve(dir)))) {
            return 'System directory not allowed.';
          }
          return true;
        }
      });
      outputDir = outputDirResponse.dir;
      log('DEBUG', `Output directory provided: ${outputDir}`);
      if (!outputDir) {
        log('INFO', 'No output directory provided, cancelling...');
        return 'cancelled';
      }
    }

    log('DEBUG', `Creating output directory: ${outputDir}`);
    await fs.mkdir(outputDir, { recursive: true });
    log('DEBUG', `Output directory created or verified: ${outputDir}`);

    log('DEBUG', `Reading directory: ${inputDir}`);
    const dirEntries = await fs.readdir(inputDir, { withFileTypes: true });
    const files = [];
    for (const entry of dirEntries) {
      if (entry.isFile()) {
        const fullPath = path.join(inputDir, entry.name);
        files.push(fullPath);
        log('DEBUG', `Found file: ${fullPath}`);
      }
    }
    log('DEBUG', `Found ${files.length} files in ${inputDir}: ${files.join(', ')}`);

    if (files.length === 0) {
      log('INFO', `No files found in ${inputDir}`);
      return 'success';
    }

    let processed = 0, failed = 0, skipped = 0;

    for (const file of files) {
      const type = await detectFileType(file);
      let typeDir;

      if (type === 'image') {
        typeDir = path.join(outputDir, 'images');
      } else if (type === 'video') {
        typeDir = path.join(outputDir, 'videos');
      } else {
        log('DEBUG', `Skipping file with unrecognized type: ${file}, type detection result: ${type}`);
        skipped++;
        continue;
      }

      log('DEBUG', `Creating type directory: ${typeDir}`);
      await fs.mkdir(typeDir, { recursive: true });
      log('DEBUG', `Type directory created or verified: ${typeDir}`);

      const destFile = path.join(typeDir, path.basename(file));
      log('DEBUG', `Moving ${file} to ${destFile}`);
      try {
        await fs.rename(file, destFile);
        log('INFO', `Moved ${path.basename(file)} to ${path.basename(typeDir)} folder`);
        try {
          const stats = await fs.stat(destFile);
          log('DEBUG', `Moved file size: ${stats.size} bytes for ${destFile}`);
        } catch (statError) {
          log('DEBUG', `Failed to retrieve file size for ${destFile}: ${statError.message}`);
        }
        processed++;
      } catch (error) {
        log('ERROR', `Failed to move ${file} to ${destFile}: ${error.message}`);
        log('DEBUG', `Move error stack: ${error.stack}`);
        failed++;
      }
    }

    log('INFO', `Moved ${processed} files, ${failed} failed, ${skipped} skipped.`);
    log('DEBUG', `Sort Files By Type completed: ${processed} moved, ${failed} failed, ${skipped} skipped`);
    return failed === 0 ? 'success' : 'error';
  } catch (error) {
    log('ERROR', `Unexpected error in Sort Files By Type: ${error.message}`);
    log('DEBUG', `Error stack: ${error.stack}`);
    return 'error';
  }
}

if (require.main === module) {
  sortFilesByType().then(result => {
    process.exit(result === 'success' ? 0 : 1);
  }).catch(err => {
    log('ERROR', `Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { sortFilesByType };