let installPrompt = null;
const installButton = document.getElementById('install-button');
const installStatus = document.getElementById('install-status');
const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function installed() {
  installButton.hidden = true;
  installStatus.textContent = 'Wallstory is installed. Open the planner to start your wall.';
}

if (standalone) installed();
else if (isIOS) installStatus.textContent = 'On iPhone, open this page in Safari, then use Share → Add to Home Screen.';

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
  installButton.disabled = false;
  installStatus.textContent = 'Ready to install. Tap the button to add Wallstory to your phone.';
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  installed();
});

installButton.addEventListener('click', async () => {
  if (!installPrompt) {
    installStatus.textContent = isIOS
      ? 'Use Safari’s Share button, then Add to Home Screen and Add.'
      : 'Use your browser menu → Install app or Add to Home screen. If you are inside a messaging app, open this page in Chrome or Samsung Internet first.';
    const instructions = document.getElementById('install-instructions');
    instructions.scrollIntoView({ behavior: 'smooth', block: 'start' });
    instructions.focus({ preventScroll: true });
    return;
  }
  const prompt = installPrompt;
  installPrompt = null;
  installButton.disabled = true;
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    installStatus.textContent = choice.outcome === 'accepted'
      ? 'Installation requested. Your browser will finish adding Wallstory.'
      : 'You can install later or open the planner now.';
  } catch {
    installStatus.textContent = 'The install prompt could not open. Use your browser menu to install or add to the home screen.';
  } finally {
    installButton.disabled = false;
  }
});
