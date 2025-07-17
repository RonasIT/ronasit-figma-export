# Ronas IT Figma export tool

A CLI utility for exporting data from Figma (colors, typography, icons, images) to JSON and SCSS for frontend use.

## Features

- Exports palette and typography variables from Figma into structured JSON and SCSS.
- Exports icons from a Figma sprite to SCSS.
- Exports images from exportable Figma nodes.
- Saves variable IDs separately for integration with other tools.
- Converts Figma frames/components to React JSX and SCSS with auto-layout support.

## Installation

### Local Installation (Recommended)

Install in your project as a development dependency:

```bash
npm install --save-dev @ronas-it/figma-export
```

### Global Installation

Install globally to use as a CLI tool from anywhere:

```bash
npm install -g @ronas-it/figma-export
```

## Configuration

1. Get your token in Figma account settings (Account Settings → Personal Access Tokens).
1. The file URL is the link to your Figma file.
1. Create a `.env` file in your project root or current working directory with the following variables:

```env
FIGMA_API_TOKEN=your_figma_token
FIGMA_FILE_URL=https://www.figma.com/file/your-file-id/...
```

**Recommended:** Add to `.gitignore`:

```gitignore
output/
.env
```

## Usage

### Main Commands

**Local Installation (npm scripts):**

```bash
npx figma-export <command> [options]
npx figma-markup [options]
```

**Global Installation:**

```bash
figma-export <command> [options]
figma-markup [options]
```

### Available Commands

- **Export Figma file content (JSON dump):**

  ```bash
  # Global
  figma-export content
  # With options
  figma-export content -o ./output -n figmaFileContent.json

  # Local/npx
  npx figma-export content -o ./output -n figmaFileContent.json
  ```

  Saves the full JSON dump of the Figma file.

  ⚠️ Other exports will use the cached dump, so be sure to use them with `--update` flag to refresh data from actual Figma file.

- **Export variables (palette, typekit):**

  ```bash
  # Global
  figma-export variables
  # With options
  figma-export variables -o ./output -n figmaVariables.json -u

  # Local/npx
  npx figma-export variables -o ./output -n figmaVariables.json -u
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
  # Global
  figma-export icons
  # With options
  figma-export icons -f icon_sprite -o ./output -n icons.scss

  # Local/npx
  npx figma-export icons -f icon_sprite -o ./output -n icons.scss
  ```

  Saves SCSS for icons from the sprite. Works with `icons_sprite` frame by default, but you can pass any frame name to generate icons SCSS from.

- **Export images:**

  ```bash
  # Global
  figma-export images
  # With options
  figma-export images -o ./output -f FrameName --list

  # Local/npx
  npx figma-export images -o ./output -f FrameName --list
  ```

  Saves images from all exportable nodes. If specific frame name is passed as `--frame` parameter, exportable images will be saved from this frame only.

- **Run all exports:**

  ```bash
  # Global
  figma-export all

  # Local/npx
  npx figma-export all
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
# Global
figma-export variables -o ./output

# Local/npx
npx figma-export variables -o ./output
```

Export icons from the `empty_states` frame:

```bash
# Global
figma-export icons -f empty_states -o ./output

# Local/npx
npx figma-export icons -f empty_states -o ./output
```

Export images from the `Assets` frame:

```bash
# Global
figma-export images -f Assets -o ./output

# Local/npx
npx figma-export images -f Assets -o ./output
```

## Markup.js: Figma to React/SCSS Converter

`markup.js` is a CLI utility for converting a Figma frame, component, or any other node into React JSX and SCSS with support for variables, auto layout, typography, and advanced styles.

### Features

- Generates JSX templates and SCSS styles for the selected Figma frame.
- Uses CSS variables for colors and font properties.
- For component instances, generates a React component and passes props.
- Supports variant selection inside a component via the `--variant` option.

### Usage

```bash
# Global installation
figma-markup --frame "Frame Name" [--variant "Variant Name"] [--output ./output] [--name ComponentName] [--json]

# Local installation
npx figma-markup --frame "Frame Name" [--variant "Variant Name"] [--output ./output] [--name ComponentName] [--json]

# Development
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
# Global
figma-markup --frame "Chat Message"

# Local/npx
npx figma-markup --frame "Chat Message"
```

Export for a variant inside a component:

```bash
# Global
figma-markup --frame "Chat Message" --variant "Active"

# Local/npx
npx figma-markup --frame "Chat Message" --variant "Active"
```

If multiple nodes with the same name are found, the utility will prompt you to select the desired one.

#### Output Files

- `ComponentName.jsx` — React JSX for the selected node
- `ComponentName.scss` — SCSS for the selected node
- `ComponentName.json` — (optional) JSON of the selected node, may be used for debugging

---

If you have questions or find bugs, please open an issue or contact the author.

## Development

For contributing or local development:

1. Clone the repository:

   ```bash
   git clone https://github.com/ronasit/ronasit-figma-export.git
   cd ronasit-figma-export
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run scripts locally using `node`:

   ```bash
   node figma-export.js <command> [options]
   node markup.js [options]
   ```
