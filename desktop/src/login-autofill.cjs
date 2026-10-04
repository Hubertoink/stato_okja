// Runs inside a dedicated isolated JavaScript world of the server page (like a
// browser extension content script). The page's own scripts cannot reach this
// world and the server view still gets no preload or IPC access.
const loginWorldId = 1717;

function installLoginHelper(credentials) {
  const passwordSelector = 'input[autocomplete="current-password"]';
  const helper =
    globalThis.__statoLoginHelper ||
    (() => {
      const filled = new WeakSet();
      const state = { credentials: null, captured: null };
      const fields = () => {
        const password = document.querySelector(passwordSelector);
        const form = password && password.form;
        const email =
          form && form.querySelector('input[type="email"], input[autocomplete="username"]');
        return email ? { form, email, password } : null;
      };
      const setValue = (input, value) => {
        // The native setter plus an input event updates controlled React inputs.
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };
      state.fill = () => {
        const found = fields();
        if (!found || !state.credentials || filled.has(found.password)) return;
        filled.add(found.password);
        setValue(found.email, state.credentials.email);
        setValue(found.password, state.credentials.password);
      };
      state.take = () => {
        // Successful only once the login form (and a 2FA step) is gone.
        if (!state.captured || fields() || document.querySelector('input[autocomplete="one-time-code"]'))
          return null;
        const captured = state.captured;
        state.captured = null;
        return captured;
      };
      document.addEventListener(
        'submit',
        (event) => {
          const found = fields();
          if (!found || event.target !== found.form) return;
          const email = found.email.value.trim();
          const password = found.password.value;
          state.captured = email && password ? { email, password } : null;
        },
        true,
      );
      new MutationObserver(() => state.fill()).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      return state;
    })();
  globalThis.__statoLoginHelper = helper;
  helper.credentials = credentials;
  helper.fill();
}

function takeCapturedLogin() {
  return globalThis.__statoLoginHelper ? globalThis.__statoLoginHelper.take() : null;
}

function installScript(credentials) {
  const value = credentials ? { email: credentials.email, password: credentials.password } : null;
  return `(${installLoginHelper.toString()})(${JSON.stringify(value)}); undefined;`;
}

const takeScript = `(${takeCapturedLogin.toString()})()`;

module.exports = { loginWorldId, installScript, takeScript };
