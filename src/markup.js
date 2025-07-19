#!/usr/bin/env node

require('dotenv').config();
const { Command } = require('commander');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = process.env.OUTPUT_DIR || './output';

// Utility for converting part of a Figma file structure to HTML and CSS
/**
 * Converts a part of the Figma structure to HTML and CSS
 * @param {Object} figmaNode - Node or part of the Figma structure
 * @returns {{ html: string, css: string }}
 */
function convertFigmaToMarkup(figmaNode, rootClassOverride, figmaDocument) {
  // Load variableIds.json if present
  let variableIdMap = {};
  try {
    variableIdMap = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'variableIds.json'), 'utf-8'));
  } catch (e) {
    // ignore if not found
  }

  // Helper to sanitize class names
  function sanitize(name) {
    return String(name)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_');
  }

  // Helper to convert a string to PascalCase for component names
  function toPascalCase(str) {
    return String(str)
      .replace(/[^a-zA-Z0-9]+/g, ' ') // Replace non-alphanumeric with space
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  // Helper to format numbers: integers as is, floats to 3 decimal places
  function formatNum(val) {
    return typeof val === 'number' && !Number.isInteger(val) ? val.toFixed(3) : val;
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

  // Собираем карту id -> parentNode
  // Build parent map using the full document
  const parentMap = new Map();
  function buildParentMap(node, parent = null) {
    if (node.id) {
      parentMap.set(node.id, parent);
    }
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        buildParentMap(child, node);
      }
    }
  }
  buildParentMap(figmaDocument, null);

  // Build id -> node map for fast lookup using the full document
  const idMap = new Map();
  function buildIdMap(node) {
    if (node.id) {
      idMap.set(node.id, node);
    }
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        buildIdMap(child);
      }
    }
  }
  buildIdMap(figmaDocument);

  // Helper to find master component for an INSTANCE node
  function findMasterComponent(instanceNode) {
    if (!instanceNode.componentId) return null;
    return idMap.get(instanceNode.componentId) || null;
  }

  // Helper to check if a component is an icon (by parent names)
  function isIconComponent(componentNode) {
    let current = componentNode;
    while (current) {
      const name = (current.name || '').toLowerCase();
      if (name.includes('icons') || name.includes('icon_sprite')) {
        return true;
      }
      const parent = parentMap.get(current.id);
      current = parent || null;
    }
    return false;
  }

  // Recursively generate pretty JSX
  function nodeToJsx(node, indent = 0, isRoot = false, rootClassName = null) {
    const tag = getTag(node);
    const nodeClass = isRoot
      ? rootClassName
        ? rootClassName
        : sanitize(node.name)
      : `${rootClass}_${sanitize(node.name)}`;
    const indentStr = '  '.repeat(indent);
    // For INSTANCE nodes, do not process children
    if (node.type === 'INSTANCE' && !isRoot) {
      if (!classMap.has(nodeClass)) {
        classMap.set(nodeClass, node);
      }

      const masterComponent = findMasterComponent(node);
      if (masterComponent && isIconComponent(masterComponent)) {
        // Render as <Icon name="nodeName" />
        return `${indentStr}<Icon name=\"${sanitize(node.name)}\" />`;
      }

      const componentName = toPascalCase(node.name);
      // Convert componentProperties to JSX props
      let propsArr = [`className={styles.${nodeClass}}`];
      if (node.componentProperties && typeof node.componentProperties === 'object') {
        for (const [key, valueObj] of Object.entries(node.componentProperties)) {
          // Remove # and everything after for prop name
          let cleanKey = key.includes('#') ? key.split('#')[0] : key;
          let pascal = toPascalCase(cleanKey);
          let propName = pascal.charAt(0).toLowerCase() + pascal.slice(1);
          // If propName is empty, generate a valid name with '_' prefix and ASCII codes
          if (!propName) {
            propName =
              '_' +
              Array.from(cleanKey)
                .map((c) => (c.match(/[a-zA-Z0-9]/) ? c : c.charCodeAt(0)))
                .join('');
          }
          let propValue = valueObj && typeof valueObj.value !== 'undefined' ? valueObj.value : valueObj;
          if (typeof propValue === 'string') {
            // Convert 'True'/'False' to boolean
            if (propValue.toLowerCase() === 'true') {
              propsArr.push(`${propName}={true}`);
            } else if (propValue.toLowerCase() === 'false') {
              propsArr.push(`${propName}={false}`);
            } else {
              propsArr.push(`${propName}="${propValue}"`);
            }
          } else if (typeof propValue === 'number' || typeof propValue === 'boolean') {
            propsArr.push(`${propName}={${propValue}}`);
          }
        }
      }
      // Formatting logic
      let jsxLine = `<${componentName} ${propsArr.join(' ')} />`;
      if (jsxLine.length <= 80) {
        return indentStr + jsxLine;
      } else {
        // Multiline formatting
        let multiline = `${indentStr}<${componentName}\n`;
        multiline += propsArr.map((p) => `${indentStr}  ${p}`).join('\n') + '\n';
        multiline += `${indentStr}/>`;
        return multiline;
      }
    }
    let childrenJsx = '';
    if (node.children && node.children.length > 0) {
      childrenJsx = node.children.map((child) => nodeToJsx(child, indent + 1, false, rootClassName)).join('\n');
    }
    if (!classMap.has(nodeClass)) {
      classMap.set(nodeClass, node);
    }
    if (isRoot) {
      if (childrenJsx) {
        return `${indentStr}<div className={styles.${nodeClass}}>` + `\n${childrenJsx}\n${indentStr}</div>`;
      } else {
        return `${indentStr}<div className={styles.${nodeClass}}></div>`;
      }
    } else if (tag === 'img') {
      return `${indentStr}<img className={styles.${nodeClass}} alt=\"${sanitize(node.name)}\" />`;
    } else if (tag === 'span' && node.characters) {
      return `${indentStr}<span className={styles.${nodeClass}}>${node.characters}</span>`;
    } else {
      if (childrenJsx) {
        return `${indentStr}<${tag} className={styles.${nodeClass}}>` + `\n${childrenJsx}\n${indentStr}</${tag}>`;
      } else {
        return `${indentStr}<${tag} className={styles.${nodeClass}}></${tag}>`;
      }
    }
  }

  // Generate SCSS for a node
  function nodeToScss(node, className, parentLayoutMode = null, parentNode = null) {
    let props = [];
    // Helper to resolve SCSS variable by boundVariable
    function getScssVarById(id) {
      for (const [varName, varId] of Object.entries(variableIdMap)) {
        if (varId === id) return `var(--${varName})`;
      }
      return null;
    }
    // Helper for calculating coordinates for absolute/fixed positioning
    function getPositionProps(box, parentBox, constraints) {
      const props = [];
      // Horizontal
      if (constraints.horizontal === 'RIGHT') {
        const right = parentBox.x + parentBox.width - (box.x + box.width);
        props.push(`right: ${formatNum(right)}px;`);
      } else if (constraints.horizontal === 'CENTER') {
        const left = (parentBox.width - box.width) / 2;
        props.push(`left: ${formatNum(left)}px;`);
      } else if (constraints.horizontal === 'SCALE') {
        const left = box.x - parentBox.x;
        props.push(`left: ${formatNum(left)}px;`);
      } else {
        // LEFT or default
        const left = box.x - parentBox.x;
        props.push(`left: ${formatNum(left)}px;`);
      }
      // Vertical
      if (constraints.vertical === 'BOTTOM') {
        const bottom = parentBox.y + parentBox.height - (box.y + box.height);
        props.push(`bottom: ${formatNum(bottom)}px;`);
      } else if (constraints.vertical === 'CENTER') {
        const top = (parentBox.height - box.height) / 2;
        props.push(`top: ${formatNum(top)}px;`);
      } else if (constraints.vertical === 'SCALE') {
        const top = box.y - parentBox.y;
        props.push(`top: ${formatNum(top)}px;`);
      } else {
        // TOP or default
        const top = box.y - parentBox.y;
        props.push(`top: ${formatNum(top)}px;`);
      }
      return props;
    }
    // Helper for calculating layoutSizing properties
    function getLayoutSizingProps(node, parentLayoutMode) {
      const layoutProps = [];
      if (parentLayoutMode === 'HORIZONTAL' || parentLayoutMode === 'VERTICAL') {
        if (parentLayoutMode === 'HORIZONTAL') {
          if (
            node.layoutSizingHorizontal === 'FIXED' &&
            node.absoluteBoundingBox &&
            typeof node.absoluteBoundingBox.width === 'number'
          ) {
            layoutProps.push(`width: ${formatNum(node.absoluteBoundingBox.width)}px;`);
          } else if (node.layoutSizingHorizontal === 'FILL') {
            layoutProps.push('flex-grow: 1; flex-shrink: 1;');
          }
          if (
            node.layoutSizingVertical === 'FIXED' &&
            node.absoluteBoundingBox &&
            typeof node.absoluteBoundingBox.height === 'number'
          ) {
            layoutProps.push(`height: ${formatNum(node.absoluteBoundingBox.height)}px;`);
          } else if (node.layoutSizingVertical === 'FILL') {
            layoutProps.push('align-self: stretch;');
          }
        } else if (parentLayoutMode === 'VERTICAL') {
          if (
            node.layoutSizingVertical === 'FIXED' &&
            node.absoluteBoundingBox &&
            typeof node.absoluteBoundingBox.height === 'number'
          ) {
            layoutProps.push(`height: ${formatNum(node.absoluteBoundingBox.height)}px;`);
          } else if (node.layoutSizingVertical === 'FILL') {
            layoutProps.push('flex-grow: 1; flex-shrink: 1;');
          }
          if (
            node.layoutSizingHorizontal === 'FIXED' &&
            node.absoluteBoundingBox &&
            typeof node.absoluteBoundingBox.width === 'number'
          ) {
            layoutProps.push(`width: ${formatNum(node.absoluteBoundingBox.width)}px;`);
          } else if (node.layoutSizingHorizontal === 'FILL') {
            layoutProps.push('align-self: stretch;');
          }
        }
      } else {
        // If no parent layoutMode — only fixed sizes
        if (
          node.layoutSizingHorizontal === 'FIXED' &&
          node.absoluteBoundingBox &&
          typeof node.absoluteBoundingBox.width === 'number'
        ) {
          layoutProps.push(`width: ${formatNum(node.absoluteBoundingBox.width)}px;`);
        }
        if (
          node.layoutSizingVertical === 'FIXED' &&
          node.absoluteBoundingBox &&
          typeof node.absoluteBoundingBox.height === 'number'
        ) {
          layoutProps.push(`height: ${formatNum(node.absoluteBoundingBox.height)}px;`);
        }
      }
      return layoutProps;
    }
    // --- Absolute and fixed positioning ---
    if (node.isFixed === true) {
      props.push('position: fixed;');
    } else if (node.layoutPositioning === 'ABSOLUTE') {
      props.push('position: absolute;');
    }
    if (node.isFixed === true || node.layoutPositioning === 'ABSOLUTE') {
      if (node.absoluteBoundingBox && parentNode && parentNode.absoluteBoundingBox) {
        const box = node.absoluteBoundingBox;
        const parentBox = parentNode.absoluteBoundingBox;
        const constraints = node.constraints || {};
        props.push(...getPositionProps(box, parentBox, constraints));
      }
    }

    // Layout sizing for INSTANCE nodes
    if (node.type === 'INSTANCE') {
      // Output layoutSizing properties in the same format as for regular nodes
      props.push(...getLayoutSizingProps(node, parentLayoutMode));
      // Only output positioning/layoutSizing for INSTANCE
      return props.join(' ');
    }
    // Text node properties
    if (node.type === 'TEXT') {
      const style = node.style || {};
      // --- Текстовые свойства ---
      // color (fills) — поддержка переменных и fallback
      let colorVar = null;
      let fillVisible = true;
      if (node.fills && Array.isArray(node.fills) && node.fills[0] && node.fills[0].visible === false) {
        fillVisible = false;
      }
      if (fillVisible) {
        if (node.boundVariables && node.boundVariables.fills) {
          const colorId = Array.isArray(node.boundVariables.fills)
            ? node.boundVariables.fills[0]?.id
            : node.boundVariables.fills.id;
          if (colorId) {
            colorVar = getScssVarById(colorId);
          }
        }
        if (colorVar) {
          props.push(`color: ${colorVar};`);
        } else if (node.fills && Array.isArray(node.fills) && node.fills[0] && node.fills[0].color) {
          const c = node.fills[0].color;
          const a = node.fills[0].opacity !== undefined ? node.fills[0].opacity : 1;
          props.push(`color: ${colorToCss(c, a)};`);
        }
      }
      // font-weight (fontStyle) — поддержка переменных и fallback
      let fontWeightVar = null;
      if (node.boundVariables && node.boundVariables.fontStyle) {
        const fontWeightId = Array.isArray(node.boundVariables.fontStyle)
          ? node.boundVariables.fontStyle[0]?.id
          : node.boundVariables.fontStyle.id;
        if (fontWeightId) {
          fontWeightVar = getScssVarById(fontWeightId);
        }
      }
      if (fontWeightVar) {
        props.push(`font-weight: ${fontWeightVar};`);
      } else if (typeof style.fontStyle === 'string') {
        props.push(`font-weight: ${style.fontStyle};`);
      }
      // font-family — поддержка переменных и fallback
      let fontFamilyVar = null;
      if (node.boundVariables && node.boundVariables.fontFamily) {
        const fontFamilyId = Array.isArray(node.boundVariables.fontFamily)
          ? node.boundVariables.fontFamily[0]?.id
          : node.boundVariables.fontFamily.id;
        if (fontFamilyId) {
          fontFamilyVar = getScssVarById(fontFamilyId);
        }
      }
      if (fontFamilyVar) {
        props.push(`font-family: ${fontFamilyVar};`);
      } else if (typeof style.fontFamily === 'string') {
        props.push(`font-family: ${style.fontFamily};`);
      }
      // font-size variable
      let fontSizeVar = null;
      if (node.boundVariables && node.boundVariables.fontSize) {
        // поддержка и объекта, и массива
        const fontSizeId = Array.isArray(node.boundVariables.fontSize)
          ? node.boundVariables.fontSize[0]?.id
          : node.boundVariables.fontSize.id;
        if (fontSizeId) {
          fontSizeVar = getScssVarById(fontSizeId);
        }
      }
      if (fontSizeVar) {
        props.push(`font-size: ${fontSizeVar};`);
      } else if (typeof style.fontSize === 'number') {
        props.push(`font-size: ${formatNum(style.fontSize)}px;`);
      }
      // text-align
      if (typeof style.textAlignHorizontal === 'string') {
        let align = style.textAlignHorizontal.toLowerCase();
        if (align === 'left' || align === 'right' || align === 'center' || align === 'justify') {
          props.push(`text-align: ${align};`);
        }
      }
      // letter-spacing
      if (typeof style.letterSpacing === 'number') {
        props.push(`letter-spacing: ${formatNum(style.letterSpacing)}px;`);
      }
      // line-height
      if (typeof style.lineHeightPercentFontSize === 'number') {
        props.push(`line-height: ${formatNum(style.lineHeightPercentFontSize)}%;`);
      }
    }
    // --- Универсальные свойства (для всех узлов) ---
    // Background только для не-текстовых узлов
    let bgVar = null;
    let bgVisible = true;
    if (node.fills && Array.isArray(node.fills) && node.fills[0] && node.fills[0].visible === false) {
      bgVisible = false;
    }
    if (bgVisible && node.type !== 'TEXT') {
      // Фоновое изображение
      if (node.fills && Array.isArray(node.fills)) {
        const imageFill = node.fills.find((f) => f.type === 'IMAGE');
        if (imageFill) {
          props.push('background: url(/img/image.png);');
          if (imageFill.scaleMode === 'FILL') {
            props.push('background-size: cover;');
          } else if (imageFill.scaleMode === 'FIT') {
            props.push('background-size: contain;');
          } else if (imageFill.scaleMode === 'TILE') {
            props.push('background-repeat: repeat;');
          } else if (imageFill.scaleMode === 'CROP') {
            props.push('background-size: cover;');
            props.push('background-position: center;');
          }
        }
      }
      if (
        node.boundVariables &&
        node.boundVariables.fills &&
        Array.isArray(node.boundVariables.fills) &&
        node.boundVariables.fills[0]?.id
      ) {
        bgVar = getScssVarById(node.boundVariables.fills[0].id);
      }
      if (bgVar) {
        props.push(`background: ${bgVar};`);
      } else if (node.fills && Array.isArray(node.fills) && node.fills[0] && node.fills[0].color) {
        const c = node.fills[0].color;
        const a = node.fills[0].opacity !== undefined ? node.fills[0].opacity : 1;
        props.push(`background: ${colorToCss(c, a)};`);
      }
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
    let borderVar = null;
    if (
      node.boundVariables &&
      node.boundVariables.strokes &&
      Array.isArray(node.boundVariables.strokes) &&
      node.boundVariables.strokes[0]?.id
    ) {
      borderVar = getScssVarById(node.boundVariables.strokes[0].id);
    }
    if (borderVar) {
      props.push(`border: 1px solid ${borderVar};`);
    } else if (node.strokes && Array.isArray(node.strokes) && node.strokes[0] && node.strokes[0].color) {
      const c = node.strokes[0].color;
      const a = node.strokes[0].opacity !== undefined ? node.strokes[0].opacity : 1;
      props.push(`border: 1px solid ${colorToCss(c, a)};`);
    }
    // Box-shadow
    if (Array.isArray(node.effects)) {
      const shadows = node.effects.filter((e) => e.type === 'DROP_SHADOW' && e.visible !== false);
      // Получаем variableID для box-shadow, если есть
      let shadowVarId = null;
      if (node.boundVariables && node.boundVariables.effects) {
        let effectVars = node.boundVariables.effects;
        if (Array.isArray(effectVars)) {
          const effectVar = effectVars.find((v) => v.type === 'VARIABLE_ALIAS' && v.id);
          if (effectVar && effectVar.id) {
            shadowVarId = effectVar.id;
          }
        } else if (typeof effectVars === 'object' && effectVars !== null) {
          if (effectVars.type === 'VARIABLE_ALIAS' && effectVars.id) {
            shadowVarId = effectVars.id;
          }
        }
      }
      const validShadows = shadows.filter((e) => {
        let shadowColor = null;
        if (shadowVarId) {
          shadowColor = getScssVarById(shadowVarId);
        }
        if (!shadowColor && e.color) {
          shadowColor = colorToCss(e.color, e.color.a);
        }
        return !!shadowColor;
      });
      if (validShadows.length > 0) {
        const shadowStrs = validShadows.map((e) => {
          let shadowColor = null;
          if (shadowVarId) {
            shadowColor = getScssVarById(shadowVarId);
          }
          if (!shadowColor && e.color) {
            shadowColor = colorToCss(e.color, e.color.a);
          }
          const x = typeof e.offset?.x === 'number' ? formatNum(e.offset.x) : 0;
          const y = typeof e.offset?.y === 'number' ? formatNum(e.offset.y) : 0;
          const blur = typeof e.radius === 'number' ? formatNum(e.radius) : 0;
          const spread = typeof e.spread === 'number' ? formatNum(e.spread) : 0;
          return `${x}px ${y}px ${blur}px ${spread}px ${shadowColor}`.replace(' 0px', '');
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
    if (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL') {
      props.push('display: flex;');
      if (node.layoutMode === 'VERTICAL') {
        props.push('flex-direction: column;');
      }
      if (
        typeof node.paddingLeft === 'number' &&
        typeof node.paddingRight === 'number' &&
        typeof node.paddingTop === 'number' &&
        typeof node.paddingBottom === 'number'
      ) {
        props.push(
          `padding: ${formatNum(node.paddingTop)}px ${formatNum(node.paddingRight)}px ${formatNum(node.paddingBottom)}px ${formatNum(node.paddingLeft)}px;`,
        );
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
          case 'MIN':
            justify = 'flex-start';
            break;
          case 'CENTER':
            justify = 'center';
            break;
          case 'MAX':
            justify = 'flex-end';
            break;
          case 'SPACE_BETWEEN':
            justify = 'space-between';
            break;
        }
        props.push(`justify-content: ${justify};`);
      }
      // counterAxisAlignItems -> align-items
      if (typeof node.counterAxisAlignItems === 'string') {
        let align = 'flex-start';
        switch (node.counterAxisAlignItems) {
          case 'MIN':
            align = 'flex-start';
            break;
          case 'CENTER':
            align = 'center';
            break;
          case 'MAX':
            align = 'flex-end';
            break;
          case 'BASELINE':
            align = 'baseline';
            break;
          case 'SPACE_BETWEEN':
            align = 'space-between';
            break;
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
    // width/height/grow/shrink в зависимости от layoutSizing и направления layoutMode родителя
    props.push(...getLayoutSizingProps(node, parentLayoutMode));
    // Aspect ratio (Figma: targetAspectRatio or preserveRatio)
    if (
      node.targetAspectRatio &&
      typeof node.targetAspectRatio.x === 'number' &&
      typeof node.targetAspectRatio.y === 'number' &&
      node.targetAspectRatio.x > 0 &&
      node.targetAspectRatio.y > 0
    ) {
      props.push(`aspect-ratio: ${formatNum(node.targetAspectRatio.x)} / ${formatNum(node.targetAspectRatio.y)};`);
    } else if (
      node.preserveRatio === true &&
      node.absoluteBoundingBox &&
      typeof node.absoluteBoundingBox.width === 'number' &&
      typeof node.absoluteBoundingBox.height === 'number' &&
      node.absoluteBoundingBox.height !== 0
    ) {
      const ratio = node.absoluteBoundingBox.width / node.absoluteBoundingBox.height;
      props.push(`aspect-ratio: ${formatNum(ratio)};`);
    }
    // После формирования props фильтруем свойства с дефолтными значениями
    const defaultVars = {
      color: 'var(--text-primary)',
      'font-size': 'var(--font-size-default)',
      'font-weight': 'var(--typeface-regular-weight)',
      'font-family': 'var(--typeface-primary)',
      'letter-spacing': '0px',
    };
    props = props.filter((prop) => {
      for (const key in defaultVars) {
        if (prop.startsWith(key + ':') && prop.includes(defaultVars[key])) {
          return false;
        }
      }
      return true;
    });
    // Форматирование: первая строка после { максимально длинная (до 80 символов), остальные — с отступом
    let scssLines = [];
    let line = '';
    props.forEach((prop, i) => {
      if ((line + (line ? ' ' : '') + prop).length > 80) {
        scssLines.push(line.trim());
        line = prop;
      } else {
        line += (line ? ' ' : '') + prop;
      }
    });
    if (line) scssLines.push(line.trim());
    // Первая строка — без отступа, остальные — с отступом
    let scssRule = '';
    if (scssLines.length > 0) {
      scssRule = scssLines[0];
      for (let i = 1; i < scssLines.length; i++) {
        scssRule += '\n  ' + scssLines[i];
      }
    }
    return scssRule;
  }

  const rootClass = sanitize(rootClassOverride ? rootClassOverride : figmaNode.name);
  const jsx = nodeToJsx(figmaNode, 0, true, rootClass);

  // SCSS: always output rootClass first, then all other classes nested
  const classEntries = Array.from(classMap.entries());
  const rootEntry = classEntries.find(([, node]) => node === figmaNode);
  let scss = '';
  if (rootEntry) {
    // Build id -> node map for fast access
    const idMap = new Map();
    for (const [, node] of classEntries) {
      if (node.id) idMap.set(node.id, node);
    }
    // For each class, determine if it has absolutely/fixed positioned children
    const absOrFixedChildMap = new Map();
    for (const [, node] of classEntries) {
      if (node.children && node.children.length > 0) {
        absOrFixedChildMap.set(
          node.id,
          node.children.some((child) => child.layoutPositioning === 'ABSOLUTE' || child.isFixed === true),
        );
      }
    }
    const rootRule = nodeToScss(figmaNode, rootClass, null, null);
    let rootRuleWithRel = rootRule;
    // Only add position: relative if root does not have position: absolute or fixed
    if (absOrFixedChildMap.get(figmaNode.id) && !/position:\s*(absolute|fixed)/.test(rootRule)) {
      rootRuleWithRel = 'position: relative; ' + rootRule;
    }
    scss += `.${rootClass} {${rootRuleWithRel ? rootRuleWithRel + '\n' : ''}`;
    classEntries.forEach(([className, node]) => {
      if (node === figmaNode) return;
      // Determine immediate parent
      const parent = parentMap.get(node.id);
      const parentLayoutMode = parent && parent.layoutMode ? parent.layoutMode : null;
      // Only add position: relative if parent does not have position: absolute or fixed
      const rule = nodeToScss(node, className, parentLayoutMode, parent);
      let ruleWithRel = rule;
      if (absOrFixedChildMap.get(node.id) && !/position:\s*(absolute|fixed)/.test(rule)) {
        ruleWithRel = 'position: relative; ' + rule;
      }
      if (ruleWithRel) {
        const nested = className.startsWith(rootClass + '_')
          ? '&' + className.slice(rootClass.length)
          : `.${className}`;
        const indentedRule = ruleWithRel.replace(/\n/g, '\n  ');
        if (!indentedRule.includes('\n')) {
          scss += `  ${nested} {${indentedRule}}\n`;
        } else {
          scss += `  ${nested} {${indentedRule}\n    }\n`;
        }
      }
    });
    scss += '}';
  }

  return {
    jsx,
    scss: scss,
  };
}

const program = new Command();

program.name('markup').description('Convert a part of a Figma file structure to HTML and CSS').version('1.0.0');

program
  .requiredOption('-f, --frame <name>', 'Frame or node name in the Figma file structure')
  .option('-i, --input <path>', 'Path to Figma JSON file', `${OUTPUT_DIR}/figmaFileContent.json`)
  .option('-o, --output <dir>', 'Output directory', OUTPUT_DIR)
  .option('-n, --name <component>', 'Component name to use as root class')
  .option('-v, --variant <variant>', 'Variant node name inside the component frame')
  .option('-j, --json', 'Also save the selected Figma node as a JSON file')
  .action((options) => {
    const { frame, input, output, name, json, variant } = options;
    if (!fs.existsSync(input)) {
      console.error(`Input file not found: ${input}`);
      process.exit(1);
    }
    const figmaData = JSON.parse(fs.readFileSync(input, 'utf-8'));
    // Рекурсивно ищем все узлы по имени
    function findAllNodesByName(node, name, acc = []) {
      if (node.name === name) acc.push(node);
      if (node.children) {
        for (const child of node.children) {
          findAllNodesByName(child, name, acc);
        }
      }
      return acc;
    }
    function findVariantNode(frameNode, variantName) {
      if (!frameNode.children) return null;
      for (const child of frameNode.children) {
        if (child.name === variantName) return child;
      }
      return null;
    }
    const foundNodes = findAllNodesByName(figmaData.document, frame);
    if (foundNodes.length === 0) {
      console.error(`Frame or node named '${frame}' not found in the Figma file.`);
      process.exit(1);
    }
    function proceedWithNode(targetNode) {
      let nodeForExport = targetNode;
      if (variant) {
        const variantNode = findVariantNode(targetNode, variant);
        if (!variantNode) {
          console.error(`Variant node named '${variant}' not found inside frame '${frame}'.`);
          process.exit(1);
        }
        nodeForExport = variantNode;
      }
      const rootClass = name ? name : variant ? variant : frame;
      const { jsx, scss } = convertFigmaToMarkup(nodeForExport, rootClass, figmaData.document);
      if (!fs.existsSync(output)) {
        fs.mkdirSync(output, { recursive: true });
      }
      fs.writeFileSync(path.join(output, `${rootClass}.jsx`), jsx);
      fs.writeFileSync(path.join(output, `${rootClass}.scss`), scss);
      if (json) {
        fs.writeFileSync(path.join(output, `${rootClass}.json`), JSON.stringify(nodeForExport, null, 2));
      }
      console.log(`JSX and SCSS for '${rootClass}' exported to ${output}`);
      if (json) {
        console.log(`JSON for '${rootClass}' exported to ${output}`);
      }
    }
    if (foundNodes.length === 1) {
      proceedWithNode(foundNodes[0]);
    } else {
      // Несколько узлов — выводим список и спрашиваем пользователя
      console.log(`Found multiple nodes named '${frame}':`);
      foundNodes.forEach((node, idx) => {
        console.log(`${idx + 1}: id=${node.id}, type=${node.type}`);
      });
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question('Enter the number of the node to use: ', (answer) => {
        const num = parseInt(answer, 10);
        if (!num || num < 1 || num > foundNodes.length) {
          console.error('Invalid selection. Exiting.');
          rl.close();
          process.exit(1);
        }
        rl.close();
        proceedWithNode(foundNodes[num - 1]);
      });
    }
  });

program.parse(process.argv);

module.exports = {
  convertFigmaToMarkup,
};
