/* ============================================
   scan.js - decode QR codes and barcodes from
   image upload or live camera.
   Routes by format + content:
   - 2D (QR etc.) + URL   -> link flow
   - 2D + text/WiFi/vCard -> copy only
   - 1D barcode + number  -> copy + search
   - 1D barcode + URL     -> link flow
   ============================================ */
(function () {
    'use strict';

    var ZXING_URL = 'https://unpkg.com/@zxing/library@0.20.0/umd/index.min.js';
    var zxingPromise = null;

    var FORMAT_NAMES = {
        0: 'Aztec',
        1: 'Codabar',
        2: 'Code 39',
        3: 'Code 93',
        4: 'Code 128',
        5: 'Data Matrix',
        6: 'EAN-8',
        7: 'EAN-13',
        8: 'ITF',
        9: 'MaxiCode',
        10: 'PDF417',
        11: 'QR code',
        12: 'RSS-14',
        13: 'RSS Expanded',
        14: 'UPC-A',
        15: 'UPC-E',
        16: 'UPC/EAN Extension'
    };

    var TWO_D = [0, 5, 9, 10, 11];

    var els = {};
    var cameraState = null;

    // ---- Init ----
    function init() {
        els.form = document.querySelector('[data-clean-form]');
        els.input = document.querySelector('[data-clean-input]');
        els.result = document.querySelector('[data-clean-result]');
        els.panel = document.querySelector('[data-clean-drop]');
        els.uploadBtn = document.querySelector('[data-scan-upload]');
        els.fileInput = document.querySelector('[data-scan-input]');
        els.cameraBtn = document.querySelector('[data-scan-camera]');

        if (!els.form || !els.input || !els.result) return;

        if (els.uploadBtn && els.fileInput) {
            els.uploadBtn.addEventListener('click', function () {
                els.fileInput.click();
            });
            els.fileInput.addEventListener('change', function (e) {
                var file = e.target.files && e.target.files[0];
                if (file) handleFile(file);
                els.fileInput.value = '';
            });
        }

        if (els.cameraBtn) {
            els.cameraBtn.addEventListener('click', onCameraClick);
        }

        if (els.panel) {
            els.panel.addEventListener('dragover', onDragOver);
            els.panel.addEventListener('dragleave', onDragLeave);
            els.panel.addEventListener('drop', onDrop);
        }
    }

    // ---- Lazy load ZXing ----
    function loadZXing() {
        if (zxingPromise) return zxingPromise;
        zxingPromise = new Promise(function (resolve, reject) {
            if (window.ZXing && window.ZXing.BrowserMultiFormatReader) {
                resolve(window.ZXing);
                return;
            }
            var s = document.createElement('script');
            s.src = ZXING_URL;
            s.async = true;
            s.onload = function () {
                if (window.ZXing && window.ZXing.BrowserMultiFormatReader) {
                    resolve(window.ZXing);
                } else {
                    reject(new Error('Scanner library loaded but missing components.'));
                }
            };
            s.onerror = function () {
                reject(new Error('Could not load the scanning library. Check your connection.'));
            };
            document.head.appendChild(s);
        });
        return zxingPromise;
    }

    // ---- File handling ----
    function handleFile(file) {
        if (!/^image\//.test(file.type)) {
            renderError('That file is not an image.');
            return;
        }
        var reader = new FileReader();
        reader.onload = function () {
            decodeImageUrl(reader.result);
        };
        reader.onerror = function () {
            renderError('Could not read that image.');
        };
        reader.readAsDataURL(file);
    }

    function onDragOver(e) {
        if (!e.dataTransfer) return;
        if (e.dataTransfer.types && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') === -1) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        els.panel.classList.add('is-dragover');
    }

    function onDragLeave(e) {
        if (!els.panel.contains(e.relatedTarget)) {
            els.panel.classList.remove('is-dragover');
        }
    }

    function onDrop(e) {
        if (!e.dataTransfer) return;
        e.preventDefault();
        els.panel.classList.remove('is-dragover');
        var file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) handleFile(file);
    }

    // ---- Image decode ----
    function decodeImageUrl(dataUrl) {
        renderSpinner('Reading code...');

        loadZXing().then(function (ZXing) {
            var reader = new ZXing.BrowserMultiFormatReader();
            return reader.decodeFromImageUrl(dataUrl).then(function (result) {
                onDecoded({
                    text: result.getText(),
                    format: result.getBarcodeFormat()
                });
            });
        }).catch(function (e) {
            if (e && (e.name === 'NotFoundException' ||
                e.name === 'ChecksumException' ||
                e.name === 'FormatException')) {
                renderError('No code detected in this image.');
            } else {
                renderError(e && e.message ? e.message : 'Could not decode this image.');
            }
        });
    }

    // ---- Camera decode ----
    function onCameraClick() {
        renderCameraConsent();
    }

    function renderCameraConsent() {
        els.result.hidden = false;
        els.result.innerHTML =
            '<div class="scan-consent">' +
            '<div class="scan-consent-icon" aria-hidden="true">📷</div>' +
            '<div class="scan-consent-text">' +
            '<h3>Use your camera?</h3>' +
            '<p>We use your camera only to scan a code. Nothing is recorded, saved, or uploaded.</p>' +
            '</div>' +
            '<div class="scan-consent-actions">' +
            '<button type="button" class="btn btn-primary btn-sm" data-consent-allow>Allow camera</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-consent-cancel>Cancel</button>' +
            '</div>' +
            '</div>';

        var allowBtn = els.result.querySelector('[data-consent-allow]');
        var cancelBtn = els.result.querySelector('[data-consent-cancel]');
        if (allowBtn) allowBtn.addEventListener('click', startCameraScan);
        if (cancelBtn) cancelBtn.addEventListener('click', clearResult);
    }

    function startCameraScan() {
        renderCameraLoading();

        loadZXing().then(function (ZXing) {
            var videoEl = els.result.querySelector('[data-scan-video]');
            var overlay = els.result.querySelector('[data-scan-overlay]');
            var stopBtn = els.result.querySelector('[data-scan-stop]');
            if (!videoEl) return;

            var reader = new ZXing.BrowserMultiFormatReader();
            cameraState = {
                reader: reader,
                controls: null,
                videoEl: videoEl
            };

            if (stopBtn) {
                stopBtn.addEventListener('click', function () {
                    stopCameraScan();
                    clearResult();
                });
            }

            reader.decodeFromVideoDevice(null, videoEl, function (result) {
                if (result) {
                    var text = result.getText();
                    var format = result.getBarcodeFormat();
                    stopCameraScan();
                    onDecoded({ text: text, format: format });
                }
            }).then(function (controls) {
                if (cameraState) cameraState.controls = controls;
                if (overlay) overlay.hidden = true;
            }).catch(function (e) {
                stopCameraScan();
                if (e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) {
                    renderError('Camera permission was denied. Allow it in your browser settings and try again.');
                } else if (e && (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError')) {
                    renderError('No camera found on this device.');
                } else {
                    renderError(e && e.message ? e.message : 'Could not start the camera.');
                }
            });
        }).catch(function (e) {
            renderError(e && e.message ? e.message : 'Could not load the scanner.');
        });
    }

    function renderCameraLoading() {
        els.result.hidden = false;
        els.result.innerHTML =
            '<div class="scan-camera">' +
            '<div class="scan-video-wrap">' +
            '<video data-scan-video playsinline muted></video>' +
            '<div class="scan-overlay" data-scan-overlay>' +
            '<span class="spinner spinner-lg"></span>' +
            '<p>Starting camera...</p>' +
            '</div>' +
            '</div>' +
            '<div class="scan-camera-actions">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-scan-stop>Stop</button>' +
            '</div>' +
            '</div>';
    }

    function stopCameraScan() {
        if (!cameraState) return;
        var state = cameraState;
        cameraState = null;

        if (state.controls && typeof state.controls.stop === 'function') {
            try { state.controls.stop(); } catch (e) { }
        }
        if (state.reader && typeof state.reader.reset === 'function') {
            try { state.reader.reset(); } catch (e) { }
        }
        if (state.videoEl && state.videoEl.srcObject) {
            try {
                state.videoEl.srcObject.getTracks().forEach(function (t) { t.stop(); });
            } catch (e) { }
            state.videoEl.srcObject = null;
        }
    }

    // ---- Result handling ----
    function onDecoded(payload) {
        var text = (payload.text || '').trim();
        var format = payload.format;
        var formatName = FORMAT_NAMES[format] || 'Code';
        var is2D = TWO_D.indexOf(format) !== -1;

        if (!text) {
            renderError('The code was empty.');
            return;
        }

        var parsed = tryParseUrl(text);

        if (parsed) {
            renderLinkPreview(formatName, parsed);
        } else if (is2D) {
            renderTextPreview(formatName, text);
        } else {
            renderCodePreview(formatName, text);
        }
    }

    function tryParseUrl(text) {
        if (window.LinkCleaner && typeof window.LinkCleaner.parse === 'function') {
            var parsed = window.LinkCleaner.parse(text);
            if (parsed && parsed.url) return parsed;
        }
        try {
            var u = new URL(text);
            if (u.protocol === 'http:' || u.protocol === 'https:') {
                return { url: u };
            }
        } catch (e) { }
        return null;
    }

    function renderLinkPreview(formatName, parsed) {
        var normalized = parsed.url.toString();
        var domain = parsed.url.hostname.replace(/^www\./, '');
        var source = null;
        if (window.LinkCleaner && typeof window.LinkCleaner.getSource === 'function') {
            source = window.LinkCleaner.getSource(parsed.url);
        }
        var sourceLabel = source ? source.name : domain;
        var iconHtml = window.Icons ? window.Icons.get(source ? source.name : null, domain) : '';

        els.result.hidden = false;
        els.result.innerHTML =
            '<article class="scan-card">' +
            '<header class="scan-card-head">' +
            '<span class="scan-format">' + escapeHtml(formatName) + '</span>' +
            '<span class="scan-badge">Link</span>' +
            '</header>' +
            '<section class="scan-block">' +
            '<h3 class="scan-block-title">Decoded</h3>' +
            '<code class="scan-value">' + escapeHtml(normalized) + '</code>' +
            '</section>' +
            '<section class="scan-block scan-source-block">' +
            iconHtml +
            '<div class="scan-source-text">' +
            '<span class="scan-source-label">Source</span>' +
            '<span class="scan-source-name">' + escapeHtml(sourceLabel) + '</span>' +
            '</div>' +
            '</section>' +
            '<div class="scan-actions-row">' +
            '<button type="button" class="btn btn-primary btn-sm" data-scan-clean>Clean this link</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-scan-copy>Copy</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-scan-discard>Discard</button>' +
            '</div>' +
            '</article>';

        var cleanBtn = els.result.querySelector('[data-scan-clean]');
        var copyBtn = els.result.querySelector('[data-scan-copy]');
        var discardBtn = els.result.querySelector('[data-scan-discard]');

        if (cleanBtn) {
            cleanBtn.addEventListener('click', function () {
                if (window.LinkCleaner && typeof window.LinkCleaner.submit === 'function') {
                    window.LinkCleaner.submit(normalized);
                } else {
                    els.input.value = normalized;
                    els.form.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            });
        }
        if (copyBtn) {
            copyBtn.addEventListener('click', function () {
                copyToClipboard(normalized).then(function (ok) {
                    setCopyState(copyBtn, ok ? 'Copied' : 'Press Ctrl+C');
                });
            });
        }
        if (discardBtn) {
            discardBtn.addEventListener('click', clearResult);
        }
    }

    function renderTextPreview(formatName, text) {
        els.result.hidden = false;
        els.result.innerHTML =
            '<article class="scan-card">' +
            '<header class="scan-card-head">' +
            '<span class="scan-format">' + escapeHtml(formatName) + '</span>' +
            '<span class="scan-badge scan-badge-neutral">Not a link</span>' +
            '</header>' +
            '<section class="scan-block">' +
            '<h3 class="scan-block-title">Decoded</h3>' +
            '<code class="scan-value scan-value-wrap">' + escapeHtml(text) + '</code>' +
            '</section>' +
            '<p class="scan-note">This code doesn\'t contain a link.</p>' +
            '<div class="scan-actions-row">' +
            '<button type="button" class="btn btn-secondary btn-sm" data-scan-copy>Copy text</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-scan-discard>Discard</button>' +
            '</div>' +
            '</article>';

        var copyBtn = els.result.querySelector('[data-scan-copy]');
        var discardBtn = els.result.querySelector('[data-scan-discard]');
        if (copyBtn) {
            copyBtn.addEventListener('click', function () {
                copyToClipboard(text).then(function (ok) {
                    setCopyState(copyBtn, ok ? 'Copied' : 'Press Ctrl+C');
                });
            });
        }
        if (discardBtn) {
            discardBtn.addEventListener('click', clearResult);
        }
    }

    function renderCodePreview(formatName, text) {
        els.result.hidden = false;
        els.result.innerHTML =
            '<article class="scan-card">' +
            '<header class="scan-card-head">' +
            '<span class="scan-format">' + escapeHtml(formatName) + '</span>' +
            '<span class="scan-badge scan-badge-neutral">Code</span>' +
            '</header>' +
            '<section class="scan-block">' +
            '<h3 class="scan-block-title">Decoded</h3>' +
            '<code class="scan-value">' + escapeHtml(text) + '</code>' +
            '</section>' +
            '<p class="scan-note">This is a product code, not a link.</p>' +
            '<div class="scan-actions-row">' +
            '<button type="button" class="btn btn-secondary btn-sm" data-scan-copy>Copy value</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-scan-search>Search this code</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-scan-discard>Discard</button>' +
            '</div>' +
            '</article>';

        var copyBtn = els.result.querySelector('[data-scan-copy]');
        var searchBtn = els.result.querySelector('[data-scan-search]');
        var discardBtn = els.result.querySelector('[data-scan-discard]');

        if (copyBtn) {
            copyBtn.addEventListener('click', function () {
                copyToClipboard(text).then(function (ok) {
                    setCopyState(copyBtn, ok ? 'Copied' : 'Press Ctrl+C');
                });
            });
        }
        if (searchBtn) {
            searchBtn.addEventListener('click', function () {
                window.open(
                    'https://duckduckgo.com/?q=' + encodeURIComponent(text),
                    '_blank',
                    'noopener'
                );
            });
        }
        if (discardBtn) {
            discardBtn.addEventListener('click', clearResult);
        }
    }

    // ---- Utilities ----
    function renderSpinner(message) {
        els.result.hidden = false;
        els.result.innerHTML =
            '<div class="scan-loading">' +
            '<span class="spinner"></span>' +
            '<span>' + escapeHtml(message) + '</span>' +
            '</div>';
    }

    function renderError(message) {
        els.result.hidden = false;
        els.result.innerHTML =
            '<div class="clean-error" role="alert">' +
            '<span class="clean-error-icon" aria-hidden="true">⚠</span>' +
            '<span>' + escapeHtml(message) + '</span>' +
            '</div>';
    }

    function clearResult() {
        els.result.hidden = true;
        els.result.innerHTML = '';
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).then(function () {
                return true;
            }).catch(function () { return fallbackCopy(text); });
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
        } catch (e) { return false; }
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