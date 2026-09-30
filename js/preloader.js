/* ============================================
   preloader.js - first-load preloader
   Fades out when the DOM is ready, or at 1.5s, whichever comes first.
   ============================================ */
(function () {
    'use strict';

    var HARD_TIMEOUT_MS = 2500;
    var FADE_MS = 500;

    var el = document.getElementById('preloader');
    if (!el) return;

    var hidden = false;

    function hide() {
        if (hidden) return;
        hidden = true;
        el.classList.add('is-hidden');
        setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, FADE_MS);
    }

    // Fade out as soon as the DOM is interactive
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        requestAnimationFrame(hide);
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            requestAnimationFrame(hide);
        });
    }

    // Hard timeout - never trap the user
    setTimeout(hide, HARD_TIMEOUT_MS);
})();