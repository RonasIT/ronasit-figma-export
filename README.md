# Ronas IT Figma export tool

A CLI utility for exporting data from Figma (colors, typography, icons, images) to JSON and SCSS for frontend use.

## Features
- Exports palette and typography variables from Figma into structured JSON and SCSS.
- Exports icons from a Figma sprite to SCSS.
- Exports images from exportable Figma nodes.
- Saves variable IDs separately for integration with other tools.

## Installation
1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd figma-export-tool
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration
1. Edit the `.env` file in the project root:
   ```env
   FIGMA_API_TOKEN=your_figma_token
   FIGMA_FILE_URL=https://www.figma.com/file/your-file-id/...
   ```
   - Get your token in Figma account settings (Account Settings → Personal Access Tokens).
   - The file URL is the link to your Figma file.

2. (Recommended) Add to `.gitignore`:
   ```
   output/
   .env
   node_modules/
   ```

## Usage

### Main Commands

- **Export Figma file content (JSON dump):**
  ```bash
  node figma-export.js content
  # or with options:
  node figma-export.js content -o ./output -n figmaFileContent.json
  ```
  Saves the full JSON dump of the Figma file. 
  
  ⚠️ Other exports will use the cached dump, so be sure to use them with `--update` flag to refresh data from actual Figma file.

- **Export variables (palette, typekit):**
  ```bash
  node figma-export.js variables
  # or with options:
  node figma-export.js variables -o ./output -n figmaVariables.json -u
  ```
  Saves:
  - `figmaVariables.json` — palette and typography variables in the format:
    ```json
    {
      "palette": { ... },
      "typekit": { ... }
    }
    ```
  - `variableIds.json` — variable IDs.
  - `figmaVariables.scss` — SCSS variables.

- **Export icons:**
  ```bash
  node figma-export.js icons
  # or with options:
  node figma-export.js icons -f icon_sprite -o ./output -n icons.scss
  ```
  Saves SCSS for icons from the sprite.

- **Export images:**
  ```bash
  node figma-export.js images
  # or with options:
  node figma-export.js images -o ./output -f FrameName --list
  ```
  Saves images from exportable nodes.

- **Run all exports:**
  ```bash
  node figma-export.js all
  ```

### Command Options
- `-o, --output <dir>` — output directory (default: `./output`)
- `-n, --name <name>` — output file name
- `-u, --update` — force update from Figma (ignore cache)
- `-f, --frame <name>` — frame name (for icons/images)
- `--list` — only list exportable images, do not download

## Examples

Export only variables:
```bash
node figma-export.js variables -o ./output
```

Export icons from the `icon_sprite` frame:
```bash
node figma-export.js icons -f icon_sprite -o ./output
```

Export images from the `Assets` frame:
```bash
node figma-export.js images -f Assets -o ./output
```

## FAQ

**Q: Why aren't my variables exported?**
- Make sure variables in Figma are organized as separate rows (`Palette row`, `Typekit row`).
- Check that your token and file URL in `.env` are correct.

**Q: How do I add new themes?**
- Just add new themes in Figma; the export is fully generic.

**Q: How do I add new platforms for typography?**
- Similarly: add new platforms in Figma, the export supports any keys.

**Q: How do I refresh the cache?**
- Use the `-u` or `--update` flag with any command.

---

If you have questions or find bugs, please open an issue or contact the author. 