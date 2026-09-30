/* ============================================
   tabs.js - hash routing between tab panels
   ============================================ */
(function () {
    'use strict';

    var TABS = ['clean', 'test', 'help', 'settings'];
    var DEFAULT = 'clean';
    var TITLES = {
        clean: 'Clean',
        test: 'Test',
        help: 'Help',
        settings: 'Settings'
    };

    function currentHash() {
        var raw = window.location.hash.replace(/^#/, '').split('/')[0];
        return TABS.indexOf(raw) !== -1 ? raw : DEFAULT;
    }

    function activate(name) {
        document.querySelectorAll('[data-tab-panel]').forEach(function (el) {
            el.hidden = el.dataset.tabPanel !== name;
        });

        document.querySelectorAll('[data-tab-link]').forEach(function (el) {
            var isActive = el.dataset.tabLink === name;
            el.classList.toggle('is-active', isActive);
            if (isActive) {
                el.setAttribute('aria-current', 'page');
            } else {
                el.removeAttribute('aria-current');
            }
        });

        document.title = (TITLES[name] || 'Link Tool') + ' - Link Tool';
    }

    function navigate(name) {
        if (currentHash() === name) {
            activate(name);
        } else {
            window.location.hash = name;
        }
    }

    function init() {
        if (!window.location.hash) {
            history.replaceState(null, '', '#' + DEFAULT);
        }

        activate(currentHash());

        document.querySelectorAll('[data-tab-link]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.preventDefault();
                navigate(el.dataset.tabLink);
            });
        });

        window.addEventListener('hashchange', function () {
            activate(currentHash());
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();