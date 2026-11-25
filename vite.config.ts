import postcssCascadeLayers from '@csstools/postcss-cascade-layers';
import tailwindcss from '@tailwindcss/vite';
import legacy from '@vitejs/plugin-legacy';
import react from '@vitejs/plugin-react';
import {transform as lightningTransform} from 'lightningcss';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import postcss, {type Plugin as PostcssPlugin} from 'postcss';
import {defineConfig, type Plugin as VitePlugin} from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function splitTopLevelComma(input: string): string[] {
  const parts: string[] = [];
  let depthParen = 0;
  let depthBracket = 0;
  let quote: string | null = null;
  let start = 0;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') depthParen++;
    else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
    else if (ch === '[') depthBracket++;
    else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);
    else if (ch === ',' && depthParen === 0 && depthBracket === 0) {
      parts.push(input.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(input.slice(start));
  return parts;
}

function expandWhereInSingleSelector(sel: string): string[] {
  const idx = sel.indexOf(':where(');
  if (idx === -1) return [sel];

  let depth = 0;
  let closeIdx = -1;
  let quote: string | null = null;
  for (let i = idx + 7; i < sel.length; i++) {
    const ch = sel[i];
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      if (depth === 0) {
        closeIdx = i;
        break;
      }
      depth--;
    }
  }
  if (closeIdx === -1) return [sel];

  const prefix = sel.slice(0, idx);
  const inner = sel.slice(idx + 7, closeIdx);
  const suffix = sel.slice(closeIdx + 1);
  const innerOptions = splitTopLevelComma(inner).map((p) => p.trim()).filter(Boolean);
  if (innerOptions.length === 0) return [sel];

  const out: string[] = [];
  for (const opt of innerOptions) {
    for (const expanded of expandWhereInSingleSelector(`${prefix}${opt}${suffix}`)) {
      out.push(expanded);
    }
  }
  return out;
}

function unwrapWhereSelectors(selectorText: string): string {
  if (!selectorText.includes(':where(')) return selectorText;
  const topSelectors = splitTopLevelComma(selectorText);
  const expanded: string[] = [];
  for (const sel of topSelectors) {
    for (const item of expandWhereInSingleSelector(sel.trim())) {
      if (item) expanded.push(item);
    }
  }
  return expanded.join(', ');
}

function hexAlphaToRgba(value: string): string {
  if (!value.includes('#')) return value;
  let next = value.replace(/#([0-9a-fA-F]{8})\b/g, (_m, hex: string) => {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = parseInt(hex.slice(6, 8), 16) / 255;
    if (a === 0) return 'rgba(0,0,0,0)';
    return `rgba(${r},${g},${b},${Number(a.toFixed(3))})`;
  });
  next = next.replace(/#([0-9a-fA-F]{4})\b/g, (_m, hex: string) => {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    const a = parseInt(hex[3] + hex[3], 16) / 255;
    if (a === 0) return 'rgba(0,0,0,0)';
    return `rgba(${r},${g},${b},${Number(a.toFixed(3))})`;
  });
  return next;
}

