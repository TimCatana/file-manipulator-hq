#!/usr/bin/env node

require('dotenv').config();
const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { log } = require('../../backend/utils/logUtils');

function parseArgs(args) {
    const params = {};
    const validFlags = [
        'prompt', 'background', 'model', 'moderation', 'n', 'output-compression',
        'output-format', 'partial-images', 'quality', 'response-format', 'size',
        'stream', 'style', 'user'
    ];
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

// Map user-friendly resolution format to DALL·E supported sizes
const sizeMap = {
    'dall-e-3': {
        '1024x1024': '1024x1024',
        '1792x1024': '1792x1024',
        '1024x1792': '1024x1792'
    },
    'dall-e-2': {
        '256x256': '256x256',
        '512x512': '512x512',
        '1024x1024': '1024x1024'
    },
    'gpt-image-1': {
        '1024x1024': '1024x1024',
        '1536x1024': '1536x1024',
        '1024x1536': '1024x1536'
    }
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

async function generateDalleImage(args = process.argv.slice(2)) {
    try {
        log('INFO', 'Starting Generate Dalle Image Feature');

        const params = parseArgs(args);
        if (params.error) return 'error';

        const outputDir = path.resolve(__dirname, '../../../bin/generateImages/dalle');
        try {
            await fs.mkdir(outputDir, { recursive: true });
            log('DEBUG', `Output directory: ${outputDir}`);
        } catch (error) {
            log('ERROR', `Failed to create output directory: ${outputDir}`);
            return 'error';
        }

        // Load config for previous selections
        const config = await loadConfig();
        const dalleConfig = config.dalle_image_generation || {
            size: '1024x1024',
            style: 'vivid',
            background: 'auto',
            output_format: 'png',
            response_format: 'url',
            moderation: 'auto',
            partial_images: 0,
            n: 1
        };

        let imagePrompt = params['prompt'];
        if (!imagePrompt) {
            log('DEBUG', 'Prompting for image prompt');
            const promptResponse = await prompts({
                type: 'text',
                name: 'prompt',
                message: 'Enter the prompt for the Dalle image (max 4000 chars for dall-e-3, 32000 for gpt-image-1, 1000 for dall-e-2):',
                validate: value => value.trim() !== '' ? true : 'Prompt required.'
            });
            imagePrompt = promptResponse.prompt;
            log('DEBUG', `Image prompt provided: ${imagePrompt}`);
            if (!imagePrompt) {
                log('INFO', 'No prompt provided, cancelling...');
                return 'cancelled';
            }
        }

        let model = params['model'] || 'dall-e-3';
        if (!params['model']) {
            log('DEBUG', 'Prompting for model');
            const modelResponse = await prompts({
                type: 'select',
                name: 'model',
                message: 'Choose model (or press Enter for default: dall-e-3):',
                choices: [
                    { title: 'dall-e-3', value: 'dall-e-3' },
                    { title: 'dall-e-2', value: 'dall-e-2' },
                    { title: 'gpt-image-1', value: 'gpt-image-1' }
                ],
                initial: 0
            });
            model = modelResponse.model;
            log('DEBUG', `Model provided: ${model}`);
        }

        let n = params['n'] ? parseInt(params['n']) : dalleConfig.n;
        if (!params['n']) {
            log('DEBUG', 'Prompting for number of images');
            const maxN = model === 'dall-e-3' ? 1 : 10;
            const nResponse = await prompts({
                type: 'number',
                name: 'n',
                message: `Enter number of images (1${model === 'dall-e-3' ? '' : ' to 10'}, or press Enter for default: last used or 1):`,
                initial: dalleConfig.n,
                validate: value => value >= 1 && value <= maxN ? true : `Number of images must be between 1 and ${maxN}`
            });
            n = nResponse.n;
            log('DEBUG', `Number of images provided: ${n}`);
        }

        let size = params['size'] || dalleConfig.size;
        if (!params['size']) {
            log('DEBUG', 'Prompting for size');
            const sizeChoices = Object.keys(sizeMap[model] || sizeMap['dall-e-3']).map(s => ({ title: s, value: s }));
            const initialSizeIndex = size ? sizeChoices.findIndex(choice => choice.value === size) : 0;
            const sizeResponse = await prompts({
                type: 'select',
                name: 'size',
                message: `Choose size for ${model} (or press Enter for default: last used or 1024x1024):`,
                choices: sizeChoices,
                initial: initialSizeIndex >= 0 ? initialSizeIndex : 0
            });
            size = sizeResponse.size;
            log('DEBUG', `Size provided: ${size}`);
        }

        let quality = params['quality'] || (model === 'dall-e-2' ? 'standard' : model === 'dall-e-3' ? 'hd' : 'auto');
        if (!params['quality']) {
            log('DEBUG', 'Prompting for quality');
            const qualityChoices = model === 'dall-e-3' ? [
                { title: 'standard', value: 'standard' },
                { title: 'hd', value: 'hd' }
            ] : model === 'gpt-image-1' ? [
                { title: 'auto', value: 'auto' },
                { title: 'high', value: 'high' },
                { title: 'medium', value: 'medium' },
                { title: 'low', value: 'low' }
            ] : [
                { title: 'standard', value: 'standard' }
            ];
            const initialQualityIndex = quality ? qualityChoices.findIndex(choice => choice.value === quality) : 0;
            const qualityResponse = await prompts({
                type: 'select',
                name: 'quality',
                message: `Choose quality for ${model} (or press Enter for default: ${model === 'dall-e-2' ? 'standard' : model === 'dall-e-3' ? 'hd' : 'auto'}):`,
                choices: qualityChoices,
                initial: initialQualityIndex >= 0 ? initialQualityIndex : 0
            });
            quality = qualityResponse.quality;
            log('DEBUG', `Quality provided: ${quality}`);
        }

        let background = params['background'] || dalleConfig.background;
        if (!params['background']) {
            log('DEBUG', 'Prompting for background');
            const backgroundChoices = [
                { title: 'auto', value: 'auto' },
                { title: 'transparent', value: 'transparent' },
                { title: 'opaque', value: 'opaque' }
            ];
            const initialBackgroundIndex = background ? backgroundChoices.findIndex(choice => choice.value === background) : 0;
            const backgroundResponse = await prompts({
                type: 'select',
                name: 'background',
                message: 'Choose background (or press Enter for default: last used or auto). Note: Only for gpt-image-1:',
                choices: backgroundChoices,
                initial: initialBackgroundIndex >= 0 ? initialBackgroundIndex : 0
            });
            background = backgroundResponse.background;
            log('DEBUG', `Background provided: ${background}`);
        }

        let outputCompression = params['output-compression'] ? parseInt(params['output-compression']) : 100;
        if (!params['output-compression']) {
            log('DEBUG', 'Prompting for output compression');
            const outputCompressionResponse = await prompts({
                type: 'number',
                name: 'outputCompression',
                message: 'Enter output compression (0-100, or press Enter for default: 100). Note: Only for gpt-image-1 with webp/jpeg:',
                initial: 100,
                validate: value => value >= 0 && value <= 100 ? true : 'Output compression must be between 0 and 100'
            });
            outputCompression = outputCompressionResponse.outputCompression;
            log('DEBUG', `Output compression provided: ${outputCompression}`);
        }

        let outputFormat = params['output-format'] || dalleConfig.output_format;
        if (!params['output-format']) {
            log('DEBUG', 'Prompting for output format');
            const outputFormatChoices = [
                { title: 'png', value: 'png' },
                { title: 'jpeg', value: 'jpeg' },
                { title: 'webp', value: 'webp' }
            ];
            const initialOutputFormatIndex = outputFormat ? outputFormatChoices.findIndex(choice => choice.value === outputFormat) : 0;
            const outputFormatResponse = await prompts({
                type: 'select',
                name: 'outputFormat',
                message: 'Choose output format (or press Enter for default: last used or png). Note: Only for gpt-image-1:',
                choices: outputFormatChoices,
                initial: initialOutputFormatIndex >= 0 ? initialOutputFormatIndex : 0
            });
            outputFormat = outputFormatResponse.outputFormat;
            log('DEBUG', `Output format provided: ${outputFormat}`);
        }

        let responseFormat = params['response-format'] || dalleConfig.response_format;
        if (!params['response-format']) {
            log('DEBUG', 'Prompting for response format');
            const responseFormatChoices = [
                { title: 'url', value: 'url' },
                { title: 'b64_json', value: 'b64_json' }
            ];
            const initialResponseFormatIndex = responseFormat ? responseFormatChoices.findIndex(choice => choice.value === responseFormat) : 0;
            const responseFormatResponse = await prompts({
                type: 'select',
                name: 'responseFormat',
                message: 'Choose response format (or press Enter for default: last used or url). Note: gpt-image-1 uses b64_json:',
                choices: responseFormatChoices,
                initial: initialResponseFormatIndex >= 0 ? initialResponseFormatIndex : 0
            });
            responseFormat = responseFormatResponse.responseFormat;
            log('DEBUG', `Response format provided: ${responseFormat}`);
        }

        let partialImages = params['partial-images'] ? parseInt(params['partial-images']) : dalleConfig.partial_images;
        if (!params['partial-images']) {
            log('DEBUG', 'Prompting for partial images');
            const partialImagesResponse = await prompts({
                type: 'number',
                name: 'partialImages',
                message: 'Enter number of partial images for streaming (0-3, or press Enter for default: 0). Note: Only for gpt-image-1:',
                initial: 0,
                validate: value => value >= 0 && value <= 3 ? true : 'Partial images must be between 0 and 3'
            });
            partialImages = partialImagesResponse.partialImages;
            log('DEBUG', `Partial images provided: ${partialImages}`);
        }

        let stream = params['stream'] ? params['stream'].toLowerCase() === 'true' : false;
        if (!params['stream']) {
            log('DEBUG', 'Prompting for stream');
            const streamResponse = await prompts({
                type: 'confirm',
                name: 'stream',
                message: 'Enable streaming mode? (or press Enter for default: false). Note: Only for gpt-image-1:',
                initial: false
            });
            stream = streamResponse.stream;
            log('DEBUG', `Stream provided: ${stream}`);
        }

        let moderation = params['moderation'] || dalleConfig.moderation;
        if (!params['moderation']) {
            log('DEBUG', 'Prompting for moderation');
            const moderationChoices = [
                { title: 'auto', value: 'auto' },
                { title: 'low', value: 'low' }
            ];
            const initialModerationIndex = moderation ? moderationChoices.findIndex(choice => choice.value === moderation) : 0;
            const moderationResponse = await prompts({
                type: 'select',
                name: 'moderation',
                message: 'Choose moderation level (or press Enter for default: last used or auto). Note: Only for gpt-image-1:',
                choices: moderationChoices,
                initial: initialModerationIndex >= 0 ? initialModerationIndex : 0
            });
            moderation = moderationResponse.moderation;
            log('DEBUG', `Moderation provided: ${moderation}`);
        }

        let style = params['style'] || dalleConfig.style;
        if (!params['style']) {
            log('DEBUG', 'Prompting for style');
            const styleChoices = [
                { title: 'vivid', value: 'vivid' },
                { title: 'natural', value: 'natural' }
            ];
            const initialStyleIndex = style ? styleChoices.findIndex(choice => choice.value === style) : 0;
            const styleResponse = await prompts({
                type: 'select',
                name: 'style',
                message: 'Choose style (or press Enter for default: last used or vivid). Note: Only for dall-e-3:',
                choices: styleChoices,
                initial: initialStyleIndex >= 0 ? initialStyleIndex : 0
            });
            style = styleResponse.style;
            log('DEBUG', `Style provided: ${style}`);
        }

        let user = params['user'] || undefined;
        if (!params['user']) {
            log('DEBUG', 'Prompting for user');
            const userResponse = await prompts({
                type: 'text',
                name: 'user',
                message: 'Enter user identifier (or press Enter to skip):',
                initial: ''
            });
            user = userResponse.user || undefined;
            log('DEBUG', `User provided: ${user}`);
        }

        // Update config with selected values
        config.dalle_image_generation = {
            size,
            style,
            background,
            output_format: outputFormat,
            response_format: responseFormat,
            moderation,
            partial_images: partialImages,
            n
        };
        await saveConfig(config);

        // Confirmation prompt
        log('DEBUG', 'Prompting for confirmation');
        const confirmResponse = await prompts({
            type: 'text',
            name: 'confirm',
            message: `Confirm image generation with the following settings:\n` +
                `Prompt: ${imagePrompt}\n` +
                `Model: ${model}\n` +
                `Number of Images: ${n}\n` +
                `Size: ${size}\n` +
                `Quality: ${quality}\n` +
                `Background: ${background} (Only for gpt-image-1)\n` +
                `Output Compression: ${outputCompression} (Only for gpt-image-1 with webp/jpeg)\n` +
                `Output Format: ${outputFormat} (Only for gpt-image-1)\n` +
                `Response Format: ${responseFormat} (gpt-image-1 uses b64_json)\n` +
                `Partial Images: ${partialImages} (Only for gpt-image-1)\n` +
                `Stream: ${stream} (Only for gpt-image-1)\n` +
                `Moderation: ${moderation} (Only for gpt-image-1)\n` +
                `Style: ${style} (Only for dall-e-3)\n` +
                `User: ${user || 'None'}\n` +
                `Proceed with generation? (Enter 'y' or 'n'):`,
            validate: value => ['y', 'n', 'Y', 'N'].includes(value) ? true : "Please enter 'y' or 'n'"
        });
        if (!confirmResponse.confirm || confirmResponse.confirm.toLowerCase() !== 'y') {
            log('INFO', 'Image generation cancelled by user');
            return 'cancelled';
        }

        // Validate parameters
        if (imagePrompt.length > (model === 'gpt-image-1' ? 32000 : model === 'dall-e-3' ? 4000 : 1000)) {
            log('ERROR', `Prompt exceeds maximum length for ${model}`);
            return 'error';
        }
        if (!['dall-e-2', 'dall-e-3', 'gpt-image-1'].includes(model)) {
            log('ERROR', 'Invalid model; must be dall-e-2, dall-e-3, or gpt-image-1');
            return 'error';
        }
        if (!sizeMap[model][size]) {
            log('ERROR', `Invalid size for ${model}; must be one of ${Object.keys(sizeMap[model]).join(', ')}`);
            return 'error';
        }
        if (n < 1 || n > (model === 'dall-e-3' ? 1 : 10)) {
            log('ERROR', `Number of images must be between 1 and ${model === 'dall-e-3' ? 1 : 10}`);
            return 'error';
        }
        if (model !== 'gpt-image-1' && (background !== 'auto' || outputCompression !== 100 || outputFormat !== 'png' || partialImages !== 0 || stream || moderation !== 'auto')) {
            log('WARNING', 'Parameters background, output_compression, output_format, partial_images, stream, and moderation are only supported by gpt-image-1');
        }
        if (model !== 'dall-e-3' && style !== 'vivid') {
            log('WARNING', 'Style is only supported by dall-e-3');
        }
        if (model === 'gpt-image-1' && responseFormat !== 'b64_json') {
            log('WARNING', 'gpt-image-1 only supports b64_json response_format');
            responseFormat = 'b64_json';
        }
        if (background === 'transparent' && !['png', 'webp'].includes(outputFormat)) {
            log('ERROR', 'Transparent background requires output_format to be png or webp');
            return 'error';
        }
        if (outputCompression !== 100 && !['webp', 'jpeg'].includes(outputFormat)) {
            log('ERROR', 'Output compression is only supported with webp or jpeg output_format');
            return 'error';
        }

        // Check for API key
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            log('ERROR', 'Dalle API key not found in environment variables');
            return 'error';
        }

        // Prepare request payload
        const imageRequest = {
            prompt: imagePrompt,
            model,
            n,
            size: sizeMap[model][size],
            quality,
            response_format: model === 'gpt-image-1' ? 'b64_json' : responseFormat
        };
        if (model === 'dall-e-3') {
            imageRequest.style = style;
        }
        if (model === 'gpt-image-1') {
            imageRequest.background = background;
            imageRequest.output_compression = outputCompression;
            imageRequest.output_format = outputFormat;
            imageRequest.partial_images = partialImages;
            imageRequest.stream = stream;
            imageRequest.moderation = moderation;
        }
        if (user) {
            imageRequest.user = user;
        }

        // Make API call
        log('DEBUG', `Generating Dalle image with prompt: ${imagePrompt}, payload: ${JSON.stringify(imageRequest)}`);
        const response = await axios.post('https://api.openai.com/v1/images/generations', imageRequest, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        }).catch(error => {
            if (error.response) {
                log('ERROR', `API error response: ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        });

        // Process response
        const images = response.data.data;
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            if (!image.url && !image.b64_json) {
                log('WARNING', `Image ${i + 1} failed safety checks`);
                continue;
            }

            const outputFileName = `dalle-${Date.now()}-${i + 1}.${model === 'gpt-image-1' ? outputFormat : 'png'}`;
            const outputFilePath = path.join(outputDir, outputFileName);

            try {
                if (image.b64_json) {
                    const imageData = Buffer.from(image.b64_json, 'base64');
                    await fs.writeFile(outputFilePath, imageData);
                } else {
                    const imageResponse = await axios.get(image.url, { responseType: 'arraybuffer' });
                    await fs.writeFile(outputFilePath, imageResponse.data);
                }
                log('INFO', `Generated image saved to ${outputFilePath}`);
                try {
                    const stats = await fs.stat(outputFilePath);
                    log('DEBUG', `Generated image size: ${stats.size} bytes for ${outputFilePath}`);
                } catch (statError) {
                    log('DEBUG', `Failed to retrieve file size for ${outputFilePath}: ${statError.message}`);
                }
            } catch (error) {
                log('ERROR', `Error saving image ${i + 1}: ${error.message}`);
                continue;
            }
        }

        log('INFO', `Successfully generated ${images.length} image(s)`);
        log('DEBUG', `Generate Dalle Image completed: ${images.length} image(s) generated`);
        return 'success';
    } catch (error) {
        log('ERROR', `Unexpected error in Generate Dalle Image: ${error.message}`);
        log('DEBUG', `Error stack: ${error.stack}`);
        return 'error';
    }
}

if (require.main === module) {
    generateDalleImage().then(result => {
        process.exit(result === 'success' ? 0 : 1);
    }).catch(err => {
        log('ERROR', `Fatal error: ${err.message}`);
        process.exit(1);
    });
}

module.exports = { generateDalleImage };