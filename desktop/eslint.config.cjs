const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  { files: ['**/*.cjs'], languageOptions: { globals: globals.node } },
  // Playwright serializes these callbacks into browser renderers.
  { files: ['test/smoke.cjs'], languageOptions: { globals: globals.browser } },
  { files: ['src/shell/*.js'], languageOptions: { globals: globals.browser } },
  // Serialized into an isolated world of the server page.
  {
    files: ['src/login-autofill.cjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
