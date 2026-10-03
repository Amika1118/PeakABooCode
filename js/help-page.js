/* ============================================
   help-page.js - renders the Help tab from
   data/help-content.json. Collapsible sections,
   search filter, deep links (#help/<id>).
   ============================================ */
(function () {
    'use strict';

    var CONTENT_URL = 'data/help-content.json';
    var state = { sections: [] };
    var panel, stage;

    function init() {
        panel = document.querySelector('[data-tab-panel="help"]');
        if (!panel) return;
        stage = panel.querySelector('[data-help-stage]');
        if (!stage) return;

        stage.innerHTML = '<p class="help-loading">Loading help...</p>';
        load();
    }

    function load() {
        fetch(CONTENT_URL, { cache: 'force-cache' })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                state.sections = (data && Array.isArray(data.sections)) ? data.sections : [];
                render();
                applyDeepLink();
            })
            .catch(function () {
                stage.innerHTML =
                    '<p class="help-error">Could not load help content. ' +
                    'Check your connection and reload the page.</p>';
            });
    }

    function render() {
        var html =
            '<div class="help-search-wrap">' +
            '<input type="search" class="help-search" data-help-search ' +
            'placeholder="Search help..." aria-label="Search help">' +
            '</div>' +
            '<div class="help-list" data-help-list>' +
            state.sections.map(renderSection).join('') +
            '</div>' +
            '<p class="help-empty" data-help-empty hidden>No matching sections.</p>';

        stage.innerHTML = html;

        // Wire toggles
        stage.querySelectorAll('[data-help-toggle]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-help-toggle');
                toggleSection(id);
            });
        });

        // Wire search
        var search = stage.querySelector('[data-help-search]');
        if (search) {
            search.addEventListener('input', function () {
                filter(search.value);
            });
        }
    }

    function renderSection(s) {
        return '<article class="help-section" data-help-section="' + escapeAttr(s.id) + '">' +
            '<button type="button" class="help-section-head" data-help-toggle="' + escapeAttr(s.id) + '" ' +
            'aria-expanded="false" aria-controls="help-body-' + escapeAttr(s.id) + '">' +
            '<span class="help-section-title">' + escapeHtml(s.title) + '</span>' +
            '<span class="help-section-chevron" aria-hidden="true">▸</span>' +
            '</button>' +
            '<div class="help-section-body" id="help-body-' + escapeAttr(s.id) + '" hidden>' +
            (s.body || '') +
            '</div>' +
            '</article>';
    }

    function toggleSection(id) {
        var section = stage.querySelector('[data-help-section="' + cssEscape(id) + '"]');
        if (!section) return;
        var btn = section.querySelector('[data-help-toggle]');
        var body = section.querySelector('.help-section-body');
        var isOpen = btn.getAttribute('aria-expanded') === 'true';

        btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        body.hidden = isOpen;
        section.classList.toggle('is-open', !isOpen);
    }

    function openSection(id) {
        var section = stage.querySelector('[data-help-section="' + cssEscape(id) + '"]');
        if (!section) return;
        var btn = section.querySelector('[data-help-toggle]');
        var body = section.querySelector('.help-section-body');
        if (btn && body) {
            btn.setAttribute('aria-expanded', 'true');
            body.hidden = false;
            section.classList.add('is-open');
        }
    }

    function filter(query) {
        var q = String(query || '').trim().toLowerCase();
        var anyVisible = false;

        stage.querySelectorAll('[data-help-section]').forEach(function (section) {
            var title = section.querySelector('.help-section-title');
            var body = section.querySelector('.help-section-body');
            var haystack = ((title ? title.textContent : '') + ' ' +
                (body ? body.textContent : '')).toLowerCase();

            var match = !q || haystack.indexOf(q) !== -1;
            section.hidden = !match;
            if (match) anyVisible = true;

            if (q && match) {
                // Auto-open matching sections
                var btn = section.querySelector('[data-help-toggle]');
                var b = section.querySelector('.help-section-body');
                if (btn && b) {
                    btn.setAttribute('aria-expanded', 'true');
                    b.hidden = false;
                    section.classList.add('is-open');
                }
            }
        });

        var empty = stage.querySelector('[data-help-empty]');
        if (empty) empty.hidden = anyVisible;
    }

    function applyDeepLink() {
        var hash = window.location.hash || '';
        var m = hash.match(/^#help\/(.+)$/);
        if (!m) return;
        openSection(decodeURIComponent(m[1]));
    }

    // Listen for hash changes so #help/<id> works
    window.addEventListener('hashchange', function () {
        applyDeepLink();
    });

    // Expose for the bot
    window.HelpPage = {
        getSections: function () { return state.sections; },
        openSection: openSection
    };

    // ---- Utilities ----
    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    function escapeAttr(s) {
        return escapeHtml(s).replace(/'/g, '&#39;');
    }
    function cssEscape(s) {
        return String(s).replace(/["\\]/g, '\\$&');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();