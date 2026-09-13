(() => {
  // Bump this and sw.js together for every published app release.
  const VERSION = '20260913-2';
  const checkButton = document.getElementById('check-updates');
  const notice = document.getElementById('update-notice');
  const updateButton = document.getElementById('apply-update');
  const message = document.getElementById('update-message');
  const planner = document.getElementById('planner');
  let registration, approved = false, reloading = false, lastCheck = 0, checking = false, activationTimer;

  function showUpdate(text = 'A new version is ready. Update whenever you are ready.') {
    if (!notice) return;
    notice.hidden = false;
    message.textContent = text;
    updateButton.textContent = planner ? 'Save & update' : 'Update now';
    if (checkButton) checkButton.textContent = 'Check for updates';
  }
  function lock(value) {
    if (planner) planner.inert = value;
    const actions = document.querySelector('.header-actions');
    if (actions) actions.inert = value;
    updateButton.disabled = value;
  }
  function reportFailure(error) {
    approved = false;
    clearTimeout(activationTimer);
    lock(false);
    showUpdate(error.message || 'The update could not finish. Please try again.');
  }
  async function activeVersion() {
    const worker = navigator.serviceWorker.controller;
    if (!worker) return null;
    return new Promise(resolve => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, 1500);
      channel.port1.onmessage = event => {
        clearTimeout(timer);
        channel.port1.close();
        resolve(event.data?.version || null);
      };
      try { worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]); }
      catch { clearTimeout(timer); channel.port1.close(); resolve(null); }
    });
  }
  async function offerActiveUpdate() {
    const version = await activeVersion();
    if (version && version !== VERSION) showUpdate('An update is ready. Reload when you are ready to use it.');
  }
  async function reloadSafely() {
    if (!approved || reloading) return;
    reloading = true;
    try {
      if (planner) await window.wallstoryProject.prepareForUpdate();
      clearTimeout(activationTimer);
      location.reload();
    } catch (error) { reloading = false; reportFailure(error); }
  }
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    if (checkButton) { checkButton.disabled = true; checkButton.textContent = 'Updates need a supported browser'; }
    return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (approved) void reloadSafely();
    else void offerActiveUpdate(); // Another window must never force this design to reload.
  });
  updateButton?.addEventListener('click', async () => {
    lock(true);
    message.textContent = planner ? 'Saving your wall before updating…' : 'Preparing the update…';
    try {
      if (planner) {
        if (!window.wallstoryProject) throw Error('The planner is still opening. Please try again shortly.');
        await window.wallstoryProject.prepareForUpdate();
      }
      approved = true;
      if (registration?.waiting) {
        message.textContent = 'Your wall is saved. Applying the update…';
        activationTimer = setTimeout(() => reportFailure(Error('The update is taking longer than expected. Your saved wall is safe; try again.')), 15000);
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else await reloadSafely();
    } catch (error) { reportFailure(error); }
  });
  function watch(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller && registration.waiting) showUpdate();
      if (worker.state === 'redundant' && checkButton) { checkButton.disabled = false; checkButton.textContent = 'Update download failed. Retry'; }
    });
  }
  async function check(manual = false) {
    if (!registration || checking || (!manual && Date.now() - lastCheck < 60000)) return;
    checking = true;
    lastCheck = Date.now();
    if (manual && checkButton) { checkButton.disabled = true; checkButton.textContent = 'Checking…'; }
    try {
      await registration.update();
      if (registration.waiting) showUpdate();
      else if (registration.installing) {
        if (checkButton) checkButton.textContent = 'Downloading update…';
      } else {
        await offerActiveUpdate();
        if (manual && checkButton && notice?.hidden) checkButton.textContent = 'Up to date · Check again';
      }
    } catch {
      if (manual && checkButton) checkButton.textContent = 'Could not check. Try online';
    } finally {
      checking = false;
      if (checkButton) checkButton.disabled = false;
    }
  }
  checkButton?.addEventListener('click', () => void check(true));
  const ready = async () => {
    try {
      registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
      registration.addEventListener('updatefound', () => watch(registration.installing));
      watch(registration.installing);
      if (registration.waiting && navigator.serviceWorker.controller) showUpdate();
      void offerActiveUpdate();
      void check();
      void navigator.serviceWorker.ready.then(() => {
        const status = document.getElementById('offline-status');
        if (status) status.textContent = 'Ready for offline use. Your latest wall can be saved on this device.';
      });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void check(); });
      window.addEventListener('online', () => void check(true));
      window.addEventListener('focus', () => void check());
      setInterval(() => { if (document.visibilityState === 'visible') void check(); }, 5 * 60 * 1000);
    } catch {
      const status = document.getElementById('offline-status');
      if (status) status.textContent = 'The planner works online. Offline setup is unavailable in this browser.';
      if (checkButton) checkButton.textContent = 'Updates unavailable. Reopen online';
    }
  };
  if (document.readyState === 'complete') void ready();
  else window.addEventListener('load', () => void ready(), { once: true });
})();
