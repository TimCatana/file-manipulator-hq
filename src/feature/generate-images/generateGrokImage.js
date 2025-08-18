#!/usr/bin/env node

require('dotenv').config();
const prompts = require('prompts');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { log } = require('../../backend/utils/logUtils');

function parseArgs(args) {
    const params = {};
    const validFlags = ['prompt', 'n', 'response-format'];
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

async function generateGrokImage(args = process.argv.slice(2)) {
    try {
        log('INFO', 'Starting Generate Grok Image Feature');

        const params = parseArgs(args);
        if (params.error) return 'error';

        const outputDir = path.resolve(__dirname, '../../../bin/generateImages/grok');
        try {
            await fs.mkdir(outputDir, { recursive: true });
            log('DEBUG', `Output directory: ${outputDir}`);
        } catch (error) {
            log('ERROR', `Failed to create output directory: ${outputDir}`);
            return 'error';
        }

        // Load config for previous selections
        const config = await loadConfig();
        const grokConfig = config.grok_image_generation || {
            response_format: 'url'
        };

        let imagePrompt = params['prompt'];
        if (!imagePrompt) {
            log('DEBUG', 'Prompting for image prompt');
            const promptResponse = await prompts({
                type: 'text',
                name: 'prompt',
                message: 'Enter the prompt for the Grok image (e.g., "A cat in a tree"):',
                validate: value => value.trim() !== '' ? true : 'Prompt required.'
            });
            imagePrompt = promptResponse.prompt;
            log('DEBUG', `Image prompt provided: ${imagePrompt}`);
            if (!imagePrompt) {
                log('INFO', 'No prompt provided, cancelling...');
                return 'cancelled';
            }
        }

        let n = params['n'] ? parseInt(params['n']) : 1;
        if (!params['n']) {
            log('DEBUG', 'Prompting for number of images');
            const nResponse = await prompts({
                type: 'number',
                name: 'n',
                message: 'Enter number of images (1 to 10, or press Enter for default: 1):',
                initial: 1,
                validate: value => value >= 1 && value <= 10 ? true : 'Number of images must be between 1 and 10'
            });
            n = nResponse.n;
            log('DEBUG', `Number of images provided: ${n}`);
        }

        let responseFormat = params['response-format'] || grokConfig.response_format;
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
                message: 'Choose response format (or press Enter for default: last used or url):',
                choices: responseFormatChoices,
                initial: initialResponseFormatIndex >= 0 ? initialResponseFormatIndex : 0
            });
            responseFormat = responseFormatResponse.responseFormat;
            log('DEBUG', `Response format provided: ${responseFormat}`);
        }

        // Update config with selected values
        config.grok_image_generation = {
            response_format: responseFormat
        };
        await saveConfig(config);

        // Confirmation prompt
        log('DEBUG', 'Prompting for confirmation');
        const confirmResponse = await prompts({
            type: 'text',
            name: 'confirm',
            message: `Confirm image generation with the following settings:\n` +
                `Prompt: ${imagePrompt} (Note: Will be revised by a chat model)\n` +
                `Number of Images: ${n}\n` +
                `Response Format: ${responseFormat}\n` +
                `Proceed with generation? (Enter 'y' or 'n'):`,
            validate: value => ['y', 'n', 'Y', 'N'].includes(value) ? true : "Please enter 'y' or 'n'"
        });
        if (!confirmResponse.confirm || confirmResponse.confirm.toLowerCase() !== 'y') {
            log('INFO', 'Image generation cancelled by user');
            return 'cancelled';
        }

        // Validate parameters
        if (n < 1 || n > 10) {
            log('ERROR', `Number of images must be between 1 and 10`);
            return 'error';
        }

        // Check for API key
        const apiKey = process.env.XAI_API_KEY;
        if (!apiKey) {
            log('ERROR', 'xAI API key not found in environment variables');
            return 'error';
        }

        // Prepare request payload
        const imageRequest = {
            prompt: imagePrompt,
            model: 'grok-2-image-1212',
            n,
            response_format: responseFormat
        };

        // Make API call
        log('DEBUG', `Generating Grok image with prompt: ${imagePrompt}, payload: ${JSON.stringify(imageRequest)}`);
        const response = await axios.post('https://api.x.ai/v1/images/generations', imageRequest, {
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

            const outputFileName = `grok-${Date.now()}-${i + 1}.jpg`;
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
                if (image.revised_prompt) {
                    log('INFO', `Revised prompt for image ${i + 1}: ${image.revised_prompt}`);
                }
            } catch (error) {
                log('ERROR', `Error saving image ${i + 1}: ${error.message}`);
                continue;
            }
        }

        log('INFO', `Successfully generated ${images.length} image(s)`);
        log('DEBUG', `Generate Grok Image completed: ${images.length} image(s) generated`);
        return 'success';
    } catch (error) {
        log('ERROR', `Unexpected error in Generate Grok Image: ${error.message}`);
        log('DEBUG', `Error stack: ${error.stack}`);
        return 'error';
    }
}

if (require.main === module) {
    generateGrokImage().then(result => {
        process.exit(result === 'success' ? 0 : 1);
    }).catch(err => {
        log('ERROR', `Fatal error: ${err.message}`);
        process.exit(1);
    });
}

module.exports = { generateGrokImage };