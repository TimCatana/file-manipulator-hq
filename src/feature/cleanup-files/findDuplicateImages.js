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
const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'bin', 'cleanup-files', 'duplicate-images');

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
        if (args[i + 1] && !args[i + 1].startsWith('--')) i++;
      }
    }
  }
  return params;
}

function isValidFilePath(filePath) {
  const validPathRegex = /^[a-zA-Z0-9._-][a-zA-Z0-9._-]*(?:\.[a-zA-Z0-9]+)?$/;
  return validPathRegex.test(path.basename(filePath));
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
      return false;
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
      inputDir = path.resolve(params['input']);
      try {
        await fs.access(inputDir);
        log('DEBUG', `Input directory from args: ${inputDir}`, { basePath: inputDir });
        const forbiddenDirs = ['/etc', '/usr', '/var', '/bin', '/sbin', 'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)'];
        if (forbiddenDirs.some(dir => inputDir.startsWith(path.resolve(dir)))) {
          log('ERROR', `Input directory ${inputDir} is a system directory and cannot be processed.`, { sanitizePaths: false });
          return 'error';
        }
      } catch {
        log('ERROR', `Input directory not found: ${inputDir}`, { basePath: inputDir });
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
            const resolvedDir = path.resolve(value);
            const forbiddenDirs = ['/etc', '/usr', '/var', '/bin', '/sbin', 'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)'];
            if (forbiddenDirs.some(dir => resolvedDir.startsWith(path.resolve(dir)))) {
              return 'System directory not allowed.';
            }
            return true;
          } catch {
            return 'Directory not found.';
          }
        }
      });
      inputDir = inputDirResponse.dir ? path.resolve(inputDirResponse.dir) : null;
      log('DEBUG', `Input directory provided: ${inputDir}`, { basePath: inputDir });
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

    if (deleteOption === 'all') {
      const confirmResponse = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: 'WARNING: --delete all will delete all but the first file in each duplicate group without further prompts. Continue?',
        initial: false
      });
      if (!confirmResponse.confirm) {
        log('INFO', 'Deletion cancelled by user.');
        return 'cancelled';
      }
    }

    log('DEBUG', `Reading directory: ${path.relative(inputDir, inputDir)}`, { basePath: inputDir });
    const dirEntries = await fs.readdir(inputDir);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const files = [];
    for (const entry of dirEntries) {
      const fullPath = path.join(inputDir, entry);
      const stats = await fs.stat(fullPath);
      if (stats.isFile() && imageExtensions.includes(path.extname(fullPath).toLowerCase()) && isValidFilePath(fullPath)) {
        files.push(fullPath);
      }
    }
    log('DEBUG', `Found ${files.length} image files in ${path.relative(inputDir, inputDir)}: ${files.map(f => path.relative(inputDir, f)).join(', ')}`, { basePath: inputDir });

    if (files.length === 0) {
      log('INFO', `No image files found in ${path.relative(inputDir, inputDir)}`, { basePath: inputDir });
      const timestamp = getTimestamp();
      const reportPath = path.join(OUTPUT_DIR, `duplicate-images-report-${timestamp}.json`);
      const report = {
        duplicateGroups: [],
        deletedFiles: [],
        timestamp: new Date().toISOString()
      };
      log('DEBUG', `Creating output directory: ${path.relative(BASE_DIR, OUTPUT_DIR)}`, { basePath: BASE_DIR });
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
      log('DEBUG', `Writing report to ${path.relative(BASE_DIR, reportPath)}`, { basePath: BASE_DIR });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      log('INFO', `Duplicate images report saved to: ${path.relative(BASE_DIR, reportPath)}`, { basePath: BASE_DIR });
      return 'success';
    }

    log('INFO', `Processing ${files.length} image files for duplicates`);
    const processedFiles = new Set();
    const duplicateGroups = [];
    const deletedFiles = [];

    for (let i = 0; i < files.length; i++) {
      if (processedFiles.has(files[i])) continue;
      const currentGroup = [files[i]];
      const buffer1 = await fs.readFile(files[i]);
      for (let j = i + 1; j < files.length; j++) {
        if (processedFiles.has(files[j])) continue;
        const buffer2 = await fs.readFile(files[j]);
        log('DEBUG', `Comparing ${path.relative(inputDir, files[i])} with ${path.relative(inputDir, files[j])}`, { basePath: inputDir });
        if (await areImagesIdentical(buffer1, buffer2)) {
          currentGroup.push(files[j]);
          processedFiles.add(files[j]);
        }
      }
      processedFiles.add(files[i]);
      if (currentGroup.length > 1) {
        duplicateGroups.push(currentGroup);
        log('INFO', `Found duplicate group: ${currentGroup.map(f => path.relative(inputDir, f)).join(', ')}`, { basePath: inputDir });
      }
    }

    if (duplicateGroups.length === 0) {
      log('INFO', 'No duplicate images found.');
      const timestamp = getTimestamp();
      const reportPath = path.join(OUTPUT_DIR, `duplicate-images-report-${timestamp}.json`);
      const report = {
        duplicateGroups: [],
        deletedFiles: [],
        timestamp: new Date().toISOString()
      };
      log('DEBUG', `Creating output directory: ${path.relative(BASE_DIR, OUTPUT_DIR)}`, { basePath: BASE_DIR });
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
      log('DEBUG', `Writing report to ${path.relative(BASE_DIR, reportPath)}`, { basePath: BASE_DIR });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      log('INFO', `Duplicate images report saved to: ${path.relative(BASE_DIR, reportPath)}`, { basePath: BASE_DIR });
      return 'success';
    }

    if (deleteOption === 'no') {
      log('INFO', `Found ${duplicateGroups.length} duplicate image groups. No files deleted as per user selection.`);
    } else {
      for (const group of duplicateGroups) {
        let keepFile = group[0];
        let filesToDelete = [];

        if (deleteOption === 'yes') {
          log('DEBUG', `Prompting for deletion of duplicate group: ${group.map(f => path.relative(inputDir, f)).join(', ')}`, { basePath: inputDir });
          const deleteResponse = await prompts({
            type: 'select',
            name: 'keep',
            message: `Duplicate images found: ${group.map(f => path.relative(inputDir, f)).join(', ')}. Choose one to keep:`,
            choices: [
              ...group.map(file => ({ title: `Keep ${path.relative(inputDir, file)}`, value: file })),
              { title: 'Keep all', value: 'keep' },
            ],
            initial: 0,
          });
          if (deleteResponse.keep && deleteResponse.keep !== 'keep') {
            keepFile = deleteResponse.keep;
            filesToDelete = group.filter(file => file !== keepFile);
          }
          log('DEBUG', `User chose to keep ${keepFile ? path.relative(inputDir, keepFile) : 'all'} for group ${group.map(f => path.relative(inputDir, f)).join(', ')}`, { basePath: inputDir });
        } else if (deleteOption === 'all') {
          filesToDelete = group.slice(1);
          log('DEBUG', `Auto-keeping ${path.relative(inputDir, keepFile)} and deleting ${filesToDelete.map(f => path.relative(inputDir, f)).join(', ')} for group ${group.map(f => path.relative(inputDir, f)).join(', ')}`, { basePath: inputDir });
        }

        for (const file of filesToDelete) {
          try {
            const stats = await fs.stat(file);
            log('DEBUG', `Deleting file ${path.relative(inputDir, file)}, size: ${stats.size} bytes`, { basePath: inputDir });
            await fs.unlink(file);
            log('INFO', `Deleted duplicate image: ${path.relative(inputDir, file)}`, { basePath: inputDir });
            deletedFiles.push(file);
          } catch (error) {
            log('ERROR', `Failed to delete ${path.relative(inputDir, file)}: ${error.message}`, { basePath: inputDir });
            log('DEBUG', `Delete error stack: ${error.stack}`);
          }
        }
      }
      log('INFO', `Found ${duplicateGroups.length} duplicate image groups, deleted ${deletedFiles.length} files.`);
    }

    const timestamp = getTimestamp();
    const reportPath = path.join(OUTPUT_DIR, `duplicate-images-report-${timestamp}.json`);
    const report = {
      duplicateGroups: duplicateGroups.map(group => group.map(file => path.relative(inputDir, file))),
      deletedFiles: deletedFiles.map(file => path.relative(inputDir, file)),
      timestamp: new Date().toISOString()
    };
    log('DEBUG', `Creating output directory: ${path.relative(BASE_DIR, OUTPUT_DIR)}`, { basePath: BASE_DIR });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    log('DEBUG', `Writing report to ${path.relative(BASE_DIR, reportPath)}`, { basePath: BASE_DIR });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    log('INFO', `Duplicate images report saved to: ${path.relative(BASE_DIR, reportPath)}`, { basePath: BASE_DIR });

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