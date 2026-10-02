/* ============================================
   generate-code.js - Make Code modal
   Formats: QR (qrcodejs), Code 128 / EAN-13 (JsBarcode)
   Outputs: PNG, SVG
   Warnings: red-flagged links, token/password URLs
   Libraries local-first with CDN fallback.
   ============================================ */
(function () {
    'use strict';

    var QRCODE_CDNS = [
        'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
        'https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs/qrcode.min.js'
    ];
    var JSBARCODE_CDNS = [
        'https://unpkg.com/jsbarcode@3.11.6/dist/JsBarcode.all.min.js',
        'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js'
    ];

    var qrcodePromise = null;
    var jsbarcodePromise = null;

    var modal = null;
    var els = {};
    var currentUrl = '';
    var currentFormat = 'QR';

    // ---- Script loader ----
    function loadOne(url) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = url;
            s.async = true;
            s.onload = function () { resolve(url); };
            s.onerror = function () { reject(new Error('Failed: ' + url)); };
            document.head.appendChild(s);
        });
    }

    function loadWithFallback(urls, check) {
        var i = 0;
        function tryNext() {
            if (i >= urls.length) {
                return Promise.reject(new Error('All sources failed'));
            }
            var url = urls[i++];
            return loadOne(url).then(function () {
                if (check()) return url;
                throw new Error('Loaded but not exposed: ' + url);
            }).catch(function (err) {
                console.warn('[PeekABooCode] Loader:', err.message);
                return tryNext();
            });
        }
        return tryNext();
    }

    // ---- Local-first library loaders ----
    function loadQRCode() {
        if (window.QRCode) return Promise.resolve('inline');
        if (qrcodePromise) return qrcodePromise;

        qrcodePromise = loadOne('assets/lib/qrcode.min.js')
            .then(function () {
                if (!window.QRCode) throw new Error('QRCode not exposed');
                console.log('[PeekABooCode] QRCode loaded from local');
                return 'local';
            })
            .catch(function () {
                return loadWithFallback(QRCODE_CDNS, function () { return !!window.QRCode; })
                    .then(function (used) {
                        console.log('[PeekABooCode] QRCode loaded from CDN:', used);
                        return used;
                    });
            })
            .catch(function () {
                qrcodePromise = null;
                throw new Error('Could not load QR library. Place qrcode.min.js in assets/lib/ or check your connection.');
            });

        return qrcodePromise;
    }

    function loadJsBarcode() {
        if (window.JsBarcode) return Promise.resolve('inline');
        if (jsbarcodePromise) return jsbarcodePromise;

        jsbarcodePromise = loadOne('assets/lib/JsBarcode.all.min.js')
            .then(function () {
                if (!window.JsBarcode) throw new Error('JsBarcode not exposed');
                console.log('[PeekABooCode] JsBarcode loaded from local');
                return 'local';
            })
            .catch(function () {
                return loadWithFallback(JSBARCODE_CDNS, function () { return !!window.JsBarcode; })
                    .then(function (used) {
                        console.log('[PeekABooCode] JsBarcode loaded from CDN:', used);
                        return used;
                    });
            })
            .catch(function () {
                jsbarcodePromise = null;
                throw new Error('Could not load barcode library. Place JsBarcode.all.min.js in assets/lib/ or check your connection.');
            });

        return jsbarcodePromise;
    }

    // ---- Modal construction ----
    function ensureModal() {
        if (modal) return modal;

        modal = document.createElement('div');
        modal.className = 'code-modal';
        modal.setAttribute('data-code-modal', '');
        modal.hidden = true;
        modal.innerHTML =
            '<div class="code-modal-backdrop" data-code-close></div>' +
            '<div class="code-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="code-modal-title">' +
            '<header class="code-modal-head">' +
            '<h2 id="code-modal-title" class="code-modal-title">Make a code</h2>' +
            '<button type="button" class="code-modal-close" data-code-close aria-label="Close">×</button>' +
            '</header>' +
            '<div class="code-modal-body">' +
            '<div class="code-modal-field">' +
            '<label for="code-format" class="code-modal-label">Format</label>' +
            '<select id="code-format" class="code-modal-select" data-code-format>' +
            '<option value="QR">QR code</option>' +
            '<option value="CODE128">Code 128 (alphanumeric)</option>' +
            '<option value="EAN13">EAN-13 (retail digits)</option>' +
            '</select>' +
            '</div>' +
            '<div class="code-modal-warning" data-code-warning hidden></div>' +
            '<div class="code-modal-preview">' +
            '<div class="code-modal-code-holder" data-code-holder></div>' +
            '<canvas class="code-modal-barcode-canvas" data-code-canvas hidden></canvas>' +
            '</div>' +
            '<div class="code-modal-error" data-code-error hidden></div>' +
            '<p class="code-modal-value" data-code-value></p>' +
            '</div>' +
            '<footer class="code-modal-actions">' +
            '<button type="button" class="btn btn-primary btn-sm" data-code-png>Download PNG</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-code-svg>Download SVG</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-code-close>Close</button>' +
            '</footer>' +
            '</div>';

        document.body.appendChild(modal);

        els.format = modal.querySelector('[data-code-format]');
        els.warning = modal.querySelector('[data-code-warning]');
        els.error = modal.querySelector('[data-code-error]');
        els.holder = modal.querySelector('[data-code-holder]');
        els.canvas = modal.querySelector('[data-code-canvas]');
        els.value = modal.querySelector('[data-code-value]');
        els.png = modal.querySelector('[data-code-png]');
        els.svg = modal.querySelector('[data-code-svg]');
        els.closes = modal.querySelectorAll('[data-code-close]');

        els.closes.forEach(function (el) {
            el.addEventListener('click', close);
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modal && !modal.hidden) close();
        });

        els.format.addEventListener('change', function () {
            currentFormat = els.format.value;
            renderPreview();
        });

        els.png.addEventListener('click', downloadPng);
        els.svg.addEventListener('click', downloadSvg);

        return modal;
    }

    // ---- Open / close ----
    function open(url) {
        ensureModal();
        currentUrl = String(url || '').trim();
        if (!currentUrl) return;

        currentFormat = /^\d{12,13}$/.test(currentUrl) ? 'EAN13' : 'QR';
        els.format.value = currentFormat;

        modal.hidden = false;
        document.body.classList.add('code-modal-open');

        setTimeout(function () {
            if (els.format) els.format.focus();
        }, 0);

        renderWarnings();
        renderPreview();
    }

    function close() {
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove('code-modal-open');
    }

    // ---- Warnings ----
    function renderWarnings() {
        var warnings = [];

        if (window.ThreatChecker && typeof window.ThreatChecker.analyze === 'function') {
            try {
                var analysis = window.ThreatChecker.analyze(currentUrl);
                if (analysis && analysis.verdict === 'suspicious') {
                    warnings.push({
                        level: 'danger',
                        text: 'This link is flagged as suspicious. Anyone who scans this code may be at risk.'
                    });
                }
            } catch (e) { /* ignore */ }
        }

        try {
            var u = new URL(currentUrl);
            var haystack = (u.pathname + u.search).toLowerCase();
            if (/token=|password=|passwd=|secret=|api[_-]?key=|auth=|session=/.test(haystack)) {
                warnings.push({
                    level: 'warn',
                    text: 'This link contains what looks like a token or password. Anyone who scans the code can open it.'
                });
            }
        } catch (e) { /* not a URL, no warning */ }

        if (!warnings.length) {
            els.warning.hidden = true;
            els.warning.innerHTML = '';
            return;
        }

        els.warning.hidden = false;
        els.warning.innerHTML = warnings.map(function (w) {
            return '<p class="code-modal-warning-line code-modal-warning-' +
                w.level + '">' + escapeHtml(w.text) + '</p>';
        }).join('');
    }

    // ---- Preview ----
    function renderPreview() {
        els.error.hidden = true;
        els.error.textContent = '';

        if (currentFormat === 'QR') {
            els.canvas.hidden = true;
            els.holder.hidden = false;
            renderQrPreview();
            return;
        }

        els.holder.hidden = true;
        els.canvas.hidden = false;
        renderBarcodePreview();
    }

    function renderQrPreview() {
        loadQRCode().then(function () {
            els.holder.innerHTML = '';
            // qrcodejs API: new QRCode(element, options)
            new window.QRCode(els.holder, {
                text: currentUrl,
                width: 260,
                height: 260,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: window.QRCode.CorrectLevel.M
            });
            els.value.textContent = currentUrl;
            els.png.disabled = false;
            els.svg.disabled = false;
        }).catch(function (err) {
            showError(err && err.message ? err.message : 'Could not generate QR code.');
        });
    }

    function renderBarcodePreview() {
        if (currentFormat === 'EAN13' && !/^\d{12,13}$/.test(currentUrl)) {
            showError('EAN-13 needs exactly 12 or 13 digits.');
            return;
        }
        if (currentFormat === 'CODE128' && !/^[\x00-\x7F]+$/.test(currentUrl)) {
            showError('Code 128 supports ASCII characters only.');
            return;
        }

        loadJsBarcode().then(function () {
            try {
                window.JsBarcode(els.canvas, currentUrl, {
                    format: currentFormat === 'EAN13' ? 'EAN13' : 'CODE128',
                    width: 2,
                    height: 90,
                    displayValue: true,
                    margin: 12,
                    background: '#ffffff',
                    lineColor: '#000000',
                    font: 'monospace',
                    fontSize: 16
                });
                els.value.textContent = currentUrl;
                els.png.disabled = false;
                els.svg.disabled = false;
            } catch (err) {
                showError(err && err.message ? err.message : 'Could not generate barcode.');
            }
        }).catch(function (err) {
            showError(err && err.message ? err.message : 'Could not load barcode library.');
        });
    }

    function showError(msg) {
        els.error.hidden = false;
        els.error.textContent = msg;
        els.png.disabled = true;
        els.svg.disabled = true;
    }

    // ---- Downloads ----
    function downloadPng() {
        if (els.png.disabled) return;

        try {
            if (currentFormat === 'QR') {
                var qrCanvas = els.holder.querySelector('canvas');
                var qrImg = els.holder.querySelector('img');
                if (qrCanvas) {
                    triggerDownload(qrCanvas.toDataURL('image/png'), 'peekaboocode.png');
                } else if (qrImg) {
                    triggerDownload(qrImg.src, 'peekaboocode.png');
                } else {
                    showError('QR image not ready yet.');
                }
            } else {
                triggerDownload(els.canvas.toDataURL('image/png'), 'peekaboocode.png');
            }
        } catch (e) {
            showError('Could not export PNG.');
        }
    }

    function downloadSvg() {
        if (els.svg.disabled) return;

        if (currentFormat === 'QR') {
            try {
                var qrCanvas = els.holder.querySelector('canvas');
                if (qrCanvas) {
                    var dataUrl = qrCanvas.toDataURL('image/png');
                    var svgWrap =
                        '<svg xmlns="http://www.w3.org/2000/svg" ' +
                        'xmlns:xlink="http://www.w3.org/1999/xlink" ' +
                        'width="260" height="260" viewBox="0 0 260 260">' +
                        '<image width="260" height="260" xlink:href="' + dataUrl + '"/>' +
                        '</svg>';
                    var blob = new Blob([svgWrap], { type: 'image/svg+xml;charset=utf-8' });
                    var url = URL.createObjectURL(blob);
                    triggerDownload(url, 'peekaboocode.svg');
                    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
                } else {
                    showError('QR image not ready yet.');
                }
            } catch (e) {
                showError('Could not export SVG.');
            }
            return;
        }

        var svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        try {
            window.JsBarcode(svgEl, currentUrl, {
                format: currentFormat === 'EAN13' ? 'EAN13' : 'CODE128',
                displayValue: true,
                margin: 12,
                background: '#ffffff',
                lineColor: '#000000',
                font: 'monospace',
                fontSize: 16
            });
        } catch (e) {
            showError('Could not export SVG.');
            return;
        }

        var xml = new XMLSerializer().serializeToString(svgEl);
        var blob2 = new Blob(
            ['<?xml version="1.0" encoding="UTF-8"?>\n' + xml],
            { type: 'image/svg+xml;charset=utf-8' }
        );
        var url2 = URL.createObjectURL(blob2);
        triggerDownload(url2, 'peekaboocode.svg');
        setTimeout(function () { URL.revokeObjectURL(url2); }, 2000);
    }

    function triggerDownload(href, filename) {
        var a = document.createElement('a');
        a.href = href;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ---- Public API ----
    window.CodeGenerator = {
        open: open
    };
})();