/* global URL, console, process */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)), '..');
const sourceRoot = 'frontend/src';
const rawControlPattern = /<(button|input|select|textarea)\b/g;

/**
 * Temporary migration baseline. Add a path only for a native control that is
 * intentionally specialised (for example a canvas picker), together with a
 * reason. Generic forms must use the shared UI primitives instead.
 */
const allowlist = new Map([
  // ['frontend/src/components/ui/ColorPicker.tsx', 'Native colour controls require browser-specific input types.'],
]);

function rawControlCount(source) {
  return [...source.matchAll(rawControlPattern)].length;
}

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

const trackedFiles = git(['ls-files', `${sourceRoot}/**/*.tsx`])
  .split(/\r?\n/)
  .filter(Boolean);
const untrackedFiles = git(['ls-files', '--others', '--exclude-standard', `${sourceRoot}/**/*.tsx`])
  .split(/\r?\n/)
  .filter(Boolean);
const files = [...new Set([...trackedFiles, ...untrackedFiles])];
const failures = [];

for (const file of files) {
  if (allowlist.has(file)) continue;

  const absolutePath = resolve(repoRoot, file);
  if (!existsSync(absolutePath)) continue;

  const baseline = trackedFiles.includes(file) ? rawControlCount(git(['show', `HEAD:${file}`])) : 0;
  const current = rawControlCount(readFileSync(absolutePath, 'utf8'));
  if (current > baseline) {
    failures.push(`${file}: ${baseline} → ${current}`);
  }
}

if (failures.length) {
  console.error('Neue direkte Standard-Controls wurden gefunden. Bitte Button, IconButton, Input, Select oder Textarea verwenden.');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('UI-Primitives-Baseline ist unverändert.');
