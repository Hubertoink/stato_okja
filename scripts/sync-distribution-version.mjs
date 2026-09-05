import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const version = (await readFile(new URL('VERSION', root), 'utf8')).trim();
if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) throw new Error('Invalid VERSION');
const files = {
  'docs/env-generator/template.js': (text) => text.replace(/ZIMAOS_DEFAULT_VERSION = '[^']+'/g, `ZIMAOS_DEFAULT_VERSION = '${version}'`),
  'deploy/zimaos/compose.yaml': (text) => text.replace(/STATO_VERSION:-[^}]+/g, `STATO_VERSION:-${version}`).replace(/version: "[^"]+"/, `version: "${version}"`),
  'deploy/zimaos/stato.env.example': (text) => text.replace(/^STATO_VERSION=.*$/m, `STATO_VERSION=${version}`),
};
for (const [path, update] of Object.entries(files)) {
  const url = new URL(path, root);
  const before = await readFile(url, 'utf8');
  const after = update(before);
  if (process.argv.includes('--check')) {
    if (before !== after) throw new Error(`${path}: run node scripts/sync-distribution-version.mjs`);
  } else if (before !== after) await writeFile(url, after);
}
