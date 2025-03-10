#!/usr/bin/env node

const fs = require('fs');
const sharp = require('sharp');
const axios = require('axios');
const path = require('path');
const prompts = require('prompts');

// Configuration
const OUTPUT_DIR = path.join(__dirname, '..', 'bin', 'processed_images');
const VALID_METHODS = ['crop', 'stretch'];

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Image processing function (unchanged)
async function processImage(imageSource, isLocal, outputPath, method, width, height) {
    try {
        let image;
        if (isLocal) {
            const absoluteImagePath = path.resolve(__dirname, imageSource);
            if (!fs.existsSync(absoluteImagePath)) {
                throw new Error(`Local file not found at ${absoluteImagePath}`);
            }
            image = sharp(absoluteImagePath);
        } else {
            const response = await axios({
                url: imageSource,
                responseType: 'arraybuffer',
            });
            image = sharp(Buffer.from(response.data));
        }

        if (method === 'stretch') {
            await image
                .resize(width, height, { fit: 'fill' })
                .toFile(outputPath);
            console.log(`Stretched and saved: ${path.relative(__dirname, outputPath)} (${width}x${height})`);
        } else if (method === 'crop') {
            const metadata = await image.metadata();
            const aspectRatio = width / height;
            let newWidth, newHeight;

            if (metadata.width / metadata.height > aspectRatio) {
                newHeight = height;
                newWidth = Math.round(height * (metadata.width / metadata.height));
            } else {
                newWidth = width;
                newHeight = Math.round(width * (metadata.height / metadata.width));
            }

            await image
                .resize(newWidth, newHeight)
                .extract({
                    left: Math.round((newWidth - width) / 2),
                    top: Math.round((newHeight - height) / 2),
                    width: width,
                    height: height,
                })
                .toFile(outputPath);
            console.log(`Cropped and saved: ${path.relative(__dirname, outputPath)} (${width}x${height})`);
        } else {
            throw new Error(`Invalid method: ${method}`);
        }
        return { success: true };
    } catch (error) {
        console.error(`Error processing ${imageSource}:`, error.message);
        return { success: false, reason: `Failed to process image: ${error.message}` };
    }
}

// Main function
async function main() {
    let sourceType; // Variable to store sourceType

    const formatChoices = [
        { title: 'Instagram (1080x1080)', value: { width: 1080, height: 1080 } },
        { title: 'Facebook (1200x630)', value: { width: 1200, height: 630 } },
        { title: 'Pinterest (1000x1500)', value: { width: 1000, height: 1500 } },
        { title: 'Custom size', value: 'custom' }
    ];

    const questions = [
        {
            type: 'select',
            name: 'sourceType',
            message: 'Choose image source:',
            choices: [
                { title: 'Local file', value: 'local' },
                { title: 'Online URL', value: 'url' },
            ],
            initial: 0,
            onSubmit: (name, value) => {
                sourceType = value; // Capture sourceType after selection
            }
        },
        {
            type: 'text',
            name: 'imageSource',
            message: (prev) => prev === 'local' 
                ? 'Enter the file path relative to script (e.g., ../bin/lol.png):' 
                : 'Enter the image URL:',
            validate: async (value) => {
                if (sourceType === 'local') {
                    const absolutePath = path.resolve(__dirname, value);
                    if (!fs.existsSync(absolutePath)) {
                        throw new Error(`Invalid file path: File not found at ${absolutePath}`);
                    }
                    return true;
                }
                return value.trim() !== '' ? true : 'URL cannot be empty';
            }
        },
        {
            type: 'select',
            name: 'format',
            message: 'Choose output format:',
            choices: formatChoices,
            initial: 0
        },
        {
            type: prev => prev === 'custom' ? 'number' : null,
            name: 'width',
            message: 'Enter custom width (pixels):',
            validate: value => value > 0 ? true : 'Width must be greater than 0'
        },
        {
            type: prev => prev === 'custom' ? 'number' : null,
            name: 'height',
            message: 'Enter custom height (pixels):',
            validate: value => value > 0 ? true : 'Height must be greater than 0'
        },
        {
            type: 'select',
            name: 'method',
            message: 'Choose resize method:',
            choices: [
                { title: 'Crop', value: 'crop' },
                { title: 'Stretch', value: 'stretch' },
            ],
            initial: 0
        }
    ];

    const args = process.argv.slice(2);
    
    let imageSource, isLocal, width, height, method;

    // Command line arguments mode
    if (args.length >= 4) {
        isLocal = args[0] === 'local';
        imageSource = args[1];
        method = args[2];
        
        if (args[3] === 'instagram') {
            width = 1080;
            height = 1080;
        } else if (args[3] === 'facebook') {
            width = 1200;
            height = 630;
        } else if (args[3] === 'pinterest') {
            width = 1000;
            height = 1500;
        } else if (args.length === 6 && args[3] === 'custom') {
            width = parseInt(args[4]);
            height = parseInt(args[5]);
        } else {
            console.error('Invalid format. Use: instagram, facebook, pinterest, or custom <width> <height>');
            process.exit(1);
        }

        if (!VALID_METHODS.includes(method)) {
            console.error(`Invalid method. Use: ${VALID_METHODS.join(', ')}`);
            process.exit(1);
        }

        if (isLocal) {
            const absoluteImagePath = path.resolve(__dirname, imageSource);
            if (!fs.existsSync(absoluteImagePath)) {
                console.error(`Invalid file path: File not found at ${absoluteImagePath}`);
                process.exit(1);
            }
        }
    } else {
        // Interactive prompt mode
        try {
            const response = await prompts(questions);
            
            if (!response.imageSource) {
                console.log('Process cancelled');
                process.exit(0);
            }

            imageSource = response.imageSource;
            isLocal = response.sourceType === 'local';
            method = response.method;

            if (response.format === 'custom') {
                width = response.width;
                height = response.height;
            } else {
                width = response.format.width;
                height = response.format.height;
            }
        } catch (error) {
            console.error(error.message);
            process.exit(1);
        }
    }

    const filename = `processed_${Date.now()}_${width}x${height}.jpg`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    const result = await processImage(imageSource, isLocal, outputPath, method, width, height);
    
    if (result.success) {
        console.log('Image processing completed successfully');
    } else {
        console.error('Image processing failed:', result.reason);
        process.exit(1);
    }
}

// Display help (unchanged)
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Usage:
  node imageSizeReformatter.js <sourceType> <imageSource> <method> <format> [width] [height]
  node imageSizeReformatter.js (interactive mode)
  node imageSizeReformatter.js --help

Arguments:
  <sourceType>       'local' or 'url'
  <imageSource>      File path relative to script (for local) or URL (for url)
  <method>          Resize method: crop or stretch
  <format>          instagram, facebook, pinterest, or custom
  [width] [height]  Required if format is 'custom'

Examples:
  node imageSizeReformatter.js local ../bin/lol.png crop instagram
  node imageSizeReformatter.js url https://example.com/image.jpg stretch facebook
  node imageSizeReformatter.js local ./images/photo.png crop custom 800 600

Input:
  Local files are read relative to the script location (e.g., ../bin/lol.png)
  URLs are fetched from the web

Output:
  Processed images are saved to ../bin/processed_images/ relative to the script location
`);
    process.exit(0);
}

// Run the script
main().catch(error => {
    console.error('An unexpected error occurred:', error.message);
    process.exit(1);
});