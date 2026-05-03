(function () {
  'use strict';

  function initWhenReady() {
    if (window.TopbarCore && typeof window.TopbarCore.init === 'function') {
      window.TopbarCore.init();
    }
  }

  function loadCore(callback) {
    if (window.TopbarCore) {
      callback();
      return;
    }

    if (document.querySelector('script[data-topbar-core="1"]')) {
      document.addEventListener('topbar:core-ready', callback, { once: true });
      return;
    }

    var script = document.createElement('script');
    script.src = '/src/js/topbar-core.js';
    script.defer = true;
    script.setAttribute('data-topbar-core', '1');
    script.onload = function () {
      document.dispatchEvent(new CustomEvent('topbar:core-ready'));
      callback();
    };
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      loadCore(initWhenReady);
    });
  } else {
    loadCore(initWhenReady);
  }
})();
