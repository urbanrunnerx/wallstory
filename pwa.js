(() => {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const ready = () => navigator.serviceWorker.register('./sw.js', { scope: './' })
    .then(() => navigator.serviceWorker.ready)
    .then(() => {
      const status = document.getElementById('offline-status');
      if (status) status.textContent = 'Ready for offline use after this first visit. Save project files to keep your designs.';
    })
    .catch(() => {
      const status = document.getElementById('offline-status');
      if (status) status.textContent = 'The planner works online. Offline setup was unavailable in this browser.';
    });
  if (document.readyState === 'complete') ready();
  else window.addEventListener('load', ready, { once: true });
})();
