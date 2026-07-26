import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const version = (await readFile(resolve(repositoryRoot, 'VERSION'), 'utf8')).trim();

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`VERSION muss eine gültige SemVer-Version enthalten, erhalten: ${version || '(leer)'}`);
}

const packageFiles = ['package.json', 'backend/package.json', 'frontend/package.json'];
const packageVersions = await Promise.all(
  packageFiles.map(async (file) => {
    const pkg = JSON.parse(await readFile(resolve(repositoryRoot, file), 'utf8'));
    return { file, version: pkg.version };
  }),
);

const inconsistent = packageVersions.filter((entry) => entry.version !== version);
if (inconsistent.length) {
  throw new Error(
    `Versionskonflikt: VERSION ist ${version}, aber ${inconsistent
      .map((entry) => `${entry.file}=${entry.version}`)
      .join(', ')}.`,
  );
}

console.log(`StatO-Version ${version} ist in allen Paketen konsistent.`);
