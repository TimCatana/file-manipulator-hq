#!/usr/bin/env node

const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
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

async function sortFilesByExtension(args = process.argv.slice(2)) {
  try {
    log('INFO', 'Starting Sort Files By Extension Feature');

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
        const stats = await fs.stat(fullPath);
        files.push({ path: fullPath, stats });
        log('DEBUG', `Found file: ${fullPath}, size: ${stats.size} bytes`);
      }
    }
    log('DEBUG', `Found ${files.length} files in ${inputDir}: ${files.map(f => path.basename(f.path)).join(', ')}`);

    if (files.length === 0) {
      log('INFO', `No files found in ${inputDir}`);
      return 'success';
    }

    // Dynamically determine unique extensions from files
    const uniqueExtensions = new Set(files.map(file => path.extname(file.path).toLowerCase()).filter(ext => ext));
    log('DEBUG', `Detected unique extensions: ${Array.from(uniqueExtensions).join(', ')}`);

    let processed = 0, failed = 0, skipped = 0;

    for (const file of files) {
      const ext = path.extname(file.path).toLowerCase();
      if (!ext) {
        log('DEBUG', `Skipping file with no extension: ${file.path}`);
        skipped++;
        continue;
      }

      const extDir = path.join(outputDir, ext.slice(1));
      log('DEBUG', `Creating extension directory: ${extDir}`);
      await fs.mkdir(extDir, { recursive: true });
      log('DEBUG', `Extension directory created or verified: ${extDir}`);

      const destFile = path.join(extDir, path.basename(file.path));
      log('DEBUG', `Moving ${file.path} to ${destFile}`);
      try {
        await fs.rename(file.path, destFile);
        log('INFO', `Moved ${path.basename(file.path)} to ${ext.slice(1)} folder`);
        try {
          const stats = await fs.stat(destFile);
          log('DEBUG', `Moved file size: ${stats.size} bytes for ${destFile}`);
        } catch (statError) {
          log('DEBUG', `Failed to retrieve file size for ${destFile}: ${statError.message}`);
        }
        processed++;
      } catch (error) {
        log('ERROR', `Failed to move ${file.path} to ${destFile}: ${error.message}`);
        log('DEBUG', `Move error stack: ${error.stack}`);
        failed++;
      }
    }

    log('INFO', `Moved ${processed} files, ${failed} failed, ${skipped} skipped.`);
    log('DEBUG', `Sort Files By Extension completed: ${processed} moved, ${failed} failed, ${skipped} skipped`);
    return failed === 0 ? 'success' : 'error';
  } catch (error) {
    log('ERROR', `Unexpected error in Sort Files By Extension: ${error.message}`);
    log('DEBUG', `Error stack: ${error.stack}`);
    return 'error';
  }
}

if (require.main === module) {
  sortFilesByExtension().then(result => {
    process.exit(result === 'success' ? 0 : 1);
  }).catch(err => {
    log('ERROR', `Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { sortFilesByExtension };