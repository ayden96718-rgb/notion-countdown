import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const ignored = new Set(['.git', '.browser-cache', 'dist', 'node_modules', 'artifacts', '__pycache__']);
const self = 'docs/FILE_MANIFEST.json';
async function walk(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await walk(file));
    else if (path.relative(root, file) !== self) result.push(file);
  }
  return result.sort();
}
const manifest = {};
for (const file of await walk(root)) {
  const bytes = await readFile(file);
  manifest[path.relative(root, file)] = { size_bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
await writeFile(path.join(root, self), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Manifest updated: ${Object.keys(manifest).length} files; excludes itself, build/cache directories.`);