function splitCssValues(input: string): string[] {
  const parts: string[] = [];
  let depthParen = 0;
  let depthBracket = 0;
  let quote: string | null = null;
  let current = '';

  const trimmed = input.trim();
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (quote) {
      current += ch;
      if (ch === '\\' && i + 1 < trimmed.length) {
        current += trimmed[++i];
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') {
      depthParen++;
      current += ch;
    } else if (ch === ')') {
      depthParen = Math.max(0, depthParen - 1);
      current += ch;
    } else if (ch === '[') {
      depthBracket++;
      current += ch;
    } else if (ch === ']') {
      depthBracket = Math.max(0, depthBracket - 1);
      current += ch;
    } else if (/\s/.test(ch) && depthParen === 0 && depthBracket === 0) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

const legacyPropertyFallbackPlugin = (): PostcssPlugin => ({
  postcssPlugin: 'suredeal-legacy-css-compat',
  Once(root) {
    root.walkRules((rule) => {
      if (rule.selector && rule.selector.includes(':where(')) {
        rule.selector = unwrapWhereSelectors(rule.selector);
      }

      const existingProps = new Set<string>();
      rule.walkDecls((d) => {
        existingProps.add(d.prop);
      });

      rule.walkDecls((decl) => {
        if (decl.prop === '--tw-gradient-position' && /\s+in\s+(oklab|oklch)\b/i.test(decl.value)) {
          decl.value = decl.value.replace(/\s+in\s+(oklab|oklch)\b/gi, '');
        }

        if (decl.value.includes('#')) {
          decl.value = hexAlphaToRgba(decl.value);
        }

        if (decl.prop === 'position' && decl.value === 'sticky') {
          decl.cloneBefore({prop: 'position', value: '-webkit-sticky'});
        } else if (decl.prop === 'backdrop-filter' && !existingProps.has('-webkit-backdrop-filter')) {
          decl.cloneBefore({prop: '-webkit-backdrop-filter', value: decl.value});
        } else if (decl.prop === 'user-select' && !existingProps.has('-webkit-user-select')) {
          decl.cloneBefore({prop: '-webkit-user-select', value: decl.value});
        } else if (decl.prop === 'overflow-x' && decl.value === 'clip') {
          decl.cloneBefore({prop: 'overflow-x', value: 'hidden'});
        } else if (decl.prop === 'inset') {
          const parts = splitCssValues(decl.value);
          if (parts.length > 0 && parts.length <= 4) {
            const top = parts[0];
            const right = parts[1] ?? top;
            const bottom = parts[2] ?? top;
            const left = parts[3] ?? right;
            if (!existingProps.has('top')) decl.cloneBefore({prop: 'top', value: top});
            if (!existingProps.has('right')) decl.cloneBefore({prop: 'right', value: right});
            if (!existingProps.has('bottom')) decl.cloneBefore({prop: 'bottom', value: bottom});
            if (!existingProps.has('left')) decl.cloneBefore({prop: 'left', value: left});
          }
        } else if (decl.prop === 'inset-inline') {
          const parts = splitCssValues(decl.value);
          if (parts.length > 0 && parts.length <= 2) {
            const left = parts[0];
            const right = parts[1] ?? left;
            if (!existingProps.has('left')) decl.cloneBefore({prop: 'left', value: left});
            if (!existingProps.has('right')) decl.cloneBefore({prop: 'right', value: right});
          }
        } else if (decl.prop === 'inset-block') {
          const parts = splitCssValues(decl.value);
          if (parts.length > 0 && parts.length <= 2) {
            const top = parts[0];
            const bottom = parts[1] ?? top;
            if (!existingProps.has('top')) decl.cloneBefore({prop: 'top', value: top});
            if (!existingProps.has('bottom')) decl.cloneBefore({prop: 'bottom', value: bottom});
          }
        } else if (decl.prop === 'margin-block') {
          const parts = splitCssValues(decl.value);
          if (parts.length > 0 && parts.length <= 2) {
            const top = parts[0];
            const bottom = parts[1] ?? top;
            if (!existingProps.has('margin-top')) decl.cloneBefore({prop: 'margin-top', value: top});
            if (!existingProps.has('margin-bottom')) decl.cloneBefore({prop: 'margin-bottom', value: bottom});
          }
        } else if (decl.prop === 'margin-block-start' && !existingProps.has('margin-top')) {
          decl.cloneBefore({prop: 'margin-top', value: decl.value});
        } else if (decl.prop === 'margin-block-end' && !existingProps.has('margin-bottom')) {
          decl.cloneBefore({prop: 'margin-bottom', value: decl.value});
        } else if (decl.prop === 'margin-inline') {
          const parts = splitCssValues(decl.value);
          if (parts.length > 0 && parts.length <= 2) {
            const left = parts[0];
            const right = parts[1] ?? left;
            if (!existingProps.has('margin-left')) decl.cloneBefore({prop: 'margin-left', value: left});
            if (!existingProps.has('margin-right')) decl.cloneBefore({prop: 'margin-right', value: right});
          }
        } else if (decl.prop === 'margin-inline-start' && !existingProps.has('margin-left')) {
          decl.cloneBefore({prop: 'margin-left', value: decl.value});
        } else if (decl.prop === 'margin-inline-end' && !existingProps.has('margin-right')) {
          decl.cloneBefore({prop: 'margin-right', value: decl.value});
        } else if (decl.prop === 'padding-block') {
          const parts = splitCssValues(decl.value);
          if (parts.length > 0 && parts.length <= 2) {
            const top = parts[0];
            const bottom = parts[1] ?? top;
            if (!existingProps.has('padding-top')) decl.cloneBefore({prop: 'padding-top', value: top});
            if (!existingProps.has('padding-bottom')) decl.cloneBefore({prop: 'padding-bottom', value: bottom});
          }
        } else if (decl.prop === 'padding-block-start' && !existingProps.has('padding-top')) {
          decl.cloneBefore({prop: 'padding-top', value: decl.value});
        } else if (decl.prop === 'padding-block-end' && !existingProps.has('padding-bottom')) {
          decl.cloneBefore({prop: 'padding-bottom', value: decl.value});
        } else if (decl.prop === 'padding-inline') {
          const parts = splitCssValues(decl.value);
          if (parts.length > 0 && parts.length <= 2) {
            const left = parts[0];
            const right = parts[1] ?? left;
            if (!existingProps.has('padding-left')) decl.cloneBefore({prop: 'padding-left', value: left});
            if (!existingProps.has('padding-right')) decl.cloneBefore({prop: 'padding-right', value: right});
          }
        } else if (decl.prop === 'padding-inline-start' && !existingProps.has('padding-left')) {
          decl.cloneBefore({prop: 'padding-left', value: decl.value});
        } else if (decl.prop === 'padding-inline-end' && !existingProps.has('padding-right')) {
          decl.cloneBefore({prop: 'padding-right', value: decl.value});
        } else if (decl.prop === 'translate' && !existingProps.has('transform')) {
          const parts = splitCssValues(decl.value);
          if (parts.length > 0 && parts.length <= 2) {
            const x = parts[0] || '0';
            const y = parts[1] || '0';
            const tx = `translate(${x}, ${y})`;
            decl.cloneBefore({prop: '-webkit-transform', value: tx});
            decl.cloneBefore({prop: 'transform', value: tx});
          }
        } else if (decl.prop === 'scale' && !existingProps.has('transform')) {
          const parts = splitCssValues(decl.value);
          if (parts.length > 0 && parts.length <= 2) {
            const sx = parts[0] || '1';
            const sy = parts[1] || sx;
            const sc = `scale(${sx}, ${sy})`;
            decl.cloneBefore({prop: '-webkit-transform', value: sc});
            decl.cloneBefore({prop: 'transform', value: sc});
          }
        } else if (decl.prop === 'rotate' && !existingProps.has('transform')) {
          const rot = `rotate(${decl.value.trim()})`;
          decl.cloneBefore({prop: '-webkit-transform', value: rot});
          decl.cloneBefore({prop: 'transform', value: rot});
        }
      });
    });
  },
});

const legacyPostcssProcessor = postcss([postcssCascadeLayers(), legacyPropertyFallbackPlugin()]);

async function transformCssForLegacy(source: string, fileName: string): Promise<string> {
  let lowered = source;
  try {
    const lt = lightningTransform({
      filename: fileName,
      code: Buffer.from(source, 'utf8'),
      targets: {
        chrome: 49 << 16,
        android: 5 << 16,
        safari: 11 << 16,
        ios_saf: 11 << 16,
      },
      minify: false,
      errorRecovery: true,
    });
    lowered = Buffer.from(lt.code).toString('utf8');
  } catch {
    lowered = source;
  }
  const result = await legacyPostcssProcessor.process(lowered, {from: fileName});
  return result.css;
}

function legacyCssCompatPlugin(): VitePlugin {
  let isBuildCommand = false;
  return {
    name: 'suredeal-legacy-css-bundle-compat',
    configResolved(config) {
      isBuildCommand = config.command === 'build';
    },
    async transform(code, id) {
      if (isBuildCommand) return null;
      if (!id.split('?')[0].endsWith('.css')) return null;
      if (!code.includes('@layer') && !code.includes('oklch(') && !code.includes(':where(')) {
        return null;
      }
      const css = await transformCssForLegacy(code, id);
      return {code: css, map: null};
    },
    async generateBundle(_options, bundle) {
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (!fileName.endsWith('.css') || asset.type !== 'asset') continue;
        const source =
          typeof asset.source === 'string'
            ? asset.source
            : Buffer.from(asset.source).toString('utf8');
        asset.source = await transformCssForLegacy(source, fileName);
      }
    },
  };
}

export default defineConfig(({command}) => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(command === 'build'
        ? [
            legacy({
              targets: [
                'defaults',
                'android >= 5',
                'chrome >= 49',
                'ios_saf >= 11',
                'safari >= 11',
                'samsung >= 6',
                'edge >= 16',
                'firefox >= 52',
              ],
              modernTargets: 'chrome >= 64, safari >= 12, firefox >= 60, edge >= 79',
              modernPolyfills: true,
              renderLegacyChunks: true,
            }),
          ]
        : []),
      legacyCssCompatPlugin(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(rootDir, 'dist');
          const srcAssets = path.resolve(rootDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      cssTarget: ['chrome49', 'safari11'],
    },
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
