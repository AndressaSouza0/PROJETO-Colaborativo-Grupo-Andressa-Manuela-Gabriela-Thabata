if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              showUpdateToast();
            }
          });
        });
      });
  });
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  if (localStorage.getItem('pwa-install-dismissed')) return;
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.innerHTML = `
    <div class="pwa-banner-content">
      <img src="/img/icon.svg" alt="Biblioteca" class="pwa-banner-icon">
      <div class="pwa-banner-text">
        <strong>Instalar Biblioteca Jorge Amado</strong>
        <span>Use como um aplicativo no seu dispositivo</span>
      </div>
      <div class="pwa-banner-actions">
        <button class="pwa-btn-install" id="pwa-btn-install">Instalar</button>
        <button class="pwa-btn-dismiss" id="pwa-btn-dismiss">&times;</button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('visible'));

  document.getElementById('pwa-btn-install').addEventListener('click', async () => {
    banner.classList.remove('visible');
    setTimeout(() => banner.remove(), 300);
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    }
  });

  document.getElementById('pwa-btn-dismiss').addEventListener('click', () => {
    banner.classList.remove('visible');
    setTimeout(() => banner.remove(), 300);
    localStorage.setItem('pwa-install-dismissed', 'true');
  });
}

function showUpdateToast() {
  const toast = document.createElement('div');
  toast.id = 'pwa-update-toast';
  toast.innerHTML = `
    <span>Nova versão disponível!</span>
    <button onclick="location.reload()">Atualizar</button>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
}
