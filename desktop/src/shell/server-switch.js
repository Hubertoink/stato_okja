const modal = document.querySelector('dialog');
let answering = false;

async function answer(confirm) {
  if (answering) return;
  answering = true;
  document.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  try {
    await window.statoServerSwitch.answer(confirm);
  } catch {
    answering = false;
    document.querySelectorAll('button').forEach((button) => { button.disabled = false; });
    document.getElementById('error').hidden = false;
  }
}

window.statoServerSwitch.onTheme((theme) => {
  for (const [name, value] of Object.entries(theme)) {
    if (value && name.startsWith('--')) document.documentElement.style.setProperty(name, value);
  }
});
document.getElementById('cancel').addEventListener('click', () => void answer(false));
document.getElementById('close').addEventListener('click', () => void answer(false));
document.getElementById('confirm').addEventListener('click', () => void answer(true));
modal.addEventListener('cancel', (event) => {
  event.preventDefault();
  void answer(false);
});
modal.addEventListener('click', (event) => {
  const bounds = modal.getBoundingClientRect();
  if (event.target === modal && (event.clientX < bounds.left || event.clientX > bounds.right ||
    event.clientY < bounds.top || event.clientY > bounds.bottom)) void answer(false);
});
modal.showModal();
