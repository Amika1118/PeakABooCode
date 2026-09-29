/* ============================================
   theme.js — light / dark / system toggle
   ============================================ */
(function () {
    'use strict';

    var STORAGE_KEY = 'theme';
    var ORDER = ['light', 'dark', 'system'];
    var root = document.documentElement;
    var media = window.matchMedia('(prefers-color-scheme: dark)');

    function getStored() {
        try {
            var v = localStorage.getItem(STORAGE_KEY);
            return ORDER.indexOf(v) !== -1 ? v : 'system';
        } catch (e) {
            return 'system';
        }
    }

    function resolve(stored) {
        if (stored === 'system') {
            return media.matches ? 'dark' : 'light';
        }
        return stored;
    }

    function updateToggle(stored) {
        var btn = document.querySelector('[data-theme-toggle]');
        if (!btn) return;

        btn.setAttribute('aria-label', 'Theme: ' + stored + '. Click to change.');
        btn.dataset.state = stored;

        var icon = btn.querySelector('[data-theme-icon]');
        if (icon) {
            icon.textContent =
                stored === 'light' ? '☀' :
                    stored === 'dark' ? '☾' :
                        '⚙';
        }

        var label = btn.querySelector('[data-theme-label]');
        if (label) {
            label.textContent = stored.charAt(0).toUpperCase() + stored.slice(1);
        }
    }

    function apply(stored) {
        root.setAttribute('data-theme', resolve(stored));
        updateToggle(stored);
    }

    function set(stored) {
        try { localStorage.setItem(STORAGE_KEY, stored); } catch (e) { }
        apply(stored);
    }

    function cycle(current) {
        var i = ORDER.indexOf(current);
        return ORDER[(i + 1) % ORDER.length];
    }

    function init() {
        apply(getStored());

        var btn = document.querySelector('[data-theme-toggle]');
        if (btn) {
            btn.addEventListener('click', function () {
                set(cycle(getStored()));
            });
        }

        // Follow OS preference changes when in system mode
        var onMediaChange = function () {
            if (getStored() === 'system') apply('system');
        };
        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', onMediaChange);
        } else if (typeof media.addListener === 'function') {
            media.addListener(onMediaChange); // older Safari
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();