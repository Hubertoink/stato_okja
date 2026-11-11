const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');

function assertPatchedNode(version) {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part)) ||
      parts[0] !== 24 || parts[1] < 22 || (parts[1] === 22 && parts[2] < 3)) {
    throw new Error(`Node.js ${version} is below the required security baseline 24.22.3 (24.x).`);
  }
}

function checkRuntime(desktop) {
  let versions = process.versions;
  if (desktop) {
    const desktopRequire = createRequire(resolve(__dirname, '../desktop/package.json'));
    const result = spawnSync(desktopRequire('electron'), ['-p', 'JSON.stringify(process.versions)'], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      encoding: 'utf8',
      timeout: 30000,
      windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Electron runtime probe failed: ${result.stderr}`);
    versions = JSON.parse(result.stdout.trim());
    if (!versions.electron) throw new Error('Runtime probe did not execute Electron.');
  }
  assertPatchedNode(versions.node);
  console.log(`${desktop ? `Electron ${versions.electron}` : 'Build runtime'}: Node.js ${versions.node} meets the security baseline.`);
}

if (require.main === module) {
  try {
    checkRuntime(process.argv.includes('--desktop'));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { assertPatchedNode };
