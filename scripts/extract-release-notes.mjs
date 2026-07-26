import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error('Aufruf: node scripts/extract-release-notes.mjs <SemVer-Version>');
}

const changelog = await readFile(resolve(repositoryRoot, 'CHANGELOG.md'), 'utf8');
const lines = changelog.split(/\r?\n/);
const heading = new RegExp(`^##\\s+\\[${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\](?:\\s|$)`);
const start = lines.findIndex((line) => heading.test(line));

if (start === -1) {
  throw new Error(`CHANGELOG.md enthält keinen Eintrag für [${version}].`);
}

const endOffset = lines.slice(start + 1).findIndex((line) => /^##\s+/.test(line));
const end = endOffset === -1 ? lines.length : start + 1 + endOffset;
const notes = lines.slice(start + 1, end).join('\n').trim();

if (!notes) {
  throw new Error(`CHANGELOG.md enthält keine Release Notes für [${version}].`);
}

process.stdout.write(`${notes}\n`);
