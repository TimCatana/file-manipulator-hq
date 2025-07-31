#!/usr/bin/env node

require('dotenv').config();
const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { log } = require('../../backend/utils/logUtils');

function parseArgs(args) {
    const params = {};
    const validFlags = [
        'prompt', 'seed', 'resolution', 'aspect-ratio', 'rendering-speed',
        'magic-prompt', 'negative-prompt', 'num-images', 'color-palette',
        'style-codes', 'style-type', 'style-reference-images'
    ];
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const flag = args[i].slice(2);
            if (!validFlags.includes(flag)) {
                log('ERROR', `Invalid argument: --${flag}`);
                return { error: true, message: `Invalid argument: --${flag}` };
            }
            const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : '';
            params[flag] = value;
            i++;
        }
    }
    return params;
}

// Map user-friendly resolution format (WIDTHxHEIGHT) to API format (RESOLUTION_WIDTH_HEIGHT)
const resolutionMap = {
    '512x1536': 'RESOLUTION_512_1536',
    '576x1408': 'RESOLUTION_576_1408',
    '576x1472': 'RESOLUTION_576_1472',
    '576x1536': 'RESOLUTION_576_1536',
    '640x1024': 'RESOLUTION_640_1024',
    '640x1344': 'RESOLUTION_640_1344',
    '640x1408': 'RESOLUTION_640_1408',
    '640x1472': 'RESOLUTION_640_1472',
    '640x1536': 'RESOLUTION_640_1536',
    '704x1152': 'RESOLUTION_704_1152',
    '704x1216': 'RESOLUTION_704_1216',
    '704x1280': 'RESOLUTION_704_1280',
    '704x1344': 'RESOLUTION_704_1344',
    '704x1408': 'RESOLUTION_704_1408',
    '704x1472': 'RESOLUTION_704_1472',
    '720x1280': 'RESOLUTION_720_1280',
    '736x1312': 'RESOLUTION_736_1312',
    '768x1024': 'RESOLUTION_768_1024',
    '768x1088': 'RESOLUTION_768_1088',
    '768x1152': 'RESOLUTION_768_1152',
    '768x1216': 'RESOLUTION_768_1216',
    '768x1232': 'RESOLUTION_768_1232',
    '768x1280': 'RESOLUTION_768_1280',
    '768x1344': 'RESOLUTION_768_1344',
    '832x960': 'RESOLUTION_832_960',
    '832x1024': 'RESOLUTION_832_1024',
    '832x1088': 'RESOLUTION_832_1088',
    '832x1152': 'RESOLUTION_832_1152',
    '832x1216': 'RESOLUTION_832_1216',
    '832x1248': 'RESOLUTION_832_1248',
    '864x1152': 'RESOLUTION_864_1152',
    '896x960': 'RESOLUTION_896_960',
    '896x1024': 'RESOLUTION_896_1024',
    '896x1088': 'RESOLUTION_896_1088',
    '896x1120': 'RESOLUTION_896_1120',
    '896x1152': 'RESOLUTION_896_1152',
    '960x832': 'RESOLUTION_960_832',
    '960x896': 'RESOLUTION_960_896',
    '960x1024': 'RESOLUTION_960_1024',
    '960x1088': 'RESOLUTION_960_1088',
    '1024x640': 'RESOLUTION_1024_640',
    '1024x768': 'RESOLUTION_1024_768',
    '1024x832': 'RESOLUTION_1024_832',
    '1024x896': 'RESOLUTION_1024_896',
    '1024x960': 'RESOLUTION_1024_960',
    '1024x1024': 'RESOLUTION_1024_1024',
    '1088x768': 'RESOLUTION_1088_768',
    '1088x832': 'RESOLUTION_1088_832',
    '1088x896': 'RESOLUTION_1088_896',
    '1088x960': 'RESOLUTION_1088_960',
    '1120x896': 'RESOLUTION_1120_896',
    '1152x704': 'RESOLUTION_1152_704',
    '1152x768': 'RESOLUTION_1152_768',
    '1152x832': 'RESOLUTION_1152_832',
    '1152x864': 'RESOLUTION_1152_864',
    '1152x896': 'RESOLUTION_1152_896',
    '1216x704': 'RESOLUTION_1216_704',
    '1216x768': 'RESOLUTION_1216_768',
    '1216x832': 'RESOLUTION_1216_832',
    '1232x768': 'RESOLUTION_1232_768',
    '1248x832': 'RESOLUTION_1248_832',
    '1280x704': 'RESOLUTION_1280_704',
    '1280x720': 'RESOLUTION_1280_720',
    '1280x768': 'RESOLUTION_1280_768',
    '1280x800': 'RESOLUTION_1280_800',
    '1312x736': 'RESOLUTION_1312_736',
    '1344x640': 'RESOLUTION_1344_640',
    '1344x704': 'RESOLUTION_1344_704',
    '1344x768': 'RESOLUTION_1344_768',
    '1408x576': 'RESOLUTION_1408_576',
    '1408x640': 'RESOLUTION_1408_640',
    '1408x704': 'RESOLUTION_1408_704',
    '1472x576': 'RESOLUTION_1472_576',
    '1472x640': 'RESOLUTION_1472_640',
    '1472x704': 'RESOLUTION_1472_704',
    '1536x512': 'RESOLUTION_1536_512',
    '1536x576': 'RESOLUTION_1536_576',
    '1536x640': 'RESOLUTION_1536_640'
};

