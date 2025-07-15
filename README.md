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
  Saves SCSS for icons from the sprite. Works with `icons_sprite` frame by default, but you can pass any frame name to generate icons SCSS from.

- **Export images:**
  ```bash
  node figma-export.js images
  # or with options:
  node figma-export.js images -o ./output -f FrameName --list
  ```
  Saves images from all exportable nodes. If specific frame name is passed as `--frame` parameter, exportable images will be saved from this frame only.

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

Export icons from the `empty_states` frame:
```bash
node figma-export.js icons -f empty_states -o ./output
```

Export images from the `Assets` frame:
```bash
node figma-export.js images -f Assets -o ./output
```


## Markup.js: Figma to React/SCSS Converter

`markup.js` is a CLI utility for converting a Figma frame, component, or any other node into React JSX and SCSS with support for variables, auto layout, typography, and advanced styles.

### Features
- Generates JSX templates and SCSS styles for the selected Figma frame.
- Supports SCSS variables for colors, sizes, fonts, font-weight, and other properties.
- For INSTANCE nodes, generates a React component with props.
- Supports variant selection inside a component via the `--variant` option.

### Usage

```bash
node markup.js --frame "Frame Name" [--variant "Variant Name"] [--output ./output] [--name ComponentName] [--json]
```

#### Main Options
- `-f, --frame <name>` — Figma frame/node name (required)
- `-v, --variant <name>` — variant node name inside the component (optional)
- `-o, --output <dir>` — output directory (default: ./output)
- `-n, --name <component>` — component/class name for the root node (default: frame or variant name)
- `--json` — also save the selected node as JSON

#### Examples

Export markup and styles for a frame:
```bash
node markup.js --frame "Chat Message"
```

Export for a variant inside a component:
```bash
node markup.js --frame "Chat Message" --variant "Active"
```

If multiple nodes with the same name are found, the utility will prompt you to select the desired one.

#### Output Files
- `ComponentName.jsx` — React JSX for the selected node
- `ComponentName.scss` — SCSS for the selected node
- `ComponentName.json` — (optional) JSON of the selected node

---

If you have questions or find bugs, please open an issue or contact the author. 