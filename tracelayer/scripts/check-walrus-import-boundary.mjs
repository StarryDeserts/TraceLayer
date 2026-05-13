import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scanRoots = ['apps', 'services', 'packages'];
const allowedWalrusPackagePath = join(workspaceRoot, 'packages', 'walrus');
const allowedSuiPackagePath = join(workspaceRoot, 'packages', 'sui-anchor');
const blockedImports = ['@mysten/sui', '@mysten/walrus'];
const ignoredDirectories = new Set(['node_modules', 'dist', 'coverage', '.next', '.turbo', '.git']);
const scannedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']);
const violations = [];

for (const root of scanRoots) {
  const rootPath = join(workspaceRoot, root);
  if (existsSync(rootPath)) scanDirectory(rootPath);
}

if (violations.length > 0) {
  console.error('Walrus import boundary violations found:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Walrus import boundary check passed.');

function scanDirectory(directory) {
  const allowWalrusImports = directory === allowedWalrusPackagePath || directory.startsWith(`${allowedWalrusPackagePath}${sep}`);
  const allowSuiImports = allowWalrusImports || directory === allowedSuiPackagePath || directory.startsWith(`${allowedSuiPackagePath}${sep}`);

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) scanDirectory(entryPath);
      continue;
    }

    if (!entry.isFile() || !scannedExtensions.has(extname(entry.name))) continue;

    const contents = readFileSync(entryPath, 'utf8');
    for (const blockedImport of blockedImports) {
      if (blockedImport === '@mysten/walrus' && allowWalrusImports) continue;
      if (blockedImport === '@mysten/sui' && allowSuiImports) continue;
      if (contents.includes(blockedImport)) {
        violations.push(`${formatPath(entryPath)} references ${blockedImport}`);
      }
    }
  }
}

function formatPath(filePath) {
  return relative(workspaceRoot, filePath).split(sep).join('/');
}
