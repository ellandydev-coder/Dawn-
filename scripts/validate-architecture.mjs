// scripts/validate-architecture.mjs
// ══════════════════════════════════════════════════════════════
// 🛡️  POLICÍA DE ARQUITECTURA (v2)
// --------------------------------------------------------------
// Reglas:
//   1. Cada capa puede importar de sí misma (intra-layer OK)
//   2. Solo puede importar de capas "más bajas" (dependencia limpia)
//   3. Features NO pueden importarse entre sí
//   4. audioEngine solo en zonas autorizadas
//   5. Archivos > CRITICAL_LINES → error, > MAX_LINES → warning
//
// Uso:
//   node scripts/validate-architecture.mjs
//   npm run lint:arch
// ══════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');

// ⚙️  CONFIG
const MAX_LINES = 400;
const CRITICAL_LINES = 700;

// Reglas: cada capa puede importar de sí misma + capas más bajas
const ALLOWED = {
  app:      ['app', 'features', 'state', 'services', 'audio', 'domain', 'shared', 'workers'],
  features: ['features', 'shared', 'state', 'services', 'domain', 'audio', 'workers'],
  state:    ['state', 'services', 'audio', 'domain', 'shared'],
  services: ['services', 'audio', 'domain', 'shared'],
  audio:    ['audio', 'domain', 'shared'],
  workers:  ['workers', 'domain', 'shared'],
  shared:   ['shared', 'domain'],
  domain:   ['domain'],
};

const ALIAS_TO_LAYER = {
  '@app':      'app',
  '@features': 'features',
  '@state':    'state',
  '@services': 'services',
  '@audio':    'audio',
  '@domain':   'domain',
  '@shared':   'shared',
  '@workers':  'workers',
};

// 🎨 COLORES
const c = {
  reset: '\x1b[0m',
  red:   '\x1b[31m',
  yellow:'\x1b[33m',
  green: '\x1b[32m',
  cyan:  '\x1b[36m',
  gray:  '\x1b[90m',
  bold:  '\x1b[1m',
};

// 🔧 UTILS
function walkSource(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkSource(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function detectLayer(absPath) {
  const rel = relative(SRC, absPath).split(sep);
  const first = rel[0];
  if (!first) return null;
  if (rel.length === 1) return 'app';
  return first;
}

function detectFeature(absPath) {
  const rel = relative(SRC, absPath).split(sep);
  if (rel[0] === 'features' && rel.length > 1) return rel[1];
  return null;
}

function extractImports(code) {
  const re = /^\s*import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/gm;
  const imports = [];
  let m;
  while ((m = re.exec(code)) !== null) {
    imports.push(m[1]);
  }
  return imports;
}

/** Devuelve la capa a la que apunta un import por alias (@state, @audio, etc.) */
function resolveImportLayer(importPath) {
  for (const [alias, layer] of Object.entries(ALIAS_TO_LAYER)) {
    if (importPath === alias || importPath.startsWith(alias + '/')) {
      return layer;
    }
  }
  return null;
}

function resolveImportFeature(importPath) {
  if (importPath.startsWith('@features/')) {
    return importPath.split('/')[1];
  }
  return null;
}

// 🔍 REGLAS
const errors = [];
const warnings = [];

function addError(file, msg) { errors.push({ file, msg }); }
function addWarn(file, msg)  { warnings.push({ file, msg }); }

function checkFileSize(file, code) {
  const lines = code.split('\n').length;
  if (lines >= CRITICAL_LINES) {
    addError(file, `Archivo CRÍTICO: ${lines} líneas (máx: ${MAX_LINES}). Refactor obligatorio.`);
  } else if (lines >= MAX_LINES) {
    addWarn(file, `Archivo grande: ${lines} líneas (máx: ${MAX_LINES}). Considera dividir.`);
  }
}

function checkLayerImports(file, code) {
  const fromLayer = detectLayer(file);
  if (!fromLayer) return;

  const fromFeature = detectFeature(file);
  const imports = extractImports(code);

  for (const imp of imports) {
    const toLayer = resolveImportLayer(imp);
    if (!toLayer) continue;

    const allowed = ALLOWED[fromLayer] || [];
    if (!allowed.includes(toLayer)) {
      addError(file, `Import prohibido: "${fromLayer}" NO puede importar de "${toLayer}" (${imp})`);
    }

    // Features NO pueden importarse entre sí (aunque "features" esté allowed)
    if (fromLayer === 'features' && toLayer === 'features') {
      const toFeature = resolveImportFeature(imp);
      if (toFeature && fromFeature && toFeature !== fromFeature) {
        addError(file, `Feature cruzado: "${fromFeature}" importa de "${toFeature}" (${imp}). Extrae a shared/.`);
      }
    }
  }
}

function checkAudioEngineUsage(file, code) {
  const rel = relative(ROOT, file);
const isAllowed =
  rel.includes(`src${sep}audio${sep}`) ||
  rel.includes(`src${sep}state${sep}`) ||
  rel.includes(`src${sep}services${sep}`) ||
  rel.endsWith('App.tsx') ||
  rel.endsWith('AudioProvider.tsx');

  if (isAllowed) return;

  if (/from ['"]@audio\/engine\/AudioEngine['"]/.test(code)) {
    addWarn(file, `Uso directo de audioEngine fuera de zona autorizada. Usa un hook (useAudioEngine).`);
  }
}

// 🚀 RUN
console.log(`${c.cyan}${c.bold}🛡️  Validando arquitectura...${c.reset}\n`);

const files = walkSource(SRC);
console.log(`${c.gray}Analizando ${files.length} archivos...${c.reset}\n`);

for (const file of files) {
  const code = readFileSync(file, 'utf8');
  checkFileSize(file, code);
  checkLayerImports(file, code);
  checkAudioEngineUsage(file, code);
}

// 📊 REPORTE
function printGroup(title, items, color) {
  if (items.length === 0) return;
  console.log(`${color}${c.bold}${title} (${items.length})${c.reset}`);
  for (const { file, msg } of items) {
    const rel = relative(ROOT, file);
    console.log(`  ${color}•${c.reset} ${c.gray}${rel}${c.reset}`);
    console.log(`    ${msg}`);
  }
  console.log();
}

printGroup('❌ ERRORES', errors, c.red);
printGroup('⚠️  WARNINGS', warnings, c.yellow);

if (errors.length + warnings.length === 0) {
  console.log(`${c.green}${c.bold}✅ Arquitectura limpia. Cero problemas.${c.reset}\n`);
  process.exit(0);
} else {
  console.log(
    `${c.bold}Total: ${c.red}${errors.length} errores${c.reset}${c.bold}, ` +
    `${c.yellow}${warnings.length} warnings${c.reset}\n`
  );
  process.exit(errors.length > 0 ? 1 : 0);
}