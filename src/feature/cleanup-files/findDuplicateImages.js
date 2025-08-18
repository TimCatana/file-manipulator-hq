#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');
const pixelmatchModule = require('pixelmatch');
const pixelmatch = pixelmatchModule.default;
const { log } = require('../../backend/utils/logUtils');

// Configuration
const BASE_DIR = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(BASE_DIR, 'bin', 'cleanup-files', 'duplicate-images');

log('DEBUG', `Pixelmatch module loaded: ${typeof pixelmatch}`);
log('DEBUG', `Sharp module loaded: ${typeof sharp}`);

function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function parseArgs(args) {
  const params = {};
  const validFlags = ['input', 'delete'];
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

async function areImagesIdentical(buffer1, buffer2) {
  try {
    log('DEBUG', `Starting image comparison`);
    const image1 = await sharp(buffer1)
      .resize(800, 533, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const image2 = await sharp(buffer2)
      .resize(800, 533, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data: data1, info: info1 } = image1;
    const { data: data2, info: info2 } = image2;

    log('DEBUG', `Image1: ${info1.width}x${info1.height}, channels: ${info1.channels}, size: ${data1.length}`);
    log('DEBUG', `Image2: ${info2.width}x${info2.height}, channels: ${info2.channels}, size: ${data2.length}`);

    if (info1.width !== info2.width || info1.height !== info2.height || info1.channels !== info2.channels) {
      log('DEBUG', `Images differ in dimensions or channels`);
      return false;
    }

    const hash1 = crypto.createHash('md5').update(data1).digest('hex');
    const hash2 = crypto.createHash('md5').update(data2).digest('hex');
    log('DEBUG', `Image hashes: ${hash1} vs ${hash2}`);

    if (hash1 === hash2) {
      log('DEBUG', `Images identical by hash`);
      return true;
    }

    log('DEBUG', `Performing pixelmatch comparison`);
    if (typeof pixelmatch !== 'function') {
      log('ERROR', `Pixelmatch is not a function, falling back to hash comparison`);
      return false; // Fallback to hash comparison result
    }
    const diffPixels = pixelmatch(data1, data2, null, info1.width, info1.height, { threshold: 0.1 });
    log('DEBUG', `Pixel differences: ${diffPixels}`);
    return diffPixels < 200;
  } catch (error) {
    log('ERROR', `Image comparison failed: ${error.message}`);
    log('DEBUG', `Comparison error stack: ${error.stack}`);
    return false;
  }
}

async function findDuplicateImages(args = process.argv.slice(2)) {
  try {
    log('INFO', 'Starting Find Duplicate Images Feature');

    const params = parseArgs(args);
    if (params.error) return 'error';

    let inputDir;
    if (params['input']) {
      inputDir = params['input'];
      try {
        await fs.access(inputDir);
        log('DEBUG', `Input directory from args: ${inputDir}`);
      } catch {
        log('ERROR', `Input directory not found: ${inputDir}`);
        return 'error';
      }
    } else {
      log('DEBUG', 'Prompting for input directory');
      const inputDirResponse = await prompts({
        type: 'text',
        name: 'dir',
        message: 'Enter the directory containing images to check for duplicates (or press Enter to cancel):',
        validate: async (value) => {
          if (value.trim() === '') return true;
          try {
            await fs.access(value);
            return true;
          } catch {
            return 'Directory not found.';
          }
        }
      });
      inputDir = inputDirResponse.dir;
      log('DEBUG', `Input directory provided: ${inputDir}`);
      if (!inputDir) {
        log('INFO', 'No input directory provided, cancelling...');
        return 'cancelled';
      }
    }

    let deleteOption;
    if (params['delete']) {
      deleteOption = params['delete'].toLowerCase();
      if (!['yes', 'no', 'all'].includes(deleteOption)) {
        log('ERROR', `Invalid delete option: ${deleteOption}. Must be 'yes', 'no', or 'all'.`);
        return 'error';
      }
      log('DEBUG', `Delete option from args: ${deleteOption}`);
    } else {
      log('DEBUG', 'Prompting for delete option');
      const deleteResponse = await prompts({
        type: 'select',
        name: 'delete',
        message: 'Do you want to delete duplicate images? (No: List duplicates only, Yes: Prompt to keep one of each duplicate group, All: Keep first image of each group without prompting)',
        choices: [
          { title: 'No', value: 'no' },
          { title: 'Yes', value: 'yes' },
          { title: 'All', value: 'all' },
        ],
        initial: 0,
      });
      deleteOption = deleteResponse.delete;
      log('DEBUG', `Delete option provided: ${deleteOption}`);
      if (!deleteOption) {
        log('INFO', 'No delete option provided, cancelling...');
        return 'cancelled';
      }
    }

    // Read directory and filter image files
    log('DEBUG', `Reading directory: ${inputDir}`);
    const dirEntries = await fs.readdir(inputDir);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const files = [];
    for (const entry of dirEntries) {
      const fullPath = path.join(inputDir, entry);
      const stats = await fs.stat(fullPath);
      if (stats.isFile() && imageExtensions.includes(path.extname(fullPath).toLowerCase())) {
        files.push(fullPath);
      }
    }
    log('DEBUG', `Found ${files.length} image files in ${inputDir}: ${files.join(', ')}`);

    if (files.length === 0) {
      log('INFO', `No image files found in ${inputDir}`);
      // Write empty report
      const timestamp = getTimestamp();
      const reportPath = path.join(OUTPUT_DIR, `duplicate-images-report-${timestamp}.json`);
      const report = {
        duplicateGroups: [],
        deletedFiles: [],
        timestamp: new Date().toISOString()
      };
      log('DEBUG', `Creating output directory: ${OUTPUT_DIR}`);
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
      log('DEBUG', `Writing report to ${reportPath}`);
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      log('INFO', `Duplicate images report saved to: ${reportPath}`);
      return 'success';
    }

    log('INFO', `Processing ${files.length} image files for duplicates`);
    const processedFiles = new Set();
    const duplicateGroups = [];
    const deletedFiles = [];

    // Group duplicates
    for (let i = 0; i < files.length; i++) {
      if (processedFiles.has(files[i])) continue;
      const currentGroup = [files[i]];
      const buffer1 = await fs.readFile(files[i]);
      for (let j = i + 1; j < files.length; j++) {
        if (processedFiles.has(files[j])) continue;
        const buffer2 = await fs.readFile(files[j]);
        log('DEBUG', `Comparing ${files[i]} with ${files[j]}`);
        if (await areImagesIdentical(buffer1, buffer2)) {
          currentGroup.push(files[j]);
          processedFiles.add(files[j]);
        }
      }
      processedFiles.add(files[i]);
      if (currentGroup.length > 1) {
        duplicateGroups.push(currentGroup);
        log('INFO', `Found duplicate group: ${currentGroup.join(', ')}`);
      }
    }

    if (duplicateGroups.length === 0) {
      log('INFO', 'No duplicate images found.');
      // Write empty report
      const timestamp = getTimestamp();
      const reportPath = path.join(OUTPUT_DIR, `duplicate-images-report-${timestamp}.json`);
      const report = {
        duplicateGroups: [],
        deletedFiles: [],
        timestamp: new Date().toISOString()
      };
      log('DEBUG', `Creating output directory: ${OUTPUT_DIR}`);
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
      log('DEBUG', `Writing report to ${reportPath}`);
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      log('INFO', `Duplicate images report saved to: ${reportPath}`);
      return 'success';
    }

    if (deleteOption === 'no') {
      log('INFO', `Found ${duplicateGroups.length} duplicate image groups. No files deleted as per user selection.`);
    } else {
      for (const group of duplicateGroups) {
        let keepFile = group[0]; // Default to keeping the first file
        let filesToDelete = [];

        if (deleteOption === 'yes') {
          log('DEBUG', `Prompting for deletion of duplicate group: ${group.join(', ')}`);
          const deleteResponse = await prompts({
            type: 'select',
            name: 'keep',
            message: `Duplicate images found: ${group.join(', ')}. Choose one to keep:`,
            choices: [
              ...group.map(file => ({ title: `Keep ${file}`, value: file })),
              { title: 'Keep all', value: 'keep' },
            ],
            initial: 0,
          });
          if (deleteResponse.keep && deleteResponse.keep !== 'keep') {
            keepFile = deleteResponse.keep;
            filesToDelete = group.filter(file => file !== keepFile);
          }
          log('DEBUG', `User chose to keep ${keepFile ? keepFile : 'all'} for group ${group.join(', ')}`);
        } else if (deleteOption === 'all') {
          filesToDelete = group.slice(1); // Keep first file, delete the rest
          log('DEBUG', `Auto-keeping ${keepFile} and deleting ${filesToDelete.join(', ')} for group ${group.join(', ')}`);
        }

        for (const file of filesToDelete) {
          try {
            await fs.unlink(file);
            log('INFO', `Deleted duplicate image: ${file}`);
            deletedFiles.push(file);
          } catch (error) {
            log('ERROR', `Failed to delete ${file}: ${error.message}`);
            log('DEBUG', `Delete error stack: ${error.stack}`);
          }
        }
      }
      log('INFO', `Found ${duplicateGroups.length} duplicate image groups, deleted ${deletedFiles.length} files.`);
    }

    // Write report
    const timestamp = getTimestamp();
    const reportPath = path.join(OUTPUT_DIR, `duplicate-images-report-${timestamp}.json`);
    const report = {
      duplicateGroups: duplicateGroups,
      deletedFiles: deletedFiles,
      timestamp: new Date().toISOString()
    };
    log('DEBUG', `Creating output directory: ${OUTPUT_DIR}`);
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    log('DEBUG', `Writing report to ${reportPath}`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    log('INFO', `Duplicate images report saved to: ${reportPath}`);

    log('DEBUG', `Find Duplicate Images completed: ${duplicateGroups.length} duplicate groups found, ${deletedFiles.length} deleted`);
    return deletedFiles.length > 0 || duplicateGroups.length > 0 ? 'success' : 'error';
  } catch (error) {
    log('ERROR', `Unexpected error in Find Duplicate Images: ${error.message}`);
    log('DEBUG', `Error stack: ${error.stack}`);
    return 'error';
  }
}

if (require.main === module) {
  findDuplicateImages().then(result => {
    process.exit(result === 'success' ? 0 : 1);
  }).catch(err => {
    log('ERROR', `Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { findDuplicateImages };