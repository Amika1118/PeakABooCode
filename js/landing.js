/* ============================================
   landing.js - live "clean a link" demo,
   smooth-scroll button, skip link.
   No network requests.
   ============================================ */
(function () {
    'use strict';

    // A small sample of common tracking parameters (the app has the full list).
    var TRACKERS = /^(utm_[a-z0-9_]+|fbclid|gclid|dclid|msclkid|yclid|twclid|ttclid|igshid|igsh|mc_eid|mc_cid|mkt_tok|ref_src|ref_url|spm|_hsenc|_hsmi|vero_id|wickedid|oly_enc_id|oly_anon_id|li_fat_id)$/i;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var form, input, out;

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function parse(raw) {
        var t = String(raw || '').trim();
        if (!t) return null;
        if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) t = 'https://' + t;
        try {
            var u = new URL(t);
            if (!/^https?:$/.test(u.protocol) || u.hostname.indexOf('.') === -1) return null;
            return u;
        } catch (e) {
            return null;
        }
    }

    function isTracker(part) {
        var key = part.split('=')[0];
        try { key = decodeURIComponent(key); } catch (e) { }
        return TRACKERS.test(key);
    }

    function render(u, animate) {
        var base = u.origin + u.pathname;
        var parts = u.search ? u.search.slice(1).split('&').filter(Boolean) : [];
        var kept = [], removed = 0;

        var beforeHtml = esc(base) + parts.map(function (p, i) {
            var t = isTracker(p);
            if (t) removed++; else kept.push(p);
            return '<span class="lp-p' + (t ? ' is-tracker' : '') + '">' + (i ? '&amp;' : '?') + esc(p) + '</span>';
        }).join('') + esc(u.hash);

        var afterText = base + (kept.length ? '?' + kept.join('&') : '') + u.hash;

        var summary = removed
            ? '<strong>' + removed + ' tracker' + (removed === 1 ? '' : 's') + ' removed.</strong> '
            : '<strong>No trackers found.</strong> This link was already clean. ';
        summary += 'It opens ' + esc(u.hostname) + '.';

        var html = '';
        if (removed) {
            html += '<div><p class="lp-row-label">Before</p><p class="lp-url">' + beforeHtml + '</p></div>';
        }
        html += '<div class="lp-after' + (animate ? ' is-pending' : '') + '" data-after>' +
            '<p class="lp-row-label">After</p><p class="lp-url lp-url-after">' + esc(afterText) + '</p>' +
            '<p class="lp-summary">' + summary + '</p></div>';

        out.classList.remove('is-done');
        out.innerHTML = html;

        var after = out.querySelector('[data-after]');
        if (animate && !reduceMotion) {
            // one moment: the trackers get crossed out, then the clean link appears
            setTimeout(function () {
                out.classList.add('is-done');
                after.classList.remove('is-pending');
            }, 900);
        } else {
            out.classList.add('is-done');
            after.classList.remove('is-pending');
        }
    }

    function run(animate) {
        var u = parse(input.value);
        if (!u) {
            out.innerHTML = '<p class="lp-error">That doesn\'t look like a link. Try one that starts with https://</p>';
            return;
        }
        render(u, animate);
    }

    function init() {
        form = document.querySelector('[data-demo-form]');
        input = document.querySelector('.lp-demo-input');
        out = document.querySelector('[data-demo-out]');
        if (form && input && out) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                run(false);
            });
            run(true);
        }

        document.querySelectorAll('[data-scroll]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var target = document.getElementById(btn.getAttribute('data-scroll'));
                if (target) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
            });
        });

        // keep the address bar free of "#..." when using the skip link
        var skip = document.querySelector('[data-skip]');
        if (skip) {
            skip.addEventListener('click', function (e) {
                e.preventDefault();
                var main = document.getElementById('lp-main');
                if (main) main.focus();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();