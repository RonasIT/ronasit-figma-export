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
2. The file URL is the link to your Figma file.
3. Create a `.env` file (or rename `.env.example` to `.env`) in your project root or current working directory with the following variables:

```env
FIGMA_API_TOKEN=your_figma_token
FIGMA_FILE_URL=https://www.figma.com/file/your-file-id/...
```

You can set up default folders and frames names in `.env` as well:

```env
# Default folders and frames
FILE_CACHE_OUTPUT_DIR=./output
IMAGES_OUTPUT_DIR=./output/img
STYLES_OUTPUT_DIR=./output/scss
COMPONENTS_OUTPUT_DIR=./output/components
ICONS_SPRITE=icon_sprite
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
  figma-export content -o ./output -n figmaFileContent

  # Local/npx
  npx figma-export content -o ./output -n figmaFileContent
  ```

  Saves the full binary dump of the Figma file and also a JSON if possible.

  ⚠️ Other export commands will use the cached dump, so be sure to use them with `--update` flag to refresh data from actual Figma file.

- **Export variables (palette, typekit):**

  ```bash
  # Global
  figma-export variables
  # With options
  figma-export variables -o ./output -n variables.json -u

  # Local/npx
  npx figma-export variables -o ./output -n variables.json -u
  ```

  Saves:
  - `variables.json` — palette and typography variables in the format:

    ```json
    {
      "palette": { ... },
      "typekit": { ... }
    }
    ```

  - `variableIds.json` — variable IDs.

    Variable IDs map is important for `figma-markup` tool, do not delete or
    rename this file for better markup exports.

  - `variables.scss` — SCSS styles for variables.

- **Export icons:**

  ```bash
  # Global
  figma-export icons
  # With options
  figma-export icons -f "Sprite Frame Name" -o ./output/scss -n icons.scss

  # Local/npx
  npx figma-export icons -f "Sprite Frame Name" -o ./output/scss -n icons.scss
  ```

  Saves styles (CSS or SCSS) for icons from the sprite. Works with `icon_sprite` frame by default, but you can pass any frame
  name or change the default name in `.env` to generate icons styls from any other frame.

- **Export images:**

  ```bash
  # Global
  figma-export images
  # With options
  figma-export images -o ./output -f "Frame Name" --list

  # Local/npx
  npx figma-export images -o ./output -f "Frame Name" --list
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
- `-f, --frame <name>` — frame name (for icons and images export commands)
- `-c, -css` - render CSS code instead of SCSS (for icons and variables export commands)
- `--list` — only list exportable images, do not download


## Examples

Export project variables to JSON/SCSS:

```bash
# Global
figma-export variables

# Local/npx
npx figma-export variables
```

Export icons from the `empty_states` frame:

```bash
# Global
figma-export icons -f empty_states

# Local/npx
npx figma-export icons -f empty_states
```

Export images from the `Assets` frame:

```bash
# Global
figma-export images -f Assets

# Local/npx
npx figma-export images -f Assets
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
# Global
figma-markup --frame "Frame Name" [--variant "Variant Name"] [--output ./output] [--name ComponentName] [--json]

# Local/npx
npx figma-markup --frame "Frame Name" [--variant "Variant Name"] [--output ./output] [--name ComponentName] [--json]

# Development
node src/markup.js --frame "Frame Name" [--variant "Variant Name"] [--output ./output] [--name ComponentName] [--json]
```

#### Main Options

- `-f, --frame <name>` — Figma frame/node name for markup (required)
- `-v, --variant <name>` — variant node name inside the component (optional, use for multi-variant components)
- `-o, --output <dir>` — output directory (default: ./output/components)
- `-n, --name <component>` — component/class name for the root node (rame or variant name used by default)
- `-c, --css` – render CSS code instead of SCSS
- `--json` — also save the selected node as JSON, may be useful for debugging

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
figma-markup --frame "Chat Message" --variant "Direction=Incoming"

# Local/npx
npx figma-markup --frame "Chat Message" --variant "Direction=Incoming"
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
   node src/figma-export.js <command> [options]
   node src/markup.js [options]
   ```

## Release

To create a new release:

1. **Bump the version**: Run `npm version {patch|minor|major}` to update the version number in `package.json` and create a git commit and tag
   - `patch`: Bug fixes (0.2.0 → 0.2.1)
   - `minor`: New features (0.2.0 → 0.3.0)
   - `major`: Breaking changes (0.2.0 → 1.0.0)

2. **Push changes**: Push the commit and tag to the repository:

   ```bash
   git push && git push --tags
   ```

3. **Create GitHub release**: Go to the [GitHub Releases](../../../releases) page and:
   - Click "Create a new release"
   - Select the tag created in step 1
   - Add release notes describing the changes
   - Click "Publish release"

4. **Automatic NPM publication**: Once the GitHub release is published, the package will be automatically published to NPM via GitHub Actions workflow.

> **Note**: Make sure you have the `NPM_TOKEN` secret configured in your repository settings for the NPM publication to work.
