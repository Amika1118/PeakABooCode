/* ============================================
   link-cleaner.js - URL validation, tracking
   param stripping, source app detection, and
   result rendering for the Clean tab.
   ============================================ */
(function () {
    'use strict';

    // ---- Tracking parameter rules ----
    // Each rule is a RegExp tested against the param key.
    // Keep conservative: don't strip things that might break sites.
    var TRACKING_RULES = [
        /^utm_/i,
        /^fbclid$/i,
        /^gclid$/i,
        /^dclid$/i,
        /^msclkid$/i,
        /^igshid$/i,
        /^igsh$/i,
        /^mc_eid$/i,
        /^mc_cid$/i,
        /^yclid$/i,
        /^_ga$/i,
        /^_gl$/i,
        /^si$/i,          // YouTube share tracking
        /^feature$/i,     // YouTube share variant
        /^ref_src$/i,
        /^ref_url$/i,
        /^trk$/i,
        /^trkCampaign$/i,
        /^sc_cid$/i,
        /^wickedid$/i,
        /^vero_id$/i,
        /^oly_enc_id$/i,
        /^oly_anon_id$/i,
        /^mkt_tok$/i,
        /^_hsenc$/i,
        /^_hsmi$/i,
        /^hsa_/i,
        /^__hssc$/i,
        /^__hstc$/i,
        /^__hsfp$/i
    ];

    // ---- State ----
    var appMapping = {};
    var els = {};

    // ---- Init ----
    function init() {
        els.form = document.querySelector('[data-clean-form]');
        els.input = document.querySelector('[data-clean-input]');
        els.result = document.querySelector('[data-clean-result]');
        if (!els.form || !els.input || !els.result) return;

        els.form.addEventListener('submit', onSubmit);

        // Load app mapping, then mark the form ready.
        loadMapping().then(function () {
            els.form.classList.add('is-ready');
            els.input.disabled = false;
            els.input.focus();
        });
    }

    // ---- Mapping loader ----
    function loadMapping() {
        return fetch('data/app-mapping.json', { cache: 'force-cache' })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                if (data && typeof data === 'object') appMapping = data;
            })
            .catch(function () {
                // Silent fallback: source detection just won't match.
                appMapping = {};
            });
    }

    // ---- Submit handler ----
    function onSubmit(e) {
        e.preventDefault();
        var raw = (els.input.value || '').trim();
        if (!raw) {
            renderError('Paste a link to clean.');
            return;
        }

        var parsed = parseUrl(raw);
        if (!parsed) {
            renderError("That doesn't look like a link.");
            return;
        }

        var cleaned = cleanUrl(parsed.url);
        var source = getSource(parsed.url);

        renderResult({
            original: parsed.url.toString(),
            cleaned: cleaned.cleanUrl,
            removed: cleaned.removed,
            sourceName: source ? source.name : null,
            sourceDomain: source ? source.domain : parsed.url.hostname.replace(/^www\./, ''),
            wasPrepended: parsed.wasPrepended,
            hasCredentials: parsed.hasCredentials
        });
    }

    // ---- URL parsing ----
    function parseUrl(input) {
        var url, wasPrepended = false;

        // Try strict parse first
        try {
            url = new URL(input);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                return null;
            }
        } catch (e) {
            // Lenient: try prepending https:// if it looks like a domain
            if (!looksLikeDomain(input)) return null;
            try {
                url = new URL('https://' + input);
                wasPrepended = true;
            } catch (e2) {
                return null;
            }
        }

        // Detect embedded credentials user:pass@host
        var hasCredentials = false;
        if (url.username || url.password) {
            hasCredentials = true;
            url.username = '';
            url.password = '';
        }

        return {
            url: url,
            wasPrepended: wasPrepended,
            hasCredentials: hasCredentials
        };
    }

    function looksLikeDomain(str) {
        if (!str || /\s/.test(str)) return false;
        if (str.indexOf('.') === -1) return false;
        // Strip path/query for the domain check
        var hostPart = str.split(/[\/?#]/)[0];
        if (hostPart.indexOf('.') === -1) return false;
        var parts = hostPart.split('.');
        if (parts.length < 2) return false;
        var tld = parts[parts.length - 1];
        if (!/^[a-z]{2,}$/i.test(tld)) return false;
        return true;
    }

    // ---- Cleaning ----
    function cleanUrl(url) {
        var removed = [];
        var params = url.searchParams;

        // Snapshot keys first because we mutate while iterating
        var keys = [];
        params.forEach(function (value, key) {
            keys.push(key);
        });

        keys.forEach(function (key) {
            for (var i = 0; i < TRACKING_RULES.length; i++) {
                if (TRACKING_RULES[i].test(key)) {
                    removed.push(key);
                    params.delete(key);
                    break;
                }
            }
        });

        return {
            cleanUrl: url.toString(),
            removed: removed
        };
    }

    // ---- Source detection ----
    function getSource(url) {
        var host = url.hostname.toLowerCase().replace(/^www\./, '');

        // Exact match
        if (appMapping[host]) {
            return { name: appMapping[host], domain: host };
        }

        // Suffix match: subdomains of a known domain
        for (var domain in appMapping) {
            if (!Object.prototype.hasOwnProperty.call(appMapping, domain)) continue;
            if (host === domain || host.endsWith('.' + domain)) {
                return { name: appMapping[domain], domain: domain };
            }
        }

        return null;
    }

    // ---- Render ----
    function renderError(message) {
        els.result.hidden = false;
        els.result.innerHTML =
            '<div class="clean-error" role="alert">' +
            '<span class="clean-error-icon" aria-hidden="true">⚠</span>' +
            '<span>' + escapeHtml(message) + '</span>' +
            '</div>';
    }

    function renderResult(data) {
        var hasSource = !!data.sourceName;
        var sourceLabel = hasSource ? data.sourceName : data.sourceDomain;
        var iconHtml = window.Icons
            ? window.Icons.get(data.sourceName, data.sourceDomain)
            : '';

        var removedHtml = data.removed.length
            ? '<ul class="clean-removed-list">' +
            data.removed.map(function (p) {
                return '<li><code>' + escapeHtml(p) + '</code></li>';
            }).join('') +
            '</ul>'
            : '<p class="clean-none">No tracking parameters found.</p>';

        var notesHtml = '';
        if (data.wasPrepended) {
            notesHtml += '<p class="clean-note">Added <code>https://</code> to the start.</p>';
        }
        if (data.hasCredentials) {
            notesHtml += '<p class="clean-note clean-note-warn">Removed embedded username/password from the URL.</p>';
        }

        els.result.hidden = false;
        els.result.innerHTML =
            '<article class="clean-card">' +

            '<header class="clean-card-head">' +
            '<div class="clean-source">' +
            iconHtml +
            '<div class="clean-source-text">' +
            '<span class="clean-source-label">Source</span>' +
            '<span class="clean-source-name">' + escapeHtml(sourceLabel) + '</span>' +
            '</div>' +
            '</div>' +
            '</header>' +

            '<section class="clean-block">' +
            '<h3 class="clean-block-title">Cleaned URL</h3>' +
            '<div class="clean-url-row">' +
            '<code class="clean-url" data-clean-url>' + escapeHtml(data.cleaned) + '</code>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-clean-copy>Copy</button>' +
            '</div>' +
            '</section>' +

            '<section class="clean-block">' +
            '<h3 class="clean-block-title">Removed</h3>' +
            removedHtml +
            '</section>' +

            (notesHtml ? '<section class="clean-block">' + notesHtml + '</section>' : '') +

            '</article>';

        // Wire copy button
        var copyBtn = els.result.querySelector('[data-clean-copy]');
        if (copyBtn) {
            copyBtn.addEventListener('click', function () {
                copyToClipboard(data.cleaned).then(function (ok) {
                    setCopyState(copyBtn, ok ? 'Copied' : 'Press Ctrl+C');
                });
            });
        }
    }

    // ---- Clipboard + feedback ----
    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).then(function () {
                return true;
            }).catch(function () {
                return fallbackCopy(text);
            });
        }
        return Promise.resolve(fallbackCopy(text));
    }

    function fallbackCopy(text) {
        try {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'absolute';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            var ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch (e) {
            return false;
        }
    }

    function setCopyState(btn, label) {
        if (btn.dataset.busy) return;
        btn.dataset.busy = '1';
        var original = btn.textContent;
        btn.textContent = label;
        btn.disabled = true;
        setTimeout(function () {
            btn.textContent = original;
            btn.disabled = false;
            delete btn.dataset.busy;
        }, 1400);
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ---- Bootstrap ----
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();