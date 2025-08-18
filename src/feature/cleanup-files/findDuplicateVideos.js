#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');
const pixelmatchModule = require('pixelmatch');
const pixelmatch = pixelmatchModule.default;
const ffmpeg = require('fluent-ffmpeg');
const { log } = require('../../backend/utils/logUtils');

// Configuration
const BASE_DIR = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'bin', 'cleanup-files', 'duplicate-videos');

log('DEBUG', `Pixelmatch module loaded: ${typeof pixelmatch}`);
log('DEBUG', `Sharp module loaded: ${typeof sharp}`);
log('DEBUG', `Fluent-ffmpeg module loaded: ${typeof ffmpeg}`);

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

function checkFFmpeg() {
  log('DEBUG', 'Checking for FFmpeg and ffprobe installation');
  try {
    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err) => {
        if (err) {
          log('ERROR', 'FFmpeg or ffprobe is not installed or not in PATH.');
          log('DEBUG', `FFmpeg/ffprobe check failed: ${err.message}`);
          resolve(false);
        } else {
          log('INFO', 'FFmpeg and ffprobe detected');
          log('DEBUG', 'FFmpeg and ffprobe check successful');
          resolve(true);
        }
      });
    });
  } catch (error) {
    log('ERROR', 'FFmpeg or ffprobe is not installed or not in PATH.');
    log('DEBUG', `FFmpeg/ffprobe check failed: ${error.message}`);
    return Promise.resolve(false);
  }
}

async function getVideoDuration(videoPath, inputDir) {
  try {
    log('DEBUG', `Retrieving duration for ${path.relative(inputDir, videoPath)}`, { basePath: inputDir });
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          log('ERROR', `Failed to get duration for ${path.relative(inputDir, videoPath)}: ${err.message}`, { basePath: inputDir });
          return reject(err);
        }
        const duration = parseFloat(metadata.format.duration);
        log('DEBUG', `Duration of ${path.relative(inputDir, videoPath)}: ${duration} seconds`, { basePath: inputDir });
        resolve(duration);
      });
    });
  } catch (error) {
    log('ERROR', `Failed to get duration for ${path.relative(inputDir, videoPath)}: ${error.message}`, { basePath: inputDir });
    log('DEBUG', `Duration retrieval error stack: ${error.stack}`);
    return null;
  }
}

async function extractKeyframes(videoPath, tempDir, inputDir) {
  const duration = await getVideoDuration(videoPath, inputDir);
  if (!duration) return null;

  const keyframes = [];
  const positions = duration > 3 ? [0.1, 0.5, 0.9] : [0.5];
  log('DEBUG', `Extracting keyframes for ${path.relative(inputDir, videoPath)} at positions: ${positions.join(', ')}`, { basePath: inputDir });

  for (const pos of positions) {
    const time = duration * pos;
    const tempFile = path.join(tempDir, `keyframe-${crypto.randomBytes(8).toString('hex')}.png`);
    try {
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .seekInput(time)
          .frames(1)
          .output(tempFile)
          .outputOptions('-y')
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      const buffer = await fs.readFile(tempFile);
      keyframes.push(buffer);
      await fs.unlink(tempFile).catch(err => log('DEBUG', `Failed to delete temp file ${path.relative(tempDir, tempFile)}: ${err.message}`, { basePath: tempDir }));
    } catch (error) {
      log('ERROR', `Failed to extract keyframe at ${time}s from ${path.relative(inputDir, videoPath)}: ${error.message}`, { basePath: inputDir });
      log('DEBUG', `Keyframe extraction error stack: ${error.stack}`);
      return null;
    }
  }
  return keyframes;
}

async function areVideosIdentical(video1Path, video2Path, tempDir, inputDir) {
  try {
    log('DEBUG', `Comparing videos: ${path.relative(inputDir, video1Path)} vs ${path.relative(inputDir, video2Path)}`, { basePath: inputDir });

    const duration1 = await getVideoDuration(video1Path, inputDir);
    const duration2 = await getVideoDuration(video2Path, inputDir);
    if (duration1 === null || duration2 === null) {
      log('DEBUG', `Duration retrieval failed for one or both videos`);
      return false;
    }
    if (Math.abs(duration1 - duration2) > 0.01) {
      log('DEBUG', `Videos have different durations: ${duration1}s vs ${duration2}s`);
      return false;
    }
    log('DEBUG', `Durations match: ${duration1}s`);

    const keyframes1 = await extractKeyframes(video1Path, tempDir, inputDir);
    const keyframes2 = await extractKeyframes(video2Path, tempDir, inputDir);

    if (!keyframes1 || !keyframes2 || keyframes1.length !== keyframes2.length) {
      log('DEBUG', `Keyframe extraction failed or mismatched keyframe count`);
      return false;
    }

    for (let i = 0; i < keyframes1.length; i++) {
      const buffer1 = keyframes1[i];
      const buffer2 = keyframes2[i];

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

      log('DEBUG', `Keyframe ${i + 1}: ${info1.width}x${info1.height}, channels: ${info1.channels}, size: ${data1.length}`);
      log('DEBUG', `Keyframe ${i + 1}: ${info2.width}x${info2.height}, channels: ${info2.channels}, size: ${data2.length}`);

      if (info1.width !== info2.width || info1.height !== info2.height || info1.channels !== info2.channels) {
        log('DEBUG', `Keyframes ${i + 1} differ in dimensions or channels`);
        return false;
      }

      const hash1 = crypto.createHash('md5').update(data1).digest('hex');
      const hash2 = crypto.createHash('md5').update(data2).digest('hex');
      log('DEBUG', `Keyframe ${i + 1} hashes: ${hash1} vs ${hash2}`);

      if (hash1 === hash2) {
        log('DEBUG', `Keyframes ${i + 1} identical by hash`);
        continue;
      }

      log('DEBUG', `Performing pixelmatch comparison on keyframes ${i + 1}`);
      if (typeof pixelmatch !== 'function') {
        log('ERROR', `Pixelmatch is not a function, falling back to hash comparison`);
        return false;
      }
      const diffPixels = pixelmatch(data1, data2, null, info1.width, info1.height, { threshold: 0.1 });
      log('DEBUG', `Pixel differences for keyframe ${i + 1}: ${diffPixels}`);
      if (diffPixels >= 200) {
        return false;
      }
    }
    log('DEBUG', `All keyframes match, videos are identical`);
    return true;
  } catch (error) {
    log('ERROR', `Video comparison failed: ${error.message}`);
    log('DEBUG', `Comparison error stack: ${error.stack}`);
    return false;
  }
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

async function findDuplicateVideos(args = process.argv.slice(2)) {
  try {
    log('INFO', 'Starting Find Duplicate Videos Feature');

    const ffmpegAvailable = await checkFFmpeg();
    if (!ffmpegAvailable) {
      log('ERROR', 'Required tools FFmpeg or ffprobe not installed.');
      return 'error';
    }

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
        message: 'Enter the directory containing videos to check for duplicates (or press Enter to cancel):',
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
        message: 'Do you want to delete duplicate videos? (No: List duplicates only, Yes: Prompt to keep one of each duplicate group, All: Keep first video of each group without prompting)',
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

    const tempDir = path.join(BASE_DIR, 'bin', `temp-${crypto.randomBytes(8).toString('hex')}`);
    log('DEBUG', `Creating temporary directory: ${path.relative(BASE_DIR, tempDir)}`, { basePath: BASE_DIR });
    if (!path.resolve(tempDir).startsWith(path.resolve(BASE_DIR))) {
      log('ERROR', `Temporary directory ${tempDir} is outside project root.`, { sanitizePaths: false });
      return 'error';
    }
    await fs.mkdir(tempDir, { recursive: true });

    log('DEBUG', `Reading directory: ${path.relative(inputDir, inputDir)}`, { basePath: inputDir });
    const dirEntries = await fs.readdir(inputDir);
    const videoExtensions = ['.mp4', '.webm'];
    const files = [];
    for (const entry of dirEntries) {
      const fullPath = path.join(inputDir, entry);
      const stats = await fs.stat(fullPath);
      if (stats.isFile() && videoExtensions.includes(path.extname(fullPath).toLowerCase()) && isValidFilePath(fullPath)) {
        files.push(fullPath);
      }
    }
    log('DEBUG', `Found ${files.length} video files in ${path.relative(inputDir, inputDir)}: ${files.map(f => path.relative(inputDir, f)).join(', ')}`, { basePath: inputDir });

    if (files.length === 0) {
      log('INFO', `No video files found in ${path.relative(inputDir, inputDir)}`, { basePath: inputDir });
      const timestamp = getTimestamp();
      const reportPath = path.join(OUTPUT_DIR, `duplicate-videos-report-${timestamp}.json`);
      const report = {
        duplicateGroups: [],
        deletedFiles: [],
        timestamp: new Date().toISOString()
      };
      log('DEBUG', `Creating output directory: ${path.relative(BASE_DIR, OUTPUT_DIR)}`, { basePath: BASE_DIR });
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
      log('DEBUG', `Writing report to ${path.relative(BASE_DIR, reportPath)}`, { basePath: BASE_DIR });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      log('INFO', `Duplicate videos report saved to: ${path.relative(BASE_DIR, reportPath)}`, { basePath: BASE_DIR });
      await fs.rm(tempDir, { recursive: true, force: true }).catch(err => log('DEBUG', `Failed to delete temp dir ${path.relative(BASE_DIR, tempDir)}: ${err.message}`, { basePath: BASE_DIR }));
      return 'success';
    }

    log('INFO', `Processing ${files.length} video files for duplicates`);
    const processedFiles = new Set();
    const duplicateGroups = [];
    const deletedFiles = [];

    for (let i = 0; i < files.length; i++) {
      if (processedFiles.has(files[i])) continue;
      const currentGroup = [files[i]];
      for (let j = i + 1; j < files.length; j++) {
        if (processedFiles.has(files[j])) continue;
        log('DEBUG', `Comparing ${path.relative(inputDir, files[i])} with ${path.relative(inputDir, files[j])}`, { basePath: inputDir });
        if (await areVideosIdentical(files[i], files[j], tempDir, inputDir)) {
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
      log('INFO', 'No duplicate videos found.');
      const timestamp = getTimestamp();
      const reportPath = path.join(OUTPUT_DIR, `duplicate-videos-report-${timestamp}.json`);
      const report = {
        duplicateGroups: [],
        deletedFiles: [],
        timestamp: new Date().toISOString()
      };
      log('DEBUG', `Creating output directory: ${path.relative(BASE_DIR, OUTPUT_DIR)}`, { basePath: BASE_DIR });
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
      log('DEBUG', `Writing report to ${path.relative(BASE_DIR, reportPath)}`, { basePath: BASE_DIR });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      log('INFO', `Duplicate videos report saved to: ${path.relative(BASE_DIR, reportPath)}`, { basePath: BASE_DIR });
      await fs.rm(tempDir, { recursive: true, force: true }).catch(err => log('DEBUG', `Failed to delete temp dir ${path.relative(BASE_DIR, tempDir)}: ${err.message}`, { basePath: BASE_DIR }));
      return 'success';
    }

    if (deleteOption === 'no') {
      log('INFO', `Found ${duplicateGroups.length} duplicate video groups. No files deleted as per user selection.`);
    } else {
      for (const group of duplicateGroups) {
        let keepFile = group[0];
        let filesToDelete = [];

        if (deleteOption === 'yes') {
          log('DEBUG', `Prompting for deletion of duplicate group: ${group.map(f => path.relative(inputDir, f)).join(', ')}`, { basePath: inputDir });
          const deleteResponse = await prompts({
            type: 'select',
            name: 'keep',
            message: `Duplicate videos found: ${group.map(f => path.relative(inputDir, f)).join(', ')}. Choose one to keep:`,
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
            log('INFO', `Deleted duplicate video: ${path.relative(inputDir, file)}`, { basePath: inputDir });
            deletedFiles.push(file);
          } catch (error) {
            log('ERROR', `Failed to delete ${path.relative(inputDir, file)}: ${error.message}`, { basePath: inputDir });
            log('DEBUG', `Delete error stack: ${error.stack}`);
          }
        }
      }
      log('INFO', `Found ${duplicateGroups.length} duplicate video groups, deleted ${deletedFiles.length} files.`);
    }

    const timestamp = getTimestamp();
    const reportPath = path.join(OUTPUT_DIR, `duplicate-videos-report-${timestamp}.json`);
    const report = {
      duplicateGroups: duplicateGroups.map(group => group.map(file => path.relative(inputDir, file))),
      deletedFiles: deletedFiles.map(file => path.relative(inputDir, file)),
      timestamp: new Date().toISOString()
    };
    log('DEBUG', `Creating output directory: ${path.relative(BASE_DIR, OUTPUT_DIR)}`, { basePath: BASE_DIR });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    log('DEBUG', `Writing report to ${path.relative(BASE_DIR, reportPath)}`, { basePath: BASE_DIR });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    log('INFO', `Duplicate videos report saved to: ${path.relative(BASE_DIR, reportPath)}`, { basePath: BASE_DIR });

    await fs.rm(tempDir, { recursive: true, force: true }).catch(err => log('DEBUG', `Failed to delete temp dir ${path.relative(BASE_DIR, tempDir)}: ${err.message}`, { basePath: BASE_DIR }));

    log('DEBUG', `Find Duplicate Videos completed: ${duplicateGroups.length} duplicate groups found, ${deletedFiles.length} deleted`);
    return deletedFiles.length > 0 || duplicateGroups.length > 0 ? 'success' : 'error';
  } catch (error) {
    log('ERROR', `Unexpected error in Find Duplicate Videos: ${error.message}`);
    log('DEBUG', `Error stack: ${error.stack}`);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(err => log('DEBUG', `Failed to delete temp dir ${path.relative(BASE_DIR, tempDir)}: ${err.message}`, { basePath: BASE_DIR }));
    return 'error';
  }
}

if (require.main === module) {
  findDuplicateVideos().then(result => {
    process.exit(result === 'success' ? 0 : 1);
  }).catch(err => {
    log('ERROR', `Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { findDuplicateVideos };