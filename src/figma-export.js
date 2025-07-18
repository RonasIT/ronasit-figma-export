#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const { Command } = require('commander');
const url = require('url');

const program = new Command();

const FIGMA_API_URL = 'https://api.figma.com';
const FIGMA_API_TOKEN = process.env.FIGMA_API_TOKEN;
const FIGMA_FILE_URL = process.env.FIGMA_FILE_URL;
const OUTPUT_DIR = process.env.OUTPUT_DIR || './output';

if (!FIGMA_API_TOKEN || !FIGMA_FILE_URL) {
  console.error('Please provide FIGMA_API_TOKEN and FIGMA_FILE_URL in your .env file');
  process.exit(1);
}

const extractFileId = (fileUrl) => {
  try {
    const parsedUrl = new url.URL(fileUrl);
    const pathSegments = parsedUrl.pathname.split('/');
    return pathSegments[2]; // Assuming the format of the path is /file/{fileId}/
  } catch (error) {
    throw new Error('Invalid Figma file URL');
  }
};

const FIGMA_FILE_ID = extractFileId(FIGMA_FILE_URL);
let fileDataCache = null;

// Function to fetch Figma file - reads from local cache unless forceUpdate is true or cache is missing
async function fetchFigmaFile({ forceUpdate = false, cachePath = `${OUTPUT_DIR}/figmaFileContent.json` } = {}) {
  if (!forceUpdate) {
    // Try to read from local cache file
    try {
      if (fs.existsSync(cachePath)) {
        const cachedData = fs.readFileSync(cachePath, 'utf-8');
        fileDataCache = JSON.parse(cachedData);
        console.log(`[figma-export-tool] Loaded Figma file from local cache: ${cachePath}`);
        return fileDataCache;
      }
    } catch (err) {
      console.warn('[figma-export-tool] Warning: Failed to read local cache, will fetch from API.', err.message);
    }
  }
  // If forceUpdate or cache missing, fetch from API
  try {
    console.log('[figma-export-tool] Fetching Figma file from API...');
    const response = await axios.get(`${FIGMA_API_URL}/v1/files/${FIGMA_FILE_ID}`, {
      headers: {
        'X-Figma-Token': FIGMA_API_TOKEN,
      },
    });
    fileDataCache = response.data;
    // Save to cache file
    try {
      fs.writeFileSync(cachePath, JSON.stringify(fileDataCache, null, 2));
      console.log(`[figma-export-tool] Saved Figma file to cache: ${cachePath}`);
    } catch (err) {
      console.warn('[figma-export-tool] Warning: Failed to write cache file.', err.message);
    }
    return fileDataCache;
  } catch (error) {
    throw new Error(`Error fetching file data: ${error.message}`);
  }
}

// Universal function to sanitize a name with any separator
function sanitize(name, sep) {
  return name
    .toLowerCase()
    .replace(/[ \/\\#&,+()$~%.'":*?<>{}-]/g, sep) // All special characters and hyphens replaced with sep
    .replace(new RegExp(sep + '+', 'g'), sep) // Multiple sep replaced with one
    .replace(new RegExp('^' + sep + '|' + sep + '$', 'g'), ''); // Removing sep at the beginning and end
}

program.name('figma-export-tool').description('A CLI tool to export Figma file content and variables').version('1.0.0');

program
  .command('content')
  .description('Export the Figma file content to a JSON file')
  .option('-o, --output <type>', 'Output directory', OUTPUT_DIR)
  .option('-n, --name <type>', 'Name of output JSON file', 'figmaFileContent.json')
  .action(async (cmd) => {
    await exportContent({ output: cmd.output, name: cmd.name });
  });

async function exportContent({ output = OUTPUT_DIR, name = 'figmaFileContent.json' } = {}) {
  console.log('Exporting file content...');
  if (!fs.existsSync(output)) {
    fs.mkdirSync(output, { recursive: true });
  }
  try {
    const fileData = await fetchFigmaFile({
      forceUpdate: true,
      cachePath: `${output}/${name}`,
    });
    const jsonFilePath = `${output}/${name}`;
    fs.writeFileSync(jsonFilePath, JSON.stringify(fileData, null, 2));
    console.log(`Figma file content saved to: ${jsonFilePath}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

program
  .command('variables')
  .description('Extract variables from the Figma file and save them to a JSON file')
  .option('-o, --output <type>', 'Output directory', OUTPUT_DIR)
  .option('-n, --name <type>', 'Name of output JSON file', 'variables.json')
  .option('-u, --update', 'Force update from Figma API, ignore local cache')
  .action(async (cmd) => {
    await exportVariables({
      output: cmd.output,
      name: cmd.name,
      forceUpdate: !!cmd.update,
    });
  });

async function exportVariables({ output = OUTPUT_DIR, name = 'variables.json', forceUpdate = false } = {}) {
  console.log('Exporting variables...');
  if (!fs.existsSync(output)) {
    fs.mkdirSync(output, { recursive: true });
  }
  if (!fs.existsSync(`${output}/scss`)) {
    fs.mkdirSync(`${output}/scss`, { recursive: true });
  }

  function extractVariables(node, idMap) {
    const paletteVars = {};
    const typekitVars = {};

    function traverse(node, parentName = '') {
      if (node.visible === false) {
        return; // Skip invisible nodes
      }

      if (node.type === 'INSTANCE' && (node.name === 'Typekit row' || node.name === 'Palette row')) {
        const variableData = traverseChildren(node, node.name);

        if (variableData && Object.keys(variableData.values).length > 0) {
          // Save id in idMap
          if (variableData.id) {
            idMap[variableData['variable name']] = variableData.id;
          }
          if (Object.keys(variableData.values).length === 1) {
            // If only one value, save it directly
            if (node.name === 'Palette row') {
              paletteVars[variableData['variable name']] = Object.values(variableData.values)[0];
            } else {
              typekitVars[variableData['variable name']] = Object.values(variableData.values)[0];
            }
          } else {
            // Otherwise, save the object
            if (node.name === 'Palette row') {
              paletteVars[variableData['variable name']] = variableData.values;
            } else {
              typekitVars[variableData['variable name']] = variableData.values;
            }
          }
        }
      }

      if (node.children) {
        for (const child of node.children) {
          traverse(child, node.name);
        }
      }
    }

    function resolveHexColor(fills) {
      if (!fills || fills.length === 0 || !fills[0].color) return null;
      const color = fills[0].color;
      const r = Math.round(color.r * 255);
      const g = Math.round(color.g * 255);
      const b = Math.round(color.b * 255);
      const a = fills[0].opacity !== undefined ? fills[0].opacity : 1;
      if (a < 1) {
        return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
      }
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    function traverseChildren(node, nodeType) {
      const variableData = { values: {} };
      let id = null;

      function collectValues(node, contextName) {
        if (node.visible === false) {
          return; // Skip invisible nodes
        }

        if (node.type === 'TEXT' && node.name === 'variable name') {
          variableData['variable name'] = sanitize(node.characters, '-'); // Convert name
        }

        if (nodeType === 'Palette row' && node.name === 'value') {
          const color = resolveHexColor(node.fills);
          // Find id
          if (
            !id &&
            node.boundVariables &&
            node.boundVariables.fills &&
            Array.isArray(node.boundVariables.fills) &&
            node.boundVariables.fills[0] &&
            node.boundVariables.fills[0].id
          ) {
            id = node.boundVariables.fills[0].id;
          }
          if (color) {
            variableData.values[contextName] = color;
          }
        } else if (nodeType === 'Typekit row' && node.name === 'value') {
          let value = node.characters;
          // Add px if value is a number
          if (/^\d+$/.test(value)) {
            value = value + 'px';
          }
          // Find id
          if (!id && node.boundVariables && node.boundVariables.characters && node.boundVariables.characters.id) {
            id = node.boundVariables.characters.id;
          }
          variableData.values[contextName] = value;
        }

        if (node.children) {
          for (const child of node.children) {
            collectValues(child, contextName);
          }
        }
      }

      for (const child of node.children || []) {
        const contextName = sanitize(child.name, '-'); // Use parent name
        collectValues(child, contextName);
      }

      if (id) variableData.id = id;
      return variableData;
    }

    traverse(node);
    return { palette: paletteVars, typekit: typekitVars };
  }

  try {
    const fileData = await fetchFigmaFile({ forceUpdate });
    const variableIds = {};
    const variables = extractVariables(fileData.document, variableIds);

    const jsonFilePath = `${output}/${name}`;
    fs.writeFileSync(jsonFilePath, JSON.stringify(variables, null, 2));
    console.log(`Extracted variables saved to: ${jsonFilePath}`);

    // Save a separate file with variable ids
    const idsFilePath = `${output}/variableIds.json`;
    fs.writeFileSync(idsFilePath, JSON.stringify(variableIds, null, 2));
    console.log(`Variable ids saved to: ${idsFilePath}`);

    // SCSS export
    // paletteVars and typekitVars are now taken from variables
    const paletteVars = Object.entries(variables.palette);
    const typekitVars = Object.entries(variables.typekit);

    let scss = ':root {\n';
    // Palette
    scss += '  /* Palette */\n';
    let themes = [];
    for (const [name, value] of paletteVars) {
      if (typeof value === 'string') {
        scss += `  --${name}: ${value};\n`;
      } else if (typeof value === 'object' && value !== null) {
        themes = Object.keys(value);
        if (themes.length > 0) {
          scss += `  --${name}: ${value[themes[0]]};\n`;
        }
      }
    }
    for (let i = 1; i < themes.length; i++) {
      const theme = themes[i];
      scss += `  .${theme}_mode, [data-theme='${theme}'] {\n`;
      for (const [name, value] of paletteVars) {
        scss += `    --${name}: ${value[theme]};\n`;
      }
      scss += `  }\n`;
    }

    // Typekit
    scss += '\n  /* Typekit */\n';
    // Collect desktop and other platforms separately
    const desktopVars = [];
    const platformVars = {};
    const scssBreakpoints = [];
    for (const [key, value] of typekitVars) {
      if (key.includes('breakpoint')) {
        // For each mode, except desktop, create a SCSS variable
        if (typeof value === 'object') {
          for (const platform in value) {
            if (
              platform !== 'desktop' &&
              value[platform] !== '-' &&
              value[platform] !== '' &&
              value[platform] !== undefined
            ) {
              scssBreakpoints.push(`$${platform}: ${value[platform]};`);
            }
          }
        } else if (value !== '-' && value !== '' && value !== undefined) {
          scssBreakpoints.push(`$mobile: ${value};`);
        }
        continue; // Do not add to custom properties
      }
      if (typeof value === 'object') {
        for (const platform in value) {
          let outValue = value[platform];
          if (typeof outValue === 'string' && !/^[-+]?\d+(px|%|em|rem)?$/.test(outValue)) {
            outValue = `"${outValue}"`;
          }
          if (platform === 'desktop') {
            desktopVars.push(`  --${key}: ${outValue};`);
          } else {
            if (!platformVars[platform]) platformVars[platform] = [];
            platformVars[platform].push(`    --${key}: ${outValue};`);
          }
        }
      } else {
        let outValue = value;
        if (typeof outValue === 'string' && !/^[-+]?\d+(px|%|em|rem)?$/.test(outValue)) {
          outValue = `"${outValue}"`;
        }
        desktopVars.push(`  --${key}: ${outValue};`);
      }
    }
    // Insert SCSS breakpoint variables before :root
    if (scssBreakpoints.length) {
      scss = scssBreakpoints.join('\n') + '\n' + scss;
    }
    // Desktop
    scss += desktopVars.join('\n') + '\n';
    // Other platforms
    for (const platform in platformVars) {
      scss += `  @media (max-width: $${platform}) {\n` + platformVars[platform].join('\n') + '\n  }\n';
    }
    scss += '}\n';
    const scssFilePath = `${output}/scss/variables.scss`;
    fs.writeFileSync(scssFilePath, scss);
    console.log(`SCSS variables saved to: ${scssFilePath}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

program
  .command('icons')
  .description('Extract icons from Figma and generate icons.scss')
  .option('-f, --frame <type>', 'Frame name', 'icon_sprite')
  .option('-o, --output <type>', 'Output directory', OUTPUT_DIR)
  .option('-n, --name <type>', 'Name of output SCSS file', 'icons.scss')
  .option('-u, --update', 'Force update from Figma API, ignore local cache')
  .action(async (cmd) => {
    await exportIcons({
      output: cmd.output,
      name: cmd.name,
      frame: cmd.frame,
      forceUpdate: !!cmd.update,
    });
  });

async function exportIcons({
  frame = 'icon_sprite',
  output = OUTPUT_DIR,
  name = 'icons.scss',
  forceUpdate = false,
} = {}) {
  console.log('Exporting icons sprite...');
  if (!fs.existsSync(`${output}/scss`)) {
    fs.mkdirSync(`${output}/scss`, { recursive: true });
  }
  try {
    const fileData = await fetchFigmaFile({ forceUpdate });
    // Search for icons_sprite
    function findIconsSprite(node) {
      if (node.name === frame) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findIconsSprite(child);
          if (found) return found;
        }
      }
      return null;
    }
    const iconsSprite = findIconsSprite(fileData.document);
    if (!iconsSprite || !iconsSprite.children) {
      throw new Error('icons_sprite not found or has no children');
    }
    // Generate SCSS
    let scss = `.icon {display: inline-block; vertical-align: top; width: 24px; height: 24px;\n background: url(icons.svg);  --bg-position: 0 0; background-position: var(--bg-position); background-repeat: no-repeat;\n`;
    scss += `  &_mask {background: var(--text-primary); mask-image: url(icons.svg); mask-repeat: no-repeat; mask-position: var(--bg-position);}\n`;
    // Get coordinates of icons_sprite
    const spriteBox = iconsSprite.absoluteBoundingBox || { x: 0, y: 0 };
    for (const icon of iconsSprite.children) {
      const name = sanitize(icon.name, '_'); // For icons, use _
      // Get relative coordinates and round
      let x =
        icon.absoluteBoundingBox && icon.absoluteBoundingBox.x !== undefined
          ? Math.round(icon.absoluteBoundingBox.x - spriteBox.x)
          : 0;
      let y =
        icon.absoluteBoundingBox && icon.absoluteBoundingBox.y !== undefined
          ? Math.round(icon.absoluteBoundingBox.y - spriteBox.y)
          : 0;
      let sizeRule = '';
      // Check size
      let w = icon.width !== undefined ? icon.width : icon.absoluteBoundingBox ? icon.absoluteBoundingBox.width : 24;
      let h = icon.height !== undefined ? icon.height : icon.absoluteBoundingBox ? icon.absoluteBoundingBox.height : 24;
      if (w !== 24 || h !== 24) {
        sizeRule = ` width: ${w}px; height: ${h}px;`;
      }
      scss += `  &_${name} {--bg-position: -${x}px -${y}px;${sizeRule}}\n`;
    }
    scss += `}`;
    const scssFilePath = `${output}/scss/${name}`;
    fs.writeFileSync(scssFilePath, scss);
    console.log(`Icons SCSS saved to: ${scssFilePath}/scss/${name}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

program
  .command('images')
  .description('Export images for elements with exportSettings from Figma')
  .option('-o, --output <type>', 'Output directory', OUTPUT_DIR)
  .option('-f, --frame <type>', 'Frame name (optional)')
  .option('--list', 'List all exportable images without downloading')
  .option('-u, --update', 'Force update from Figma API, ignore local cache')
  .action(async (cmd) => {
    await exportImages({
      output: cmd.output,
      frame: cmd.frame,
      list: cmd.list,
      forceUpdate: !!cmd.update,
    });
  });

async function exportImages({ output = OUTPUT_DIR, frame, list = false, forceUpdate = false } = {}) {
  console.log('Exporting images...');
  if (!list && !fs.existsSync(`${output}/img`)) {
    fs.mkdirSync(`${output}/img`, { recursive: true });
  }
  try {
    const fileData = await fetchFigmaFile({ forceUpdate });
    // Search for the specified frame, if provided
    let searchRoot = fileData.document;
    if (frame) {
      function findFrame(node) {
        if (node.name === frame) return node;
        if (node.children) {
          for (const child of node.children) {
            const found = findFrame(child);
            if (found) return found;
          }
        }
        return null;
      }
      const frameNode = findFrame(fileData.document);
      if (!frameNode) {
        console.log(`Frame '${frame}' not found.`);
        return;
      }
      searchRoot = frameNode;
    }
    // Recursive search for all visible nodes with exportSettings
    function findExportableNodes(node, result = []) {
      if (node.visible === false) return result;
      if (node.exportSettings && node.exportSettings.length > 0) {
        result.push(node);
      }
      if (node.children) {
        for (const child of node.children) {
          findExportableNodes(child, result);
        }
      }
      return result;
    }
    const exportableNodes = findExportableNodes(searchRoot);
    if (exportableNodes.length === 0) {
      console.log('No elements with exportSettings found.');
      return;
    }
    if (list) {
      // Collect all images
      const imagesList = [];
      for (const node of exportableNodes) {
        for (const setting of node.exportSettings) {
          let format = (setting.format || 'png').toLowerCase();
          const suffix = setting.suffix || '';
          let scale = 1;
          if (setting.constraint && typeof setting.constraint.value === 'number') {
            if (setting.constraint.type === 'SCALE') {
              scale = setting.constraint.value;
            } else if (
              setting.constraint.type === 'WIDTH' &&
              node.absoluteBoundingBox &&
              node.absoluteBoundingBox.width
            ) {
              scale = setting.constraint.value / node.absoluteBoundingBox.width;
            } else if (
              setting.constraint.type === 'HEIGHT' &&
              node.absoluteBoundingBox &&
              node.absoluteBoundingBox.height
            ) {
              scale = setting.constraint.value / node.absoluteBoundingBox.height;
            } else {
              scale = 1;
            }
            if (scale < 0.01) scale = 0.01;
            if (scale > 4) scale = 4;
          }
          imagesList.push({
            name: node.name,
            id: node.id,
            format,
            suffix,
            scale,
          });
        }
      }
      console.log(`Total exportable images: ${imagesList.length}`);
      if (imagesList.length < 100) {
        for (const img of imagesList) {
          console.log(
            `Name: ${img.name}, ID: ${img.id}, Format: ${img.format}, Suffix: ${img.suffix}, Scale: ${img.scale}`,
          );
        }
      } else {
        console.log('Too many images to list individually.');
      }
      return;
    }
    // Get images via Figma API
    for (const node of exportableNodes) {
      for (const setting of node.exportSettings) {
        // Form request parameters
        let format = (setting.format || 'png').toLowerCase();
        const suffix = setting.suffix || '';
        let scale = 1;
        if (setting.constraint && typeof setting.constraint.value === 'number') {
          if (setting.constraint.type === 'SCALE') {
            scale = setting.constraint.value;
          } else if (
            setting.constraint.type === 'WIDTH' &&
            node.absoluteBoundingBox &&
            node.absoluteBoundingBox.width
          ) {
            scale = setting.constraint.value / node.absoluteBoundingBox.width;
          } else if (
            setting.constraint.type === 'HEIGHT' &&
            node.absoluteBoundingBox &&
            node.absoluteBoundingBox.height
          ) {
            scale = setting.constraint.value / node.absoluteBoundingBox.height;
          } else {
            scale = 1;
          }
          if (scale < 0.01) scale = 0.01;
          if (scale > 4) scale = 4;
        }
        const nodeId = node.id;
        if (!nodeId || typeof nodeId !== 'string') {
          console.warn(`Invalid nodeId for node: ${node.name}`);
          continue;
        }
        // Check supported formats
        if (!['svg', 'png', 'jpg', 'pdf'].includes(format)) {
          console.warn(`Unsupported format '${format}' for node: ${node.name} (${nodeId}). Skipped.`);
          continue;
        }
        // Request to Figma API
        try {
          const imageUrlResp = await axios.get(`${FIGMA_API_URL}/v1/images/${FIGMA_FILE_ID}`, {
            headers: { 'X-Figma-Token': FIGMA_API_TOKEN },
            params: {
              ids: nodeId,
              format,
              scale,
            },
          });
          const imageUrl = imageUrlResp.data.images[nodeId];
          if (!imageUrl) {
            console.warn(`No image URL for node ${node.name} (${nodeId}) [format: ${format}, scale: ${scale}]`);
            continue;
          }
          // Download image
          const imageResp = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
          });
          // Form file name
          const baseName = sanitize(node.name, '_');
          const fileName = `${baseName}${suffix ? suffix : ''}.${format}`;
          const filePath = `${output}/img/${fileName}`;
          fs.writeFileSync(filePath, Buffer.from(imageResp.data));
          console.log(`Exported: ${filePath}`);
        } catch (err) {
          console.error(
            `Error exporting node '${node.name}' (${nodeId}):`,
            err.response ? err.response.data : err.message,
          );
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

program
  .command('all')
  .description('Run all export commands: content, variables, icons, images')
  .action(async () => {
    try {
      await exportContent();
      await exportVariables();
      await exportIcons();
      await exportImages();
      console.log('All exports completed successfully.');
    } catch (error) {
      console.error('Error in all command:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
