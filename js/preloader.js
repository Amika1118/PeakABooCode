/* ============================================
   preloader.js - first-load preloader
   - Minimum display time: 2500ms
   - Hard timeout: 4000ms
   - Fade-out: 450ms
   ============================================ */
(function () {
    'use strict';

    var MIN_VISIBLE_MS = 2500;
    var HARD_TIMEOUT_MS = 4000;
    var FADE_MS = 450;

    var el = document.getElementById('preloader');
    if (!el) return;

    var startedAt = Date.now();
    var hidden = false;

    function hide() {
        if (hidden) return;
        hidden = true;
        el.classList.add('is-hidden');
        setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, FADE_MS);
    }

    function hideAfterMin() {
        var elapsed = Date.now() - startedAt;
        var remaining = MIN_VISIBLE_MS - elapsed;
        if (remaining <= 0) hide();
        else setTimeout(hide, remaining);
    }

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        requestAnimationFrame(hideAfterMin);
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            requestAnimationFrame(hideAfterMin);
        });
    }

    setTimeout(hide, HARD_TIMEOUT_MS);
})();