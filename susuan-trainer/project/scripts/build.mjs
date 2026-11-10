import { mkdir, readFile, writeFile, cp, rm, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
const files = ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', 'src', 'icons', 'data/timing-reference.json'];
for (const file of files) {
  const target = path.join(dist, file);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(path.join(root, file), target, { recursive: true });
}
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(path.join(directory, e.name)) : [path.join(directory, e.name)]))).flat().sort();
}
const assets = await walk(dist);
const hash = createHash('sha256');
for (const file of assets) hash.update(path.relative(dist, file)).update(await readFile(file));
const version = hash.digest('hex').slice(0, 12);
for (const file of ['src/app.js', 'sw.js']) {
  const filename = path.join(dist, file);
  await writeFile(filename, (await readFile(filename, 'utf8')).replaceAll('__CACHE_VERSION__', version));
}
await writeFile(path.join(dist, '.nojekyll'), '');
console.log(`Built ${assets.length} static assets → dist/ (cache ${version}). No reference screenshots or personal records included.`);
