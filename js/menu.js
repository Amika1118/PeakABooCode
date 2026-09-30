/* ============================================
   menu.js — mobile hamburger menu
   - toggles aria-expanded
   - closes on Escape, outside click, link click
   - returns focus to the toggle on close
   - closes automatically if the window widens past the breakpoint
   ============================================ */
(function () {
    'use strict';

    var BREAKPOINT = 720;
    var toggle, menu;

    function isOpen() {
        return toggle && toggle.getAttribute('aria-expanded') === 'true';
    }

    function open() {
        if (!toggle || !menu || isOpen()) return;
        menu.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', 'Close menu');

        // Focus first link for keyboard users
        var first = menu.querySelector('a, button');
        if (first) first.focus();
    }

    function close(returnFocus) {
        if (!toggle || !menu || !isOpen()) return;
        menu.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
        if (returnFocus) toggle.focus();
    }

    function toggleOpen() {
        if (isOpen()) close(true);
        else open();
    }

    function init() {
        toggle = document.querySelector('[data-menu-toggle]');
        menu = document.querySelector('[data-mobile-menu]');
        if (!toggle || !menu) return;

        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleOpen();
        });

        // Close when a link inside the menu is clicked
        menu.addEventListener('click', function (e) {
            var link = e.target.closest('a');
            if (link) close(false);
        });

        // Close on Escape
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen()) {
                close(true);
            }
        });

        // Close on outside click
        document.addEventListener('click', function (e) {
            if (!isOpen()) return;
            if (menu.contains(e.target) || toggle.contains(e.target)) return;
            close(false);
        });

        // Close if window grows past breakpoint
        var mq = window.matchMedia('(min-width: ' + BREAKPOINT + 'px)');
        var onChange = function (e) {
            if (e.matches) close(false);
        };
        if (typeof mq.addEventListener === 'function') {
            mq.addEventListener('change', onChange);
        } else if (typeof mq.addListener === 'function') {
            mq.addListener(onChange);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();