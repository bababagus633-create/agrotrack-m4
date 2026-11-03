(function () {
  const es = new EventSource('/api/prices/stream');
  es.onmessage = function (e) {
    const evt = JSON.parse(e.data);
    document.dispatchEvent(new CustomEvent('prices:updated', { detail: evt }));
    if (typeof window.load === 'function') window.load(true);
  };
  es.onerror = function () { console.warn('Live update terputus, mencoba lagi...'); };
  setInterval(function () {
    if (typeof window.load === 'function') window.load(true);
  }, 15 * 60 * 1000);
})();
