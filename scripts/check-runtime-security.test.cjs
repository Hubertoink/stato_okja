const assert = require('node:assert/strict');
const { test } = require('node:test');
const { assertPatchedNode } = require('./check-runtime-security.cjs');

test('blocks affected Node releases, unsupported majors, and malformed probes', () => {
  for (const version of ['20.20.2', '22.23.5', '24.21.9', '24.22.2', '24.22', '24.NaN.3', '25.0.0']) {
    assert.throws(() => assertPatchedNode(version), /security baseline/);
  }
});

test('accepts the fixed Node release and newer patches/minors within Node 24', () => {
  for (const version of ['24.22.3', '24.22.4', '24.23.0']) assert.doesNotThrow(() => assertPatchedNode(version));
});
