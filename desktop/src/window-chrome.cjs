const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// Packaged desktop presentation: works with existing servers as well as the
// local connection screen. insertCSS also respects pages with strict CSPs.
const css = readFileSync(join(__dirname, 'shell/window-controls.css'), 'utf8');
const script = readFileSync(join(__dirname, 'shell/window-controls.js'), 'utf8');

function attachWindowChrome(contents) {
  contents.on('dom-ready', async () => {
    try {
      await contents.insertCSS(css);
      await contents.executeJavaScript(script);
    } catch (error) {
      if (!contents.isDestroyed()) console.error('Window controls:', error.message);
    }
  });
}

module.exports = { attachWindowChrome };
