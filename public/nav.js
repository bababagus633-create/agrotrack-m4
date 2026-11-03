(() => {
  const KEY = 'token';
  const fromHash = location.hash.match(/token=([^&]+)/)?.[1];
  if (fromHash) {
    try { sessionStorage.setItem(KEY, fromHash); } catch {}
  }
  let stored = null;
  try { stored = sessionStorage.getItem(KEY); } catch {}
  const token = fromHash ?? stored;

  // Modul baru (M3, M1) tinggal ditambahkan di sini.
  const pages = [
    { path: '/', label: 'Peta lahan' },
    { path: '/pricing.html', label: 'Harga pasar' },
    { path: '/harvest.html', label: 'Jurnal panen' },
    { path: '/supply.html', label: 'Rantai pasok' },
  ];
  const here = location.pathname.replace(/index\.html$/, '');

  addEventListener('DOMContentLoaded', () => {
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Navigasi modul');
    Object.assign(nav.style, {
      position: 'fixed', left: '50%', bottom: '16px', transform: 'translateX(-50%)',
      zIndex: '10000', display: 'flex', gap: '4px', padding: '4px',
      background: '#fff', border: '1px solid #ccc', borderRadius: '999px',
      boxShadow: '0 2px 8px rgba(0,0,0,.2)', font: '14px system-ui, sans-serif',
    });
    for (const p of pages) {
      const a = document.createElement('a');
      a.textContent = p.label;
      a.href = p.path + (token ? '#token=' + token : '');
      const active = here === p.path;
      if (active) a.setAttribute('aria-current', 'page');
      Object.assign(a.style, {
        padding: '8px 14px', borderRadius: '999px', textDecoration: 'none',
        color: active ? '#fff' : '#1e5a3c', background: active ? '#1e5a3c' : 'transparent',
      });
      nav.appendChild(a);
    }
    document.body.appendChild(nav);
  });
})();