// Load or initialize config.json
async function loadConfig() {
    const configPath = path.resolve(__dirname, '../../../json/config.json');
    try {
        await fs.access(configPath);
        const configData = await fs.readFile(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        log('DEBUG', `Config file not found, creating new at ${configPath}`);
        return {};
    }
}

async function saveConfig(config) {
    const configPath = path.resolve(__dirname, '../../../json/config.json');
    try {
        await fs.mkdir(path.dirname(configPath), { recursive: true });
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        log('DEBUG', `Config saved to ${configPath}`);
    } catch (error) {
        log('ERROR', `Failed to save config: ${error.message}`);
    }
}

async function generateIdeogramImage(args = process.argv.slice(2)) {
    try {
        log('INFO', 'Starting Generate Ideogram Image Feature');

        const params = parseArgs(args);
        if (params.error) return 'error';

        const outputDir = path.resolve(__dirname, '../../../bin/generateImages/ideogram');
        try {
            await fs.mkdir(outputDir, { recursive: true });
            log('DEBUG', `Output directory: ${outputDir}`);
        } catch (error) {
            log('ERROR', `Failed to create output directory: ${outputDir}`);
            return 'error';
        }

        // Load config for previous selections
        const config = await loadConfig();
        const ideogramConfig = config.ideogram_image_generation || {
            resolution: undefined,
            aspect_ratio: '1x1',
            rendering_speed: 'DEFAULT',
            magic_prompt: 'AUTO',
            style_type: 'GENERAL'
        };

        let imagePrompt = params['prompt'];
        if (!imagePrompt) {
            log('DEBUG', 'Prompting for image prompt');
            const promptResponse = await prompts({
                type: 'text',
                name: 'prompt',
                message: 'Enter the prompt for the Ideogram image (e.g., "A futuristic city at night"):',
                validate: value => value.trim() !== '' ? true : 'Prompt required.'
            });
            imagePrompt = promptResponse.prompt;
            log('DEBUG', `Image prompt provided: ${imagePrompt}`);
            if (!imagePrompt) {
                log('INFO', 'No prompt provided, cancelling...');
                return 'cancelled';
            }
        }

        let seed = params['seed'] ? parseInt(params['seed']) : undefined;
        if (!params['seed']) {
            log('DEBUG', 'Prompting for seed');
            const seedResponse = await prompts({
                type: 'number',
                name: 'seed',
                message: 'Enter a random seed (0 to 2147483647, or press Enter to skip):',
                validate: value => value === '' || (value >= 0 && value <= 2147483647) ? true : 'Seed must be between 0 and 2147483647'
            });
            seed = seedResponse.seed !== '' ? seedResponse.seed : undefined;
            log('DEBUG', `Seed provided: ${seed}`);
        }

        let resolution = params['resolution'] || ideogramConfig.resolution;
        if (!params['resolution']) {
            log('DEBUG', 'Prompting for resolution');
            const resolutionChoices = [
                { title: 'None (use aspect_ratio)', value: undefined },
                ...Object.keys(resolutionMap).map(res => ({ title: res, value: res }))
            ];
            const initialResolutionIndex = resolution ? resolutionChoices.findIndex(choice => choice.value === resolution) : 0;
            const resolutionResponse = await prompts({
                type: 'select',
                name: 'resolution',
                message: 'Choose a resolution (or press Enter for default: last used or none):',
                choices: resolutionChoices,
                initial: initialResolutionIndex >= 0 ? initialResolutionIndex : 0
            });
            resolution = resolutionResponse.resolution;
            log('DEBUG', `Resolution provided: ${resolution}`);
        }

        let aspectRatio = params['aspect-ratio'] || ideogramConfig.aspect_ratio;
        if (!params['aspect-ratio']) {
            log('DEBUG', 'Prompting for aspect ratio');
            const aspectRatioChoices = [
                { title: '1:1', value: '1x1' },
                { title: '1:3', value: '1x3' },
                { title: '3:1', value: '3x1' },
                { title: '1:2', value: '1x2' },
                { title: '2:1', value: '2x1' },
                { title: '9:16', value: '9x16' },
                { title: '16:9', value: '16x9' },
                { title: '10:16', value: '10x16' },
                { title: '16:10', value: '16x10' },
                { title: '2:3', value: '2x3' },
                { title: '3:2', value: '3x2' },
                { title: '3:4', value: '3x4' },
                { title: '4:3', value: '4x3' },
                { title: '4:5', value: '4x5' },
                { title: '5:4', value: '5x4' }
            ];
            const initialAspectRatioIndex = aspectRatio ? aspectRatioChoices.findIndex(choice => choice.value === aspectRatio) : 0;
            const aspectRatioResponse = await prompts({
                type: 'select',
                name: 'aspectRatio',
                message: 'Choose an aspect ratio (or press Enter for default: last used or 1x1):',
                choices: aspectRatioChoices,
                initial: initialAspectRatioIndex >= 0 ? initialAspectRatioIndex : 0
            });
            aspectRatio = aspectRatioResponse.aspectRatio;
            log('DEBUG', `Aspect ratio provided: ${aspectRatio}`);
        }

        let renderingSpeed = params['rendering-speed'] || ideogramConfig.rendering_speed;
        if (!params['rendering-speed']) {
            log('DEBUG', 'Prompting for rendering speed');
            const renderingSpeedChoices = [
                { title: 'DEFAULT', value: 'DEFAULT' },
                { title: 'TURBO', value: 'TURBO' },
                { title: 'QUALITY', value: 'QUALITY' }
            ];
            const initialRenderingSpeedIndex = renderingSpeed ? renderingSpeedChoices.findIndex(choice => choice.value === renderingSpeed) : 0;
            const renderingSpeedResponse = await prompts({
                type: 'select',
                name: 'renderingSpeed',
                message: 'Choose rendering speed (or press Enter for default: last used or DEFAULT):',
                choices: renderingSpeedChoices,
                initial: initialRenderingSpeedIndex >= 0 ? initialRenderingSpeedIndex : 0
            });
            renderingSpeed = renderingSpeedResponse.renderingSpeed;
            log('DEBUG', `Rendering speed provided: ${renderingSpeed}`);
        }

        let magicPrompt = params['magic-prompt'] || ideogramConfig.magic_prompt;
        if (!params['magic-prompt']) {
            log('DEBUG', 'Prompting for magic prompt');
            const magicPromptChoices = [
                { title: 'AUTO', value: 'AUTO' },
                { title: 'ON', value: 'ON' },
                { title: 'OFF', value: 'OFF' }
            ];
            const initialMagicPromptIndex = magicPrompt ? magicPromptChoices.findIndex(choice => choice.value === magicPrompt) : 0;
            const magicPromptResponse = await prompts({
                type: 'select',
                name: 'magicPrompt',
                message: 'Choose magic prompt option (or press Enter for default: last used or AUTO):',
                choices: magicPromptChoices,
                initial: initialMagicPromptIndex >= 0 ? initialMagicPromptIndex : 0
            });
            magicPrompt = magicPromptResponse.magicPrompt;
            log('DEBUG', `Magic prompt provided: ${magicPrompt}`);
        }

        let negativePrompt = params['negative-prompt'] || '';
        if (!params['negative-prompt']) {
            log('DEBUG', 'Prompting for negative prompt');
            const negativePromptResponse = await prompts({
                type: 'text',
                name: 'negativePrompt',
                message: 'Enter negative prompt (or press Enter to skip):',
                initial: ''
            });
            negativePrompt = negativePromptResponse.negativePrompt;
            log('DEBUG', `Negative prompt provided: ${negativePrompt}`);
        }

        let numImages = params['num-images'] ? parseInt(params['num-images']) : 1;
        if (!params['num-images']) {
            log('DEBUG', 'Prompting for number of images');
            const numImagesResponse = await prompts({
                type: 'number',
                name: 'numImages',
                message: 'Enter number of images (1 to 8, or press Enter for default: 1):',
                initial: 1,
                validate: value => value >= 1 && value <= 8 ? true : 'Number of images must be between 1 and 8'
            });
            numImages = numImagesResponse.numImages;
            log('DEBUG', `Number of images provided: ${numImages}`);
        }

        let colorPalette = params['color-palette'] ? JSON.parse(params['color-palette']) : undefined;
        if (!params['color-palette']) {
            log('DEBUG', 'Prompting for color palette');
            const colorPaletteResponse = await prompts({
                type: 'text',
                name: 'colorPalette',
                message: 'Enter color palette as JSON (e.g., {"name":"pastel"} or {"members":[{"color":"#FF0000"}]}), or press Enter to skip:',
                initial: '',
                validate: value => {
                    if (value === '') return true;
                    try {
                        JSON.parse(value);
                        return true;
                    } catch {
                        return 'Invalid JSON format';
                    }
                }
            });
            colorPalette = colorPaletteResponse.colorPalette ? JSON.parse(colorPaletteResponse.colorPalette) : undefined;
            log('DEBUG', `Color palette provided: ${JSON.stringify(colorPalette)}`);
        }

        let styleCodes = params['style-codes'] ? params['style-codes'].split(',') : undefined;
        if (!params['style-codes']) {
            log('DEBUG', 'Prompting for style codes');
            const styleCodesResponse = await prompts({
                type: 'text',
                name: 'styleCodes',
                message: 'Enter style codes as comma-separated 8-character hex codes (e.g., FF123456,AB7890CD), or press Enter to skip:',
                initial: '',
                validate: value => {
                    if (value === '') return true;
                    const codes = value.split(',');
                    return codes.every(code => /^[0-9A-Fa-f]{8}$/.test(code.trim())) ? true : 'Style codes must be 8-character hex codes';
                }
            });
            styleCodes = styleCodesResponse.styleCodes ? styleCodesResponse.styleCodes.split(',') : undefined;
            log('DEBUG', `Style codes provided: ${styleCodes}`);
        }

        let styleType = params['style-type'] || ideogramConfig.style_type;
        if (!params['style-type']) {
            log('DEBUG', 'Prompting for style type');
            const styleTypeChoices = [
                { title: 'GENERAL', value: 'GENERAL' },
                { title: 'AUTO', value: 'AUTO' },
                { title: 'REALISTIC', value: 'REALISTIC' },
                { title: 'DESIGN', value: 'DESIGN' }
            ];
            const initialStyleTypeIndex = styleType ? styleTypeChoices.findIndex(choice => choice.value === styleType) : 0;
            const styleTypeResponse = await prompts({
                type: 'select',
                name: 'styleType',
                message: 'Choose style type (or press Enter for default: last used or GENERAL):',
                choices: styleTypeChoices,
                initial: initialStyleTypeIndex >= 0 ? initialStyleTypeIndex : 0
            });
            styleType = styleTypeResponse.styleType;
            log('DEBUG', `Style type provided: ${styleType}`);
        }

        let styleReferenceImages = params['style-reference-images'] ? params['style-reference-images'].split(',') : undefined;
        if (!params['style-reference-images']) {
            log('DEBUG', 'Prompting for style reference images');
            const styleReferenceImagesResponse = await prompts({
                type: 'text',
                name: 'styleReferenceImages',
                message: 'Enter paths to style reference images (comma-separated, JPEG/PNG/WebP, max 10MB total), or press Enter to skip:',
                initial: '',
                validate: async value => {
                    if (value === '') return true;
                    const paths = value.split(',');
                    let totalSize = 0;
                    for (const imagePath of paths) {
                        try {
                            await fs.access(imagePath.trim());
                            const stats = await fs.stat(imagePath.trim());
                            totalSize += stats.size;
                            if (stats.size > 10 * 1024 * 1024) return 'Each image must be under 10MB';
                            if (!['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(imagePath.trim()).toLowerCase())) {
                                return 'Images must be JPEG, PNG, or WebP';
                            }
                        } catch {
                            return `Image not found: ${imagePath}`;
                        }
                    }
                    if (totalSize > 10 * 1024 * 1024) return 'Total size of images must be under 10MB';
                    return true;
                }
            });
            styleReferenceImages = styleReferenceImagesResponse.styleReferenceImages ? styleReferenceImagesResponse.styleReferenceImages.split(',') : undefined;
            log('DEBUG', `Style reference images provided: ${styleReferenceImages}`);
        }

        // Update config with selected values
        config.ideogram_image_generation = {
            resolution,
            aspect_ratio: aspectRatio,
            rendering_speed: renderingSpeed,
            magic_prompt: magicPrompt,
            style_type: styleType
        };
        await saveConfig(config);

        // Confirmation prompt
        log('DEBUG', 'Prompting for confirmation');
        const confirmResponse = await prompts({
            type: 'text',
            name: 'confirm',
            message: `Confirm image generation with the following settings:\n` +
                `Prompt: ${imagePrompt}\n` +
                `Seed: ${seed || 'None'}\n` +
                `Resolution: ${resolution || 'None'}\n` +
                `Aspect Ratio: ${aspectRatio}\n` +
                `Rendering Speed: ${renderingSpeed}\n` +
                `Magic Prompt: ${magicPrompt}\n` +
                `Negative Prompt: ${negativePrompt || 'None'}\n` +
                `Number of Images: ${numImages}\n` +
                `Color Palette: ${colorPalette ? JSON.stringify(colorPalette) : 'None'}\n` +
                `Style Codes: ${styleCodes ? styleCodes.join(',') : 'None'}\n` +
                `Style Type: ${styleType}\n` +
                `Style Reference Images: ${styleReferenceImages ? styleReferenceImages.join(',') : 'None'}\n` +
                `Proceed with generation? (Enter 'y' or 'n'):`,
            validate: value => ['y', 'n', 'Y', 'N'].includes(value) ? true : "Please enter 'y' or 'n'"
        });
        if (!confirmResponse.confirm || confirmResponse.confirm.toLowerCase() !== 'y') {
            log('INFO', 'Image generation cancelled by user');
            return 'cancelled';
        }

        // Validate parameters
        if (seed && (seed < 0 || seed > 2147483647)) {
            log('ERROR', 'Seed must be between 0 and 2147483647');
            return 'error';
        }
        if (numImages < 1 || numImages > 8) {
            log('ERROR', 'Number of images must be between 1 and 8');
            return 'error';
        }
        if (resolution && !Object.keys(resolutionMap).includes(resolution)) {
            log('ERROR', 'Invalid resolution');
            return 'error';
        }
        if (aspectRatio && !['1x3', '3x1', '1x2', '2x1', '9x16', '16x9', '10x16', '16x10', '2x3', '3x2', '3x4', '4x3', '4x5', '5x4', '1x1'].includes(aspectRatio)) {
            log('ERROR', 'Invalid aspect ratio');
            return 'error';
        }
        if (resolution && aspectRatio !== '1x1') {
            log('ERROR', 'Cannot use both resolution and aspect_ratio together');
            return 'error';
        }
        if (!['TURBO', 'DEFAULT', 'QUALITY'].includes(renderingSpeed)) {
            log('ERROR', 'Invalid rendering speed');
            return 'error';
        }
        if (!['AUTO', 'ON', 'OFF'].includes(magicPrompt)) {
            log('ERROR', 'Invalid magic prompt setting');
            return 'error';
        }
        if (!['AUTO', 'GENERAL', 'REALISTIC', 'DESIGN'].includes(styleType)) {
            log('ERROR', 'Invalid style type');
            return 'error';
        }
        if (styleCodes && (styleReferenceImages || styleType !== 'GENERAL')) {
            log('ERROR', 'style_codes cannot be used with style_reference_images or style_type');
            return 'error';
        }

        // Check for API key
        const apiKey = process.env.IDEOGRAM_API_KEY;
        if (!apiKey) {
            log('ERROR', 'Ideogram API key not found in environment variables');
            return 'error';
        }

        // Prepare request payload
        const imageRequest = {
            prompt: imagePrompt,
            rendering_speed: renderingSpeed,
            magic_prompt_option: magicPrompt,
            style_type: styleType
        };
        if (seed) imageRequest.seed = seed;
        if (resolution) imageRequest.resolution = resolutionMap[resolution];
        if (!resolution && aspectRatio) imageRequest.aspect_ratio = aspectRatio;
        if (negativePrompt) imageRequest.negative_prompt = negativePrompt;
        if (numImages) imageRequest.num_images = numImages;
        if (colorPalette) imageRequest.color_palette = colorPalette;
        if (styleCodes) imageRequest.style_codes = styleCodes;

        let headers = {
            'Api-Key': apiKey,
            'Content-Type': 'application/json'
        };
        let data = { image_request: imageRequest };

        // Use FormData only if styleReferenceImages are provided
        if (styleReferenceImages) {
            const formData = new FormData();
            formData.append('image_request', JSON.stringify(imageRequest));
            for (const imagePath of styleReferenceImages) {
                try {
                    const imageData = await fs.readFile(imagePath);
                    formData.append('style_reference_images', imageData, path.basename(imagePath));
                } catch (error) {
                    log('ERROR', `Error reading style reference image ${imagePath}: ${error.message}`);
                    return 'error';
                }
            }
            data = formData;
            headers = {
                'Api-Key': apiKey,
                ...formData.getHeaders()
            };
        }

        // Make API call
        log('DEBUG', `Generating Ideogram image with prompt: ${imagePrompt}, payload: ${JSON.stringify(data)}`);
        const response = await axios.post('https://api.ideogram.ai/generate', data, { headers })
            .catch(error => {
                if (error.response) {
                    log('ERROR', `API error response: ${JSON.stringify(error.response.data)}`);
                }
                throw error;
            });

        // Process response
        const images = response.data.data;
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            if (!image.url) {
                log('WARNING', `Image ${i + 1} failed safety checks`);
                continue;
            }

            const outputFileName = `ideogram-${Date.now()}-${i + 1}.png`;
            const outputFilePath = path.join(outputDir, outputFileName);

            try {
                const imageResponse = await axios.get(image.url, { responseType: 'arraybuffer' });
                await fs.writeFile(outputFilePath, imageResponse.data);
                log('INFO', `Generated image saved to ${outputFilePath}`);
            } catch (error) {
                log('ERROR', `Error saving image ${i + 1}: ${error.message}`);
                continue;
            }
        }

        log('INFO', `Successfully generated ${images.length} image(s)`);
        log('DEBUG', `Generate Ideogram Image completed: ${images.length} image(s) generated`);
        return 'success';
    } catch (error) {
        log('ERROR', `Unexpected error in Generate Ideogram Image: ${error.message}`);
        log('DEBUG', `Error stack: ${error.stack}`);
        return 'error';
    }
}

if (require.main === module) {
    generateIdeogramImage().then(result => {
        process.exit(result === 'success' ? 0 : 1);
    }).catch(err => {
        log('ERROR', `Fatal error: ${err.message}`);
        process.exit(1);
    });
}

module.exports = { generateIdeogramImage };
