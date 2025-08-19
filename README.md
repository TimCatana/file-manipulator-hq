# File Manipulator Tool

This is a Node.js application designed to automate and simplify tasks concerning files

## Prerequisites

Before setting up and running the application, ensure you have the following installed:

- **Node.js**: Version 14.x or higher (includes npm).
- **ExifTool**: Required for metadata manipulation.
- **FFmpeg**: Required for MP4, WAV, and WebM files.

### Installation Instructions

#### Node.js and npm
Node.js comes bundled with npm (Node Package Manager). Follow these steps based on your operating system:

- **Windows**:
  1. Visit [Node.js official website](https://nodejs.org/).
  2. Download the latest LTS (Long-Term Support) version (e.g., 20.x as of August 2025).
  3. Run the installer, following the on-screen instructions. Ensure the option to install npm is checked.
  4. Verify installation by opening Command Prompt and running:
     ```bash
     node -v
     npm -v
     ```
     You should see version numbers (e.g., `v20.17.0` for Node.js and `10.x.x` for npm).

- **macOS**:
  1. Visit [Node.js official website](https://nodejs.org/).
  2. Download the latest LTS version.
  3. Run the installer package and follow the prompts.
  4. Alternatively, use Homebrew:
     ```bash
     brew install node
     ```
  5. Verify installation in Terminal:
     ```bash
     node -v
     npm -v
     ```

- **Linux (Ubuntu/Debian)**:
  1. Open a terminal and update the package list:
     ```bash
     sudo apt update
     ```
  2. Install Node.js and npm:
     ```bash
     sudo apt install nodejs npm
     ```
  3. Verify installation:
     ```bash
     node -v
     npm -v
     ```
  4. (Optional) For the latest version, use NodeSource repository:
     ```bash
     curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
     sudo apt install -y nodejs
     ```

#### ExifTool
ExifTool is used for metadata manipulation across various file types.

- **Windows**:
  1. Download the Windows executable from [ExifTool's official site](https://exiftool.org/).
  2. Extract the `exiftool(-k).exe` file to a directory (e.g., `C:\ExifTool`).
  3. Add the directory to your system PATH:
     - Right-click 'This PC' > 'Properties' > 'Advanced system settings' > 'Environment Variables'.
     - Edit the 'Path' variable under 'System variables' and add the ExifTool directory.
  4. Verify installation:
     ```bash
     exiftool -ver
     ```

- **macOS**:
  1. Install via Homebrew:
     ```bash
     brew install exiftool
     ```
  2. Verify installation:
     ```bash
     exiftool -ver
     ```

- **Linux (Ubuntu/Debian)**:
  1. Install via apt:
     ```bash
     sudo apt-get install libimage-exiftool-perl
     ```
  2. Verify installation:
     ```bash
     exiftool -ver
     ```

#### FFmpeg
FFmpeg is required for processing MP4, WAV, and WebM files.

- **Windows**:
  1. Download the Windows build from [FFmpeg's official download page](https://ffmpeg.org/download.html) or a trusted source like [gyan.dev](https://www.gyan.dev/ffmpeg/builds/).
  2. Extract the archive to a directory (e.g., `C:\FFmpeg`).
  3. Add the `bin` subdirectory to your system PATH (e.g., `C:\FFmpeg\bin`).
  4. Verify installation:
     ```bash
     ffmpeg -version
     ```

- **macOS**:
  1. Install via Homebrew:
     ```bash
     brew install ffmpeg
     ```
  2. Verify installation:
     ```bash
     ffmpeg -version
     ```

- **Linux (Ubuntu/Debian)**:
  1. Install via apt:
     ```bash
     sudo apt-get install ffmpeg
     ```
  2. Verify installation:
     ```bash
     ffmpeg -version
     ```

## Installation

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Install Dependencies**:
   Run the following command to install the required Node.js packages:
   ```bash
   npm install
   ```
   This will install `prompts`, `fluent-ffmpeg`, `png-chunks-extract`, `png-chunks-encode`, and other dependencies listed in `package.json`.

3. **Verify Tools**:
   Ensure ExifTool and FFmpeg are accessible from the command line by running:
   ```bash
   exiftool -ver
   ffmpeg -version
   ```
   If either command fails, revisit the installation steps above.

## Running the Application

The app can be run from the root directory using `node src/main.js` to handle all supported file types, or you can run individual scripts for specific file types.

### Root Execution
Run the app from the root directory to process files of any supported type:
```bash
node src/main.js
```
Follow the prompts to specify the input path, output directory, and metadata.

### Individual File Type Execution
Run the script corresponding to the file type you want to process:
- **JPG**: `node updateJpgMetadata.js`
- **MP4**: `node updateMp4Metadata.js`
- **PNG**: `node updatePngMetadata.js`
- **WAV**: `node updateWavMetadata.js`
- **WebM**: `node updateWebmMetadata.js`
- **WebP**: `node updateWebpMetadata.js`

### Interactive Mode
1. Execute the script (e.g., `node src/main.js` or `node updateJpgMetadata.js`).
2. Follow the prompts to enter:
   - The input path (file or directory containing files to process).
   - The output directory for processed files.
   - Metadata fields (title, description, keywords, copyright, genre, comment).
3. Press Enter without input to cancel at any prompt.

### Command Line Arguments
You can provide arguments to skip prompts for example:
```bash
node updateJpgMetadata.js --input /path/to/input --output /path/to/output --title "My Photo" --description "A test image" --keywords "test,image" --copyright "2025 Me" --genre "Photography" --comment "Test comment"
```

## Usage Notes

- **Input/Output Paths**: Ensure the input path contains valid files (e.g., `.jpg` for `updateJpgMetadata.js`) and the output directory is writable.
- **Metadata**: All metadata fields are optional; defaults will be used if omitted (e.g., "Untitled" for title).
- **Logging**: The app logs debug and error information to the console. Check logs for troubleshooting.

## Troubleshooting

- **ExifTool/FFmpeg Not Found**: Verify installation and ensure they are in your system's PATH.
- **Permission Issues**: If files cannot be processed, ensure the input and output directories are accessible.
- **Corrupt Files**: The app may skip invalid files (e.g., PNG validation); check logs for warnings.
- **Errors**: Review the error logs for specific messages (e.g., "Format error in file") and ensure file formats are supported.

## Contributing

Feel free to submit issues or pull requests on the repository. Ensure any changes include updated tests and documentation.

## License

Open Source