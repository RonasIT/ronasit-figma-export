#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');

// Utility for converting part of a Figma file structure to HTML and CSS
/**
 * Converts a part of the Figma structure to HTML and CSS
 * @param {Object} figmaNode - Node or part of the Figma structure
 * @returns {{ html: string, css: string }}
 */
function convertFigmaToMarkup(figmaNode, rootClassOverride) {
  // Helper to sanitize class names
  function sanitize(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  }

  // Helper to convert a string to PascalCase for component names
  function toPascalCase(str) {
    return String(str)
      .replace(/[^a-zA-Z0-9]+/g, ' ') // Replace non-alphanumeric with space
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  // Helper to format numbers: integers as is, floats to 3 decimal places
  function formatNum(val) {
    return (typeof val === 'number' && !Number.isInteger(val)) ? val.toFixed(3) : val;
  }

  // Helper to convert Figma color/opacity to CSS string
  function colorToCss(colorObj, opacity) {
    const c = colorObj;
    const a = opacity !== undefined ? opacity : 1;
    if (a < 1) {
      return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${formatNum(a)})`;
    } else {
      return `#${((1 << 24) + (Math.round(c.r * 255) << 16) + (Math.round(c.g * 255) << 8) + Math.round(c.b * 255)).toString(16).slice(1)}`;
    }
  }

  // Map Figma node types to HTML tags
  function getTag(node) {
    switch (node.type) {
      case 'TEXT':
        return 'span';
      case 'IMAGE':
        return 'img';
      case 'RECTANGLE':
      case 'VECTOR':
      case 'ELLIPSE':
      case 'LINE':
      case 'POLYGON':
      case 'STAR':
      case 'FRAME':
      case 'GROUP':
      case 'COMPONENT':
      case 'INSTANCE':
        return 'div';
      default:
        return 'div';
    }
  }

  // Collect unique class names and their corresponding nodes
  const classMap = new Map();

  // Recursively generate pretty JSX
  function nodeToJsx(node, indent = 0, isRoot = false, rootClassName = null) {
    const tag = getTag(node);
    const nodeClass = isRoot
      ? (rootClassName ? rootClassName : sanitize(node.name))
      : `${rootClass}_${sanitize(node.name)}`;
    const indentStr = '  '.repeat(indent);
    // For INSTANCE nodes, do not process children
    if (node.type === 'INSTANCE' && !isRoot) {
      if (!classMap.has(nodeClass)) {
        classMap.set(nodeClass, node);
      }
      const componentName = toPascalCase(node.name);
      // Convert componentProperties to JSX props
      let propsStr = `className=\"${nodeClass}\"`;
      if (node.componentProperties && typeof node.componentProperties === 'object') {
        for (const [key, valueObj] of Object.entries(node.componentProperties)) {
          // Remove # and everything after for prop name
          let cleanKey = key.includes('#') ? key.split('#')[0] : key;
          let pascal = toPascalCase(cleanKey);
          let propName = pascal.charAt(0).toLowerCase() + pascal.slice(1);
          let propValue = valueObj && typeof valueObj.value !== 'undefined' ? valueObj.value : valueObj;
          if (typeof propValue === 'string') {
            // Convert 'True'/'False' to boolean
            if (propValue.toLowerCase() === 'true') {
              propsStr += ` ${propName}={true}`;
            } else if (propValue.toLowerCase() === 'false') {
              propsStr += ` ${propName}={false}`;
            } else {
              // Convert string values to camelCase as well
              let pascalVal = toPascalCase(propValue);
              let camelVal = pascalVal.charAt(0).toLowerCase() + pascalVal.slice(1);
              propsStr += ` ${propName}=\"${camelVal}\"`;
            }
          } else if (typeof propValue === 'number' || typeof propValue === 'boolean') {
            propsStr += ` ${propName}={${propValue}}`;
          }
        }
      }
      return `${indentStr}<${componentName} ${propsStr} />`;
    }
    let childrenJsx = '';
    if (node.children && node.children.length > 0) {
      childrenJsx = node.children.map(child => nodeToJsx(child, indent + 1, false, rootClassName)).join('\n');
    }
    if (!classMap.has(nodeClass)) {
      classMap.set(nodeClass, node);
    }
    if (isRoot) {
      if (childrenJsx) {
        return `${indentStr}<div className=\"${nodeClass}\">\n${childrenJsx}\n${indentStr}</div>`;
      } else {
        return `${indentStr}<div className=\"${nodeClass}\"></div>`;
      }
    } else if (tag === 'img') {
      return `${indentStr}<img className=\"${nodeClass}\" alt=\"${sanitize(node.name)}\" />`;
    } else if (tag === 'span' && node.characters) {
      return `${indentStr}<span className=\"${nodeClass}\">${node.characters}</span>`;
    } else {
      if (childrenJsx) {
        return `${indentStr}<${tag} className=\"${nodeClass}\">\n${childrenJsx}\n${indentStr}</${tag}>`;
      } else {
        return `${indentStr}<${tag} className=\"${nodeClass}\"></${tag}>`;
      }
    }
  }

  // Generate SCSS for a node (returns only the class rule, not nested)
  function nodeToScss(node, className) {
    // For INSTANCE nodes, do not generate SCSS for children or self
    if (node.type === 'INSTANCE') {
      return '';
    }
    let props = [];
    // Text node properties
    if (node.type === 'TEXT') {
      // fills -> color
      if (node.fills && Array.isArray(node.fills) && node.fills[0] && node.fills[0].color) {
        const c = node.fills[0].color;
        const a = node.fills[0].opacity !== undefined ? node.fills[0].opacity : 1;
        props.push(`color: ${colorToCss(c, a)};`);
      }
      // Opacity
      if (typeof node.opacity === 'number') {
        props.push(`opacity: ${formatNum(node.opacity)};`);
      }
      const style = node.style || {};
      // Use fontStyle as font-weight (per user request)
      if (typeof style.fontStyle === 'string') {
        props.push(`font-weight: ${style.fontStyle};`);
      }
      if (typeof style.fontSize === 'number') {
        props.push(`font-size: ${formatNum(style.fontSize)}px;`);
      }
      if (typeof style.textAlignHorizontal === 'string') {
        let align = style.textAlignHorizontal.toLowerCase();
        if (align === 'left' || align === 'right' || align === 'center' || align === 'justify') {
          props.push(`text-align: ${align};`);
        }
      }
      if (typeof style.letterSpacing === 'number') {
        props.push(`letter-spacing: ${formatNum(style.letterSpacing)}px;`);
      }
      if (typeof style.lineHeightPercentFontSize === 'number') {
        props.push(`line-height: ${formatNum(style.lineHeightPercentFontSize)}%;`);
      }
    } else {
      // Non-text nodes
      if (node.fills && Array.isArray(node.fills) && node.fills[0] && node.fills[0].color) {
        const c = node.fills[0].color;
        const a = node.fills[0].opacity !== undefined ? node.fills[0].opacity : 1;
        props.push(`background: ${colorToCss(c, a)};`);
      }
      // Opacity
      if (typeof node.opacity === 'number') {
        props.push(`opacity: ${formatNum(node.opacity)};`);
      }
      // Border radius
      if (node.cornerRadius !== undefined) {
        props.push(`border-radius: ${formatNum(node.cornerRadius)}px;`);
      }
      // Border
      if (node.strokes && Array.isArray(node.strokes) && node.strokes[0] && node.strokes[0].color) {
        const c = node.strokes[0].color;
        const a = node.strokes[0].opacity !== undefined ? node.strokes[0].opacity : 1;
        props.push(`border: 1px solid ${colorToCss(c, a)};`);
      }
      // Box-shadow (DROP_SHADOW effects)
      if (Array.isArray(node.effects)) {
        const shadows = node.effects.filter(e => e.type === 'DROP_SHADOW' && e.visible !== false);
        if (shadows.length > 0) {
          const shadowStrs = shadows.map(e => {
            const color = e.color ? colorToCss(e.color, e.color.a) : 'rgba(0,0,0,0.25)';
            const x = typeof e.offset?.x === 'number' ? formatNum(e.offset.x) : 0;
            const y = typeof e.offset?.y === 'number' ? formatNum(e.offset.y) : 0;
            const blur = typeof e.radius === 'number' ? formatNum(e.radius) : 0;
            const spread = typeof e.spread === 'number' ? formatNum(e.spread) : 0;
            return `${x}px ${y}px ${blur}px ${spread}px ${color}`.replace(' 0px', '');
          });
          props.push(`box-shadow: ${shadowStrs.join(', ')};`);
        }
      }
      // Overflow
      if (typeof node.overflowDirection === 'string' && node.overflowDirection !== 'NONE') {
        props.push('overflow: scroll;');
      } else if (node.clipsContent === true) {
        props.push('overflow: hidden;');
      }
      // Flexbox layout
      if (node.layoutMode === 'HORIZONTAL' || node.layoutWrap === true) {
        props.push('display: flex;');
        if (typeof node.paddingLeft === 'number' && typeof node.paddingRight === 'number' && typeof node.paddingTop === 'number' && typeof node.paddingBottom === 'number') {
          props.push(`padding: ${formatNum(node.paddingTop)}px ${formatNum(node.paddingRight)}px ${formatNum(node.paddingBottom)}px ${formatNum(node.paddingLeft)}px;`);
        }
        if (typeof node.itemSpacing === 'number') {
          props.push(`gap: ${formatNum(node.itemSpacing)}px;`);
        }
        // flex-wrap
        if ('layoutWrap' in node) {
          props.push(`flex-wrap: ${node.layoutWrap === 'WRAP' ? 'wrap' : 'nowrap'};`);
        }
        // primaryAxisAlignItems -> justify-content
        if (typeof node.primaryAxisAlignItems === 'string') {
          let justify = 'flex-start';
          switch (node.primaryAxisAlignItems) {
            case 'MIN': justify = 'flex-start'; break;
            case 'CENTER': justify = 'center'; break;
            case 'MAX': justify = 'flex-end'; break;
            case 'SPACE_BETWEEN': justify = 'space-between'; break;
          }
          props.push(`justify-content: ${justify};`);
        }
        // counterAxisAlignItems -> align-items
        if (typeof node.counterAxisAlignItems === 'string') {
          let align = 'flex-start';
          switch (node.counterAxisAlignItems) {
            case 'MIN': align = 'flex-start'; break;
            case 'CENTER': align = 'center'; break;
            case 'MAX': align = 'flex-end'; break;
            case 'BASELINE': align = 'baseline'; break;
            case 'SPACE_BETWEEN': align = 'space-between'; break;
          }
          props.push(`align-items: ${align};`);
        }
      }
      // Max width/height
      if (typeof node.maxWidth === 'number') {
        props.push(`max-width: ${formatNum(node.maxWidth)}px;`);
      }
      if (typeof node.maxHeight === 'number') {
        props.push(`max-height: ${formatNum(node.maxHeight)}px;`);
      }
      // width/height only if layoutSizingHorizontal/Vertical is FIXED
      if (node.layoutSizingHorizontal === 'FIXED' && node.absoluteBoundingBox && typeof node.absoluteBoundingBox.width === 'number') {
        props.push(`width: ${formatNum(node.absoluteBoundingBox.width)}px;`);
      }
      if (node.layoutSizingVertical === 'FIXED' && node.absoluteBoundingBox && typeof node.absoluteBoundingBox.height === 'number') {
        props.push(`height: ${formatNum(node.absoluteBoundingBox.height)}px;`);
      }
    }
    return props.join(' ');
  }

  const rootClass = sanitize(rootClassOverride ? rootClassOverride : figmaNode.name);
  const jsx = nodeToJsx(figmaNode, 0, true, rootClass);

  // SCSS: always output rootClass (from --name or figmaNode.name) first, then all other classes indented inside
  const classEntries = Array.from(classMap.entries());
  // Find the node that matches the actual root node (by id)
  const rootEntry = classEntries.find(([, node]) => node === figmaNode);
  let scss = '';
  if (rootEntry) {
    const rootRule = nodeToScss(figmaNode, rootClass);
    scss += `.${rootClass} {${rootRule}`;
    classEntries.forEach(([className, node]) => {
      // Don't output the rootClass as a nested rule
      if (node === figmaNode) return;
      const rule = nodeToScss(node, className);
      if (rule) {
        const nested = className.startsWith(rootClass + '_') ? '&' + className.slice(rootClass.length) : `.${className}`;
        scss += `\n  ${nested} {${rule}}`;
      }
    });
    scss += `\n}`;
  }

  return {
    jsx,
    scss: scss
  };
}

const program = new Command();

program
  .name('markup')
  .description('Convert a part of a Figma file structure to HTML and CSS')
  .version('1.0.0');

program
  .requiredOption('-f, --frame <name>', 'Frame or node name in the Figma file structure')
  .option('-i, --input <path>', 'Path to Figma JSON file', './output/figmaFileContent.json')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('-n, --name <component>', 'Component name to use as root class')
  .option('--json', 'Also save the selected Figma node as a JSON file')
  .action((options) => {
    const { frame, input, output, name, json } = options;
    if (!fs.existsSync(input)) {
      console.error(`Input file not found: ${input}`);
      process.exit(1);
    }
    const figmaData = JSON.parse(fs.readFileSync(input, 'utf-8'));
    // Recursively search for the frame/node by name
    function findNodeByName(node, name) {
      if (node.name === name) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findNodeByName(child, name);
          if (found) return found;
        }
      }
      return null;
    }
    const targetNode = findNodeByName(figmaData.document, frame);
    if (!targetNode) {
      console.error(`Frame or node named '${frame}' not found in the Figma file.`);
      process.exit(1);
    }
    const rootClass = name ? name : frame;
    const { jsx, scss } = convertFigmaToMarkup(targetNode, rootClass);
    if (!fs.existsSync(output)) {
      fs.mkdirSync(output, { recursive: true });
    }
    fs.writeFileSync(path.join(output, `${rootClass}.jsx`), jsx);
    fs.writeFileSync(path.join(output, `${rootClass}.scss`), scss);
    if (json) {
      fs.writeFileSync(path.join(output, `${rootClass}.json`), JSON.stringify(targetNode, null, 2));
    }
    console.log(`JSX and SCSS for '${rootClass}' exported to ${output}`);
    if (json) {
      console.log(`JSON for '${rootClass}' exported to ${output}`);
    }
  });

program.parse(process.argv);

module.exports = {
  convertFigmaToMarkup,
}; 