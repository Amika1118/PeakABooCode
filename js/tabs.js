/* ============================================
   tabs.js - path routing between tab panels
   (/clean, /test, /help, /help/<section>, /settings)
   Uses the History API, so there is no # in URLs.
   Old #hash links are converted automatically.
   Exposes window.SiteRouter for other scripts.
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
    var shownTab = null;

    // ---- URL helpers ----
    function segments() {
        return window.location.pathname.split('/').filter(Boolean);
    }

    function firstSegment() {
        var s = (segments()[0] || '').toLowerCase();
        return s === 'index.html' ? '' : s;
    }

    function tab() {
        var s = firstSegment();
        return TABS.indexOf(s) !== -1 ? s : DEFAULT;
    }

    function sub() {
        var s = segments()[1];
        if (!s) return null;
        try { return decodeURIComponent(s); } catch (e) { return s; }
    }

    function pathFor(name, subId) {
        return '/' + name + (subId ? '/' + encodeURIComponent(subId) : '');
    }

    // "#help/link-cleaner" -> "/help/link-cleaner" (null if not a site hash)
    function hashToPath(hash) {
        var m = /^#(clean|test|help|settings)(?:\/(.+))?$/.exec(hash || '');
        if (!m) return null;
        var id = null;
        if (m[2]) { try { id = decodeURIComponent(m[2]); } catch (e) { id = m[2]; } }
        return pathFor(m[1], id);
    }

    // ---- Rendering ----
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

        document.title = 'PeekABooCode | ' + (TITLES[name] || 'PeekABooCode');
    }

    // After a tab switch: back to the top, and keyboard / screen-reader
    // users land on the new panel's heading.
    function afterSwitch(name) {
        var changed = shownTab !== null && shownTab !== name;
        shownTab = name;
        if (!changed) return;
        window.scrollTo(0, 0);
        var h = document.getElementById('tab-' + name + '-heading');
        if (h) {
            h.setAttribute('tabindex', '-1');
            h.focus({ preventScroll: true });
        }
    }

    function onRoute() {
        var name = tab();
        activate(name);
        afterSwitch(name);
        window.dispatchEvent(new Event('routechange'));
    }

    function go(path, replace) {
        if (path !== window.location.pathname) {
            history[replace ? 'replaceState' : 'pushState'](null, '', path);
        }
        onRoute();
    }

    // ---- Link handling ----
    function onDocumentClick(e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var a = e.target.closest ? e.target.closest('a') : null;
        if (!a) return;
        if (a.target && a.target !== '_self') return;
        var href = a.getAttribute('href');
        if (!href) return;

        // Skip link: the page uses <base href="/">, so a bare #main would reload "/".
        if (href === '#main') {
            e.preventDefault();
            var main = document.getElementById('main');
            if (main) main.focus();
            return;
        }

        var path = hashToPath(href);
        if (!path && href.charAt(0) === '/' && href.charAt(1) !== '/') {
            var clean = href.split(/[?#]/)[0];
            var seg = (clean.split('/').filter(Boolean)[0] || '').toLowerCase();
            if (TABS.indexOf(seg) !== -1) path = clean;
        }
        if (!path) return;

        e.preventDefault();
        go(path);
    }

    function init() {
        var legacy = hashToPath(window.location.hash);
        var seg = firstSegment();
        if (legacy) {
            history.replaceState(null, '', legacy);
        } else if (TABS.indexOf(seg) === -1) {
            // served as /app.html, or an unknown path: show the default tab
            history.replaceState(null, '', pathFor(DEFAULT));
        }

        activate(tab());
        afterSwitch(tab());

        document.addEventListener('click', onDocumentClick);
        window.addEventListener('popstate', onRoute);
        window.addEventListener('hashchange', function () {
            var p = hashToPath(window.location.hash);
            if (p) go(p, true);
        });
    }

    window.SiteRouter = { tab: tab, sub: sub, go: go, pathFor: pathFor };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();