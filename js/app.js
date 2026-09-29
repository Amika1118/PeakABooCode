/* ============================================
   app.js — application bootstrap
   ============================================ */
(function () {
    'use strict';

    function init() {
        document.documentElement.classList.add('app-ready');
        // Future: load data files, init help bot, warm caches
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();