/* ============================================
   threat-checker.js - hybrid phishing detector
   Tier 1: local heuristics (private, instant)
   Tier 2: opt-in online check (MarketNow API)
   Listens for "cleaner:rendered" event and
   injects a verdict banner into the result.

   Uses the detection helpers exposed by
   window.LinkCleaner for XSS, command injection,
   sensitive data, and nested URL analysis.
   ============================================ */
(function () {
    'use strict';

    var SIGNATURES_URL = 'data/threat-signatures.json';
    var ONLINE_API = 'https://www.marketnow.site/api/scam-check';
    var FETCH_TIMEOUT_MS = 6000;

    var signatures = {
        suspiciousTlds: [],
        brands: [],
        shorteners: [],
        loginKeywords: [],
        redirectParams: [],
        multiLevelTlds: [],
        knownRiskyDomains: [],
        riskyKeywords: [],
        weights: { severe: 3, moderate: 2, minor: 1 }
    };
    var loaded = false;
    var loadPromise = null;

    // ---- Init ----
    function init() {
        loadSignatures();
        document.addEventListener('cleaner:rendered', onRendered);
    }

    function loadSignatures() {
        if (loadPromise) return loadPromise;
        loadPromise = fetch(SIGNATURES_URL, { cache: 'force-cache' })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                if (data && typeof data === 'object') {
                    signatures = mergeSignatures(signatures, data);
                }
                loaded = true;
            })
            .catch(function () {
                loaded = true;
            });
        return loadPromise;
    }

    function mergeSignatures(base, incoming) {
        var out = {};
        for (var k in base) {
            if (!Object.prototype.hasOwnProperty.call(base, k)) continue;
            if (Array.isArray(base[k]) && Array.isArray(incoming[k])) {
                out[k] = incoming[k];
            } else if (k === 'weights' && incoming[k]) {
                out[k] = {
                    severe: incoming[k].severe || base[k].severe,
                    moderate: incoming[k].moderate || base[k].moderate,
                    minor: incoming[k].minor || base[k].minor
                };
            } else {
                out[k] = base[k];
            }
        }
        return out;
    }

    // ---- Analyze ----
    function analyze(url) {
        var urlObj;
        try {
            urlObj = url instanceof URL ? url : new URL(url);
        } catch (e) {
            return { verdict: 'unknown', score: 0, reasons: [], severe: false, nestedUrls: [] };
        }

        var reasons = [];
        var score = 0;
        var severeHit = false;
        var w = signatures.weights;

        var host = urlObj.hostname.toLowerCase();
        var protocol = urlObj.protocol;
        var port = urlObj.port;
        var pathAndQuery = (urlObj.pathname + urlObj.search).toLowerCase();

        // ---- Known risky domains (piracy / malware) ----
        var registrable = getRegistrableDomain(host);
        if (signatures.knownRiskyDomains.indexOf(registrable) !== -1) {
            reasons.push({
                level: 'severe',
                text: 'Known piracy or malware-distribution site'
            });
            score += w.severe;
            severeHit = true;
        }

        // ---- Risky keywords in hostname or path ----
        for (var rk = 0; rk < signatures.riskyKeywords.length; rk++) {
            var kw = signatures.riskyKeywords[rk];
            if (host.indexOf(kw) !== -1) {
                reasons.push({
                    level: 'moderate',
                    text: 'Suspicious keyword in domain: "' + kw + '"'
                });
                score += w.moderate;
                break;
            }
        }

        // ---- Severe ----
        if (host.indexOf('xn--') !== -1) {
            reasons.push({ level: 'severe', text: 'Punycode / homograph characters in the domain' });
            score += w.severe;
            severeHit = true;
        }

        var sld = getSLD(host);
        if (sld) {
            var brand = matchBrand(sld);
            if (brand) {
                reasons.push({ level: 'severe', text: 'Domain resembles "' + brand + '" — possible impersonation' });
                score += w.severe;
                severeHit = true;
            }
        }

        // ---- Moderate ----
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
            reasons.push({ level: 'moderate', text: 'Uses a raw IP address instead of a domain name' });
            score += w.moderate;
        }

        var hostParts = host.split('.');
        if (hostParts.length >= 5) {
            reasons.push({ level: 'moderate', text: 'Unusually many subdomains' });
            score += w.moderate;
        }

        if (port && port !== '80' && port !== '443') {
            reasons.push({ level: 'moderate', text: 'Non-standard port (' + port + ')' });
            score += w.moderate;
        }

        if (signatures.shorteners.indexOf(registrable) !== -1) {
            reasons.push({ level: 'moderate', text: 'Shortened link hides the real destination' });
            score += w.moderate;
        }

        if (protocol === 'http:') {
            for (var i = 0; i < signatures.loginKeywords.length; i++) {
                if (pathAndQuery.indexOf(signatures.loginKeywords[i]) !== -1) {
                    reasons.push({ level: 'moderate', text: 'Login-related word on an unencrypted (HTTP) link' });
                    score += w.moderate;
                    break;
                }
            }
        }

        // ---- Minor ----
        if (protocol === 'http:') {
            reasons.push({ level: 'minor', text: 'Not using HTTPS' });
            score += w.minor;
        }

        var tld = hostParts[hostParts.length - 1];
        if (signatures.suspiciousTlds.indexOf(tld) !== -1) {
            reasons.push({ level: 'minor', text: 'Unusual top-level domain (.' + tld + ')' });
            score += w.minor;
        }

        if (url.toString().length > 300) {
            reasons.push({ level: 'minor', text: 'Unusually long URL' });
            score += w.minor;
        }

        var qCount = 0;
        urlObj.searchParams.forEach(function () { qCount++; });
        if (qCount > 10) {
            reasons.push({ level: 'minor', text: 'Many query parameters (' + qCount + ')' });
            score += w.minor;
        }

        // ---- Per-parameter threat scan ----
        if (window.LinkCleaner) {
            urlObj.searchParams.forEach(function (value, key) {
                var xss = window.LinkCleaner.detectXss(value);
                if (xss.hit) {
                    xss.labels.forEach(function (label) {
                        reasons.push({
                            level: 'severe',
                            text: 'XSS payload in "' + key + '": ' + label
                        });
                    });
                    score += w.severe;
                    severeHit = true;
                }

                var cmdi = window.LinkCleaner.detectCommandInjection(value);
                if (cmdi.hit) {
                    cmdi.labels.forEach(function (label) {
                        reasons.push({
                            level: 'severe',
                            text: 'Command injection in "' + key + '": ' + label
                        });
                    });
                    score += w.severe;
                    severeHit = true;
                }

                var sens = window.LinkCleaner.detectSensitiveData(value);
                if (sens.hit) {
                    sens.labels.forEach(function (label) {
                        reasons.push({
                            level: 'severe',
                            text: 'Sensitive data in "' + key + '": ' + label
                        });
                    });
                    score += w.severe;
                    severeHit = true;
                }
            });
        }

        // ---- Redirect param present ----
        var hasRedirect = false;
        urlObj.searchParams.forEach(function (_, k) {
            if (signatures.redirectParams.indexOf(String(k).toLowerCase()) !== -1) {
                hasRedirect = true;
            }
        });
        if (hasRedirect) {
            reasons.push({ level: 'minor', text: 'Contains a redirect parameter' });
            score += w.minor;
        }

        // ---- Nested URL analysis ----
        var nestedUrls = [];
        if (window.LinkCleaner) {
            nestedUrls = window.LinkCleaner.extractNestedUrls(urlObj, 3);

            nestedUrls.forEach(function (n) {
                var verdict = window.LinkCleaner.isSuspiciousRedirect(urlObj, n.decodedUrl);
                if (verdict.suspicious) {
                    verdict.reasons.forEach(function (reason) {
                        reasons.push({
                            level: 'moderate',
                            text: 'Nested URL in "' + n.param + '" ' + reason
                        });
                    });
                    score += w.moderate;
                }

                n.decodedUrl.searchParams.forEach(function (v, k) {
                    var xss2 = window.LinkCleaner.detectXss(v);
                    if (xss2.hit) {
                        reasons.push({
                            level: 'severe',
                            text: 'XSS in nested "' + n.param + '" → "' + k + '": ' + xss2.labels[0]
                        });
                        score += w.severe;
                        severeHit = true;
                    }
                });
            });
        }

        // ---- Verdict ----
        var verdict;
        if (severeHit || score >= 3) verdict = 'suspicious';
        else if (score >= 1) verdict = 'caution';
        else verdict = 'clean';

        return {
            verdict: verdict,
            score: score,
            reasons: reasons,
            severe: severeHit,
            nestedUrls: nestedUrls
        };
    }

    // ---- Helpers ----
    function getRegistrableDomain(host) {
        var parts = host.split('.');
        if (parts.length <= 2) return host;
        var secondLast = parts[parts.length - 2];
        if (signatures.multiLevelTlds.indexOf(secondLast) !== -1 && parts.length >= 3) {
            return parts.slice(-3).join('.');
        }
        return parts.slice(-2).join('.');
    }

    function getSLD(host) {
        var reg = getRegistrableDomain(host);
        return reg.split('.')[0];
    }

    function matchBrand(sld) {
        if (!sld) return null;
        for (var i = 0; i < signatures.brands.length; i++) {
            var brand = signatures.brands[i];
            if (sld === brand) continue;
            if (Math.abs(sld.length - brand.length) > 2) continue;
            var dist = levenshtein(sld, brand);
            if (dist > 0 && dist <= 2) return brand;
        }
        return null;
    }

    function levenshtein(a, b) {
        if (a === b) return 0;
        var m = a.length, n = b.length;
        if (!m) return n;
        if (!n) return m;
        var prev = new Array(n + 1);
        var curr = new Array(n + 1);
        for (var j = 0; j <= n; j++) prev[j] = j;
        for (var i = 1; i <= m; i++) {
            curr[0] = i;
            for (var j2 = 1; j2 <= n; j2++) {
                var cost = a.charCodeAt(i - 1) === b.charCodeAt(j2 - 1) ? 0 : 1;
                curr[j2] = Math.min(
                    curr[j2 - 1] + 1,
                    prev[j2] + 1,
                    prev[j2 - 1] + cost
                );
            }
            var tmp = prev; prev = curr; curr = tmp;
        }
        return prev[n];
    }

    // ---- Rendering ----
    function onRendered(e) {
        var detail = e.detail || {};
        var url = detail.url;
        var container = detail.element;
        if (!url || !container) return;

        var run = function () {
            var analysis = analyze(url);
            injectBanner(container, url, analysis);
        };
        if (loaded) run();
        else loadSignatures().then(run);
    }

    function injectBanner(container, url, analysis) {
        var card = container.querySelector('.clean-card');
        if (!card) return;

        var prev = card.querySelector('[data-threat-verdict]');
        if (prev) prev.parentNode.removeChild(prev);

        var banner = document.createElement('section');
        banner.className = 'clean-verdict clean-verdict-' + analysis.verdict;
        banner.setAttribute('data-threat-verdict', analysis.verdict);

        var icon, title, subtitle;
        if (analysis.verdict === 'clean') {
            icon = '✅';
            title = 'Looks clean';
            subtitle = 'No suspicious patterns found.';
        } else if (analysis.verdict === 'caution') {
            icon = '🟡';
            title = 'Minor concerns';
            subtitle = 'A few things worth a second look.';
        } else if (analysis.verdict === 'suspicious') {
            icon = '🔴';
            title = 'Suspicious link';
            subtitle = 'Be careful. Do not enter passwords or payment info.';
        } else {
            icon = '⚪';
            title = 'Not analyzed';
            subtitle = '';
        }

        var reasonsHtml = '';
        if (analysis.reasons && analysis.reasons.length) {
            reasonsHtml =
                '<ul class="clean-verdict-reasons">' +
                analysis.reasons.map(function (r) {
                    return '<li class="clean-verdict-reason clean-verdict-reason-' +
                        escapeHtml(r.level) + '">' + escapeHtml(r.text) + '</li>';
                }).join('') +
                '</ul>';
        }

        banner.innerHTML =
            '<div class="clean-verdict-head">' +
            '<span class="clean-verdict-icon" aria-hidden="true">' + icon + '</span>' +
            '<div class="clean-verdict-text">' +
            '<span class="clean-verdict-title">' + escapeHtml(title) + '</span>' +
            (subtitle ? '<span class="clean-verdict-subtitle">' + escapeHtml(subtitle) + '</span>' : '') +
            '</div>' +
            '</div>' +
            reasonsHtml +
            '<div class="clean-verdict-actions" data-online-actions>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-check-online>' +
            'Check online for known threats' +
            '</button>' +
            '</div>' +
            '<div class="clean-online-result" data-online-result hidden aria-live="polite"></div>';

        var head = card.querySelector('.clean-card-head');
        if (head && head.nextSibling) {
            card.insertBefore(banner, head.nextSibling);
        } else {
            card.insertBefore(banner, card.firstChild);
        }

        wireOnlineCheck(banner, url);
    }

    function wireOnlineCheck(banner, url) {
        var actions = banner.querySelector('[data-online-actions]');
        var checkBtn = banner.querySelector('[data-check-online]');
        var resultEl = banner.querySelector('[data-online-result]');
        if (!checkBtn || !actions || !resultEl) return;

        checkBtn.addEventListener('click', function () {
            renderConsent(actions, resultEl, url);
        });
    }

    function renderConsent(actions, resultEl, url) {
        actions.innerHTML =
            '<div class="clean-online-consent">' +
            '<p class="clean-online-consent-text">' +
            'This sends the domain to a free security API. The link leaves your browser. Nothing is logged by us.' +
            '</p>' +
            '<div class="clean-online-consent-actions">' +
            '<button type="button" class="btn btn-primary btn-sm" data-online-yes>Yes, check</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-online-cancel>Cancel</button>' +
            '</div>' +
            '</div>';

        var yes = actions.querySelector('[data-online-yes]');
        var cancel = actions.querySelector('[data-online-cancel]');

        if (yes) {
            yes.addEventListener('click', function () {
                runOnlineCheck(actions, resultEl, url);
            });
        }
        if (cancel) {
            resetActions(actions, resultEl, url);
        }
    }

    function resetActions(actions, resultEl, url) {
        actions.innerHTML =
            '<button type="button" class="btn btn-secondary btn-sm" data-check-online>' +
            'Check online for known threats' +
            '</button>';
        var btn = actions.querySelector('[data-check-online]');
        if (btn) {
            btn.addEventListener('click', function () {
                renderConsent(actions, resultEl, url);
            });
        }
    }

    function runOnlineCheck(actions, resultEl, url) {
        actions.innerHTML =
            '<div class="clean-online-loading">' +
            '<span class="spinner spinner-sm"></span>' +
            '<span>Checking...</span>' +
            '</div>';
        resultEl.hidden = true;

        var domain;
        try {
            domain = new URL(url).hostname.replace(/^www\./, '');
        } catch (e) {
            resultEl.hidden = false;
            resultEl.className = 'clean-online-result clean-online-unknown';
            resultEl.textContent = 'Could not read the domain.';
            resetActions(actions, resultEl, url);
            return;
        }

        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = setTimeout(function () {
            if (controller) controller.abort();
        }, FETCH_TIMEOUT_MS);

        fetch(ONLINE_API + '?domain=' + encodeURIComponent(domain), {
            method: 'GET',
            signal: controller ? controller.signal : undefined
        })
            .then(function (res) {
                clearTimeout(timer);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                showOnlineResult(resultEl, actions, url, interpret(data));
            })
            .catch(function (err) {
                clearTimeout(timer);
                var msg;
                if (err && err.name === 'AbortError') {
                    msg = 'The online check timed out.';
                } else if (err && err.message === 'Failed to fetch') {
                    msg = 'Online check is unavailable in this browser (network or CORS blocked).';
                } else {
                    msg = 'Online check failed. Try again later.';
                }
                showOnlineResult(resultEl, actions, url, {
                    status: 'unknown',
                    message: msg
                });
            });
    }

    function interpret(data) {
        if (!data) {
            return { status: 'unknown', message: 'No data returned.' };
        }
        var decision = String(data.decision || '').toUpperCase();
        var reasons = Array.isArray(data.reasons) ? data.reasons : [];

        if (decision === 'TRUSTED') {
            return { status: 'clean', message: 'No known threats found.' };
        }
        if (decision === 'SUSPICIOUS' || decision === 'MALICIOUS' || decision === 'DANGEROUS') {
            return {
                status: 'suspicious',
                message: 'Listed as a phishing or malware site.' +
                    (reasons.length ? ' ' + reasons.join('; ') : '')
            };
        }
        if (decision === 'CAUTION') {
            return {
                status: 'caution',
                message: 'Some concerns were flagged by the online check.' +
                    (reasons.length ? ' ' + reasons.join('; ') : '')
            };
        }
        return { status: 'unknown', message: 'Not in the threat database. Not guaranteed safe.' };
    }

    function showOnlineResult(resultEl, actions, url, payload) {
        resultEl.hidden = false;
        resultEl.className = 'clean-online-result clean-online-' + payload.status;
        resultEl.textContent = payload.message;

        actions.innerHTML =
            '<button type="button" class="btn btn-ghost btn-sm" data-retry-online>Check again</button>';
        var retry = actions.querySelector('[data-retry-online]');
        if (retry) {
            retry.addEventListener('click', function () {
                renderConsent(actions, resultEl, url);
            });
        }
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ---- Public API ----
    window.ThreatChecker = {
        analyze: function (url) { return analyze(url); },
        ready: function () { return loaded; }
    };

    // ---- Bootstrap ----
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();