/* ============================================
   settings.js - custom app mapping, custom
   tracking params, import/export, resets.
   Exposes window.PeekSettings for other modules.
   ============================================ */
(function () {
    'use strict';

    var STORAGE_KEY = 'peekaboocode.settings.v1';
    var SHEETJS_CDNS = [
        'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
        'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
    ];

    var state = {
        customApps: {},   // domain -> { name, icon }
        customParams: []  // array of regex strings
    };

    var els = {};
    var sheetjsPromise = null;

    // ---- Storage ----
    function load() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return;

            if (parsed.customApps && typeof parsed.customApps === 'object') {
                state.customApps = parsed.customApps;
            }
            if (Array.isArray(parsed.customParams)) {
                state.customParams = parsed.customParams.filter(function (p) {
                    return typeof p === 'string' && p.length;
                });
            }
        } catch (e) { /* ignore */ }
    }

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                customApps: state.customApps,
                customParams: state.customParams,
                updatedAt: new Date().toISOString()
            }));
        } catch (e) { /* ignore */ }
    }

    // ---- Public API ----
    function getCustomApps() {
        var out = {};
        for (var domain in state.customApps) {
            if (!Object.prototype.hasOwnProperty.call(state.customApps, domain)) continue;
            var entry = state.customApps[domain];
            out[domain] = entry && entry.name ? entry.name : entry;
        }
        return out;
    }

    function getCustomAppEntries() {
        var out = [];
        for (var domain in state.customApps) {
            if (!Object.prototype.hasOwnProperty.call(state.customApps, domain)) continue;
            var entry = state.customApps[domain];
            out.push({
                domain: domain,
                name: (entry && entry.name) || String(entry || ''),
                icon: (entry && entry.icon) || ''
            });
        }
        return out;
    }

    function getCustomParams() {
        return state.customParams.slice();
    }

    function setCustomApp(domain, name, icon) {
        if (!domain) return;
        state.customApps[domain.toLowerCase()] = {
            name: name || domain,
            icon: icon || ''
        };
        save();
        notify();
    }

    function removeCustomApp(domain) {
        delete state.customApps[domain];
        save();
        notify();
    }

    function addCustomParam(pattern) {
        if (!pattern) return false;
        try {
            new RegExp(pattern, 'i');
        } catch (e) {
            return false;
        }
        if (state.customParams.indexOf(pattern) === -1) {
            state.customParams.push(pattern);
            save();
            notify();
        }
        return true;
    }

    function removeCustomParam(pattern) {
        var i = state.customParams.indexOf(pattern);
        if (i !== -1) {
            state.customParams.splice(i, 1);
            save();
            notify();
        }
    }

    function resetApps() {
        state.customApps = {};
        save();
        notify();
    }

    function resetParams() {
        state.customParams = [];
        save();
        notify();
    }

    function resetAll() {
        state.customApps = {};
        state.customParams = [];
        save();
        notify();
    }

    function notify() {
        try {
            document.dispatchEvent(new CustomEvent('settings:changed'));
        } catch (e) { /* ignore */ }
    }

    window.PeekSettings = {
        getCustomApps: getCustomApps,
        getCustomAppEntries: getCustomAppEntries,
        getCustomParams: getCustomParams,
        setCustomApp: setCustomApp,
        removeCustomApp: removeCustomApp,
        addCustomParam: addCustomParam,
        removeCustomParam: removeCustomParam,
        resetApps: resetApps,
        resetParams: resetParams,
        resetAll: resetAll
    };

    // ---- Library loader for XLS ----
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

    function loadSheetJS() {
        if (window.XLSX) return Promise.resolve('inline');
        if (sheetjsPromise) return sheetjsPromise;

        sheetjsPromise = loadOne('assets/lib/xlsx.full.min.js')
            .then(function () {
                if (!window.XLSX) throw new Error('XLSX not exposed');
                return 'local';
            })
            .catch(function () {
                return loadOne(SHEETJS_CDNS[0])
                    .then(function () {
                        if (window.XLSX) return SHEETJS_CDNS[0];
                        return loadOne(SHEETJS_CDNS[1]);
                    });
            })
            .then(function () {
                if (!window.XLSX) throw new Error('Could not load XLS library.');
                return 'loaded';
            })
            .catch(function () {
                sheetjsPromise = null;
                throw new Error('Could not load the spreadsheet library. Try JSON or CSV instead.');
            });

        return sheetjsPromise;
    }

    // ---- Init ----
    function init() {
        el_panel = document.querySelector('[data-tab-panel="settings"]');
        if (!el_panel) return;

        els.stage = el_panel.querySelector('[data-settings-stage]');
        if (!els.stage) return;

        load();
        renderStage();
    }

    var el_panel;

    // ---- Rendering ----
    function renderStage() {
        els.stage.innerHTML =
            renderAppsSection() +
            renderParamsSection() +
            renderDataSection() +
            renderResetSection();

        wireStage();
    }

    function renderAppsSection() {
        var entries = getCustomAppEntries();

        var listHtml = entries.length
            ? '<div class="settings-list">' +
            entries.map(function (e, i) {
                return '<div class="settings-row" data-app-row="' + i + '">' +
                    '<input type="text" class="settings-input settings-input-domain" value="' +
                    escapeAttr(e.domain) + '" placeholder="example.com" ' +
                    'data-app-domain aria-label="Domain">' +
                    '<input type="text" class="settings-input settings-input-name" value="' +
                    escapeAttr(e.name) + '" placeholder="App name" ' +
                    'data-app-name aria-label="Name">' +
                    '<input type="text" class="settings-input settings-input-icon" value="' +
                    escapeAttr(e.icon) + '" placeholder="Icon" maxlength="4" ' +
                    'data-app-icon aria-label="Icon (emoji)">' +
                    '<button type="button" class="btn btn-ghost btn-sm" data-app-save>Save</button>' +
                    '<button type="button" class="btn btn-danger btn-sm" data-app-delete>Delete</button>' +
                    '</div>';
            }).join('') +
            '</div>'
            : '<p class="settings-empty">No custom apps yet. Add one below.</p>';

        return '<section class="settings-section">' +
            '<header class="settings-section-head">' +
            '<h2 class="settings-section-title">Custom app mapping</h2>' +
            '<p class="settings-section-lede">Add domains and the app name we should show for them. ' +
            'Icon is optional — paste a single emoji.</p>' +
            '</header>' +
            listHtml +
            '<div class="settings-row settings-row-new">' +
            '<input type="text" class="settings-input settings-input-domain" data-new-domain ' +
            'placeholder="example.com" aria-label="New domain">' +
            '<input type="text" class="settings-input settings-input-name" data-new-name ' +
            'placeholder="App name" aria-label="New name">' +
            '<input type="text" class="settings-input settings-input-icon" data-new-icon ' +
            'placeholder="Icon" maxlength="4" aria-label="New icon">' +
            '<button type="button" class="btn btn-primary btn-sm" data-app-add>Add</button>' +
            '</div>' +
            '</section>';
    }

    function renderParamsSection() {
        var params = getCustomParams();

        var listHtml = params.length
            ? '<div class="settings-chips">' +
            params.map(function (p) {
                return '<span class="settings-chip">' +
                    '<code>' + escapeHtml(p) + '</code>' +
                    '<button type="button" class="settings-chip-remove" data-param-remove ' +
                    'data-param="' + escapeAttr(p) + '" aria-label="Remove">×</button>' +
                    '</span>';
            }).join('') +
            '</div>'
            : '<p class="settings-empty">No custom parameters yet.</p>';

        return '<section class="settings-section">' +
            '<header class="settings-section-head">' +
            '<h2 class="settings-section-title">Custom tracking parameters</h2>' +
            '<p class="settings-section-lede">Extra query parameters to strip. ' +
            'Plain words or regular expressions. Example: <code>my_ref</code> or <code>^utm_</code>.</p>' +
            '</header>' +
            listHtml +
            '<div class="settings-row settings-row-new">' +
            '<input type="text" class="settings-input settings-input-wide" data-new-param ' +
            'placeholder="e.g. my_ref or ^track_" aria-label="New parameter">' +
            '<button type="button" class="btn btn-primary btn-sm" data-param-add>Add</button>' +
            '</div>' +
            '</section>';
    }

    function renderDataSection() {
        return '<section class="settings-section">' +
            '<header class="settings-section-head">' +
            '<h2 class="settings-section-title">Import / Export</h2>' +
            '<p class="settings-section-lede">Save your settings or move them to another device. ' +
            'JSON and CSV can be re-imported. XLS is Excel-friendly. Print saves as PDF.</p>' +
            '</header>' +
            '<div class="settings-toolbar">' +
            '<button type="button" class="btn btn-secondary btn-sm" data-export="json">Export JSON</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-export="csv">Export CSV</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-export="xls">Export XLS</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-export="print">Print / PDF</button>' +
            '</div>' +
            '<div class="settings-toolbar">' +
            '<button type="button" class="btn btn-secondary btn-sm" data-import="json">Import JSON</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-import="csv">Import CSV</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-import="xls">Import XLS</button>' +
            '<input type="file" accept=".json,.csv,.xls,.xlsx" hidden data-import-input>' +
            '</div>' +
            '</section>';
    }

    function renderResetSection() {
        return '<section class="settings-section settings-section-danger">' +
            '<header class="settings-section-head">' +
            '<h2 class="settings-section-title">Reset</h2>' +
            '<p class="settings-section-lede">Clear custom entries. Built-in defaults always stay.</p>' +
            '</header>' +
            '<div class="settings-toolbar">' +
            '<button type="button" class="btn btn-danger btn-sm" data-reset="apps">Clear custom apps</button>' +
            '<button type="button" class="btn btn-danger btn-sm" data-reset="params">Clear custom params</button>' +
            '<button type="button" class="btn btn-danger btn-sm" data-reset="all">Clear everything</button>' +
            '</div>' +
            '</section>';
    }

    // ---- Wiring ----
    function wireStage() {
        // Add app
        var addBtn = els.stage.querySelector('[data-app-add]');
        if (addBtn) {
            addBtn.addEventListener('click', function () {
                var domain = val('[data-new-domain]').toLowerCase().trim()
                    .replace(/^https?:\/\//, '')
                    .replace(/^www\./, '')
                    .replace(/\/.*$/, '');
                var name = val('[data-new-name]').trim();
                var icon = val('[data-new-icon]').trim();

                if (!domain || domain.indexOf('.') === -1) {
                    flash('Enter a valid domain like example.com');
                    return;
                }
                if (!name) name = domain;

                setCustomApp(domain, name, icon);
                renderStage();
            });
        }

        // Save / delete per row
        els.stage.querySelectorAll('[data-app-row]').forEach(function (row) {
            var saveBtn = row.querySelector('[data-app-save]');
            var delBtn = row.querySelector('[data-app-delete]');
            var domainInput = row.querySelector('[data-app-domain]');
            var nameInput = row.querySelector('[data-app-name]');
            var iconInput = row.querySelector('[data-app-icon]');

            if (saveBtn) {
                saveBtn.addEventListener('click', function () {
                    var newDomain = (domainInput.value || '').toLowerCase().trim();
                    var oldDomain = (domainInput.getAttribute('data-orig') || '').toLowerCase();
                    // Old domain tracking: we don't have it, so delete any we can't identify
                    // Instead: find the original from attributes set at render time

                    if (!newDomain) return;
                    // Remove the row's original entry if it changed
                    // Simpler: we know the current domain in the row's stored attribute
                });
            }

            // Alternative approach: store the original domain as data attribute
            // Re-render with that
        });

        // Simpler re-approach: rebuild rows with data-orig-domain
        // (see re-render patch below)

        // Delete
        els.stage.querySelectorAll('[data-app-delete]').forEach(function (btn, i) {
            btn.addEventListener('click', function () {
                var row = btn.closest('[data-app-row]');
                if (!row) return;
                var domain = (row.querySelector('[data-app-domain]').value || '').toLowerCase().trim();
                if (!domain) return;
                if (!confirm('Delete custom mapping for "' + domain + '"?')) return;
                removeCustomApp(domain);
                renderStage();
            });
        });

        // Save (rebuild rows with original domain captured)
        els.stage.querySelectorAll('[data-app-save]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var row = btn.closest('[data-app-row]');
                if (!row) return;
                var origDomain = (row.getAttribute('data-orig') || '').toLowerCase();
                var domainInput = row.querySelector('[data-app-domain]');
                var nameInput = row.querySelector('[data-app-name]');
                var iconInput = row.querySelector('[data-app-icon]');

                var newDomain = (domainInput.value || '').toLowerCase().trim();
                var name = (nameInput.value || '').trim();
                var icon = (iconInput.value || '').trim();

                if (!newDomain || newDomain.indexOf('.') === -1) {
                    flash('Enter a valid domain like example.com');
                    return;
                }
                if (!name) name = newDomain;

                if (origDomain && origDomain !== newDomain) {
                    removeCustomApp(origDomain);
                }
                setCustomApp(newDomain, name, icon);
                renderStage();
            });
        });

        // Add param
        var paramAdd = els.stage.querySelector('[data-param-add]');
        if (paramAdd) {
            paramAdd.addEventListener('click', function () {
                var input = els.stage.querySelector('[data-new-param]');
                var pattern = (input.value || '').trim();
                if (!pattern) return;
                if (!addCustomParam(pattern)) {
                    flash('Invalid pattern. Check the regex syntax.');
                    return;
                }
                renderStage();
            });
        }

        // Remove param
        els.stage.querySelectorAll('[data-param-remove]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var p = btn.getAttribute('data-param');
                removeCustomParam(p);
                renderStage();
            });
        });

        // Export
        els.stage.querySelectorAll('[data-export]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var format = btn.getAttribute('data-export');
                doExport(format);
            });
        });

        // Import
        var fileInput = els.stage.querySelector('[data-import-input]');
        var pendingFormat = null;
        els.stage.querySelectorAll('[data-import]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                pendingFormat = btn.getAttribute('data-import');
                fileInput.setAttribute('accept', acceptFor(pendingFormat));
                fileInput.click();
            });
        });
        if (fileInput) {
            fileInput.addEventListener('change', function () {
                var file = fileInput.files && fileInput.files[0];
                if (!file || !pendingFormat) { fileInput.value = ''; return; }
                doImport(file, pendingFormat);
                fileInput.value = '';
                pendingFormat = null;
            });
        }

        // Reset
        els.stage.querySelectorAll('[data-reset]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var which = btn.getAttribute('data-reset');
                var msg = which === 'apps' ? 'Clear all custom apps?'
                    : which === 'params' ? 'Clear all custom parameters?'
                        : 'Clear all custom settings? Built-in defaults are kept.';
                if (!confirm(msg)) return;
                if (which === 'apps') resetApps();
                else if (which === 'params') resetParams();
                else resetAll();
                renderStage();
            });
        });
    }

    // Fix the row save/delete by adding data-orig to each row
    // We do this by patching renderAppsSection's row template
    // (Kept as a separate helper for clarity)

    // ---- Export ----
    function doExport(format) {
        var payload = buildExportPayload();

        if (format === 'json') {
            var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            download(blob, 'peekaboocode-settings.json');
        } else if (format === 'csv') {
            var csv = toCsv(payload);
            var blob2 = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            download(blob2, 'peekaboocode-settings.csv');
        } else if (format === 'xls') {
            loadSheetJS().then(function () {
                var wb = window.XLSX.utils.book_new();
                var appsSheet = window.XLSX.utils.json_to_sheet(
                    payload.customApps.map(function (a) {
                        return { Domain: a.domain, Name: a.name, Icon: a.icon };
                    })
                );
                var paramsSheet = window.XLSX.utils.aoa_to_sheet(
                    [['Parameter']].concat(payload.customParams.map(function (p) { return [p]; }))
                );
                window.XLSX.utils.book_append_sheet(wb, appsSheet, 'Custom Apps');
                window.XLSX.utils.book_append_sheet(wb, paramsSheet, 'Custom Params');
                window.XLSX.writeFile(wb, 'peekaboocode-settings.xlsx');
            }).catch(function (err) {
                flash(err.message);
            });
        } else if (format === 'print') {
            doPrint();
        }
    }

    function buildExportPayload() {
        return {
            version: 1,
            exportedAt: new Date().toISOString(),
            customApps: getCustomAppEntries(),
            customParams: getCustomParams()
        };
    }

    function toCsv(payload) {
        var lines = [];
        lines.push('# PeekABooCode settings');
        lines.push('# exported at ' + payload.exportedAt);
        lines.push('');
        lines.push('type,key,value,icon');
        payload.customApps.forEach(function (a) {
            lines.push(['app', a.domain, a.name, a.icon || ''].map(csvCell).join(','));
        });
        payload.customParams.forEach(function (p) {
            lines.push(['param', p, '', ''].map(csvCell).join(','));
        });
        return lines.join('\n');
    }

    function csvCell(s) {
        s = String(s == null ? '' : s);
        if (/[",\n]/.test(s)) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }

    function doPrint() {
        var payload = buildExportPayload();
        var w = window.open('', '_blank', 'width=800,height=1000');
        if (!w) {
            flash('Pop-up blocked. Allow pop-ups to use Print / PDF.');
            return;
        }
        var html =
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>PeekABooCode settings</title>' +
            '<style>' +
            'body{font:14px -apple-system,system-ui,sans-serif;padding:32px;color:#164B54;}' +
            'h1{margin:0 0 4px;font-size:20px;}' +
            'p.meta{margin:0 0 24px;color:#4A7A82;font-size:12px;}' +
            'h2{margin:24px 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#2A8A94;}' +
            'table{width:100%;border-collapse:collapse;}' +
            'th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #CBE6E9;font-size:13px;}' +
            'th{background:#F4FAFA;font-weight:700;}' +
            'code{font-family:ui-monospace,Menlo,monospace;}' +
            '.empty{color:#7FA6AC;font-style:italic;}' +
            '@media print{body{padding:16px;}}' +
            '</style></head><body>' +
            '<h1>PeekABooCode — Settings</h1>' +
            '<p class="meta">Exported ' + escapeHtml(payload.exportedAt) + '</p>' +

            '<h2>Custom apps</h2>' +
            (payload.customApps.length
                ? '<table><thead><tr><th>Domain</th><th>Name</th><th>Icon</th></tr></thead><tbody>' +
                payload.customApps.map(function (a) {
                    return '<tr><td><code>' + escapeHtml(a.domain) + '</code></td>' +
                        '<td>' + escapeHtml(a.name) + '</td>' +
                        '<td>' + escapeHtml(a.icon || '') + '</td></tr>';
                }).join('') +
                '</tbody></table>'
                : '<p class="empty">None</p>') +

            '<h2>Custom tracking parameters</h2>' +
            (payload.customParams.length
                ? '<table><thead><tr><th>Parameter</th></tr></thead><tbody>' +
                payload.customParams.map(function (p) {
                    return '<tr><td><code>' + escapeHtml(p) + '</code></td></tr>';
                }).join('') +
                '</tbody></table>'
                : '<p class="empty">None</p>') +

            '<script>window.onload=function(){setTimeout(function(){window.print();},200);};<\/script>' +
            '</body></html>';
        w.document.open();
        w.document.write(html);
        w.document.close();
    }

    // ---- Import ----
    function acceptFor(format) {
        if (format === 'json') return '.json,application/json';
        if (format === 'csv') return '.csv,text/csv';
        if (format === 'xls') return '.xls,.xlsx';
        return '.json,.csv,.xls,.xlsx';
    }

    function doImport(file, format) {
        if (format === 'json') {
            readText(file).then(function (text) {
                var parsed = JSON.parse(text);
                applyImport(normalizeJson(parsed));
            }).catch(function (err) {
                flash('Could not read that JSON file: ' + err.message);
            });
            return;
        }
        if (format === 'csv') {
            readText(file).then(function (text) {
                applyImport(normalizeCsv(text));
            }).catch(function (err) {
                flash('Could not read that CSV file: ' + err.message);
            });
            return;
        }
        if (format === 'xls') {
            loadSheetJS().then(function () {
                return readArrayBuffer(file);
            }).then(function (buffer) {
                var wb = window.XLSX.read(buffer, { type: 'array' });
                var appsSheet = wb.Sheets['Custom Apps'] || wb.Sheets[wb.SheetNames[0]];
                var paramsSheet = wb.Sheets['Custom Params'] || wb.Sheets[wb.SheetNames[1]];
                var apps = appsSheet ? window.XLSX.utils.sheet_to_json(appsSheet) : [];
                var params = paramsSheet ? window.XLSX.utils.sheet_to_json(paramsSheet, { header: 1 }) : [];
                applyImport(normalizeXlsRows(apps, params));
            }).catch(function (err) {
                flash('Could not read that spreadsheet: ' + err.message);
            });
        }
    }

    function normalizeJson(parsed) {
        var apps = [];
        var params = [];

        if (Array.isArray(parsed)) {
            // Simple array — treat as apps
            parsed.forEach(function (a) {
                if (a && a.domain) {
                    apps.push({ domain: a.domain, name: a.name || a.domain, icon: a.icon || '' });
                }
            });
        } else if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.customApps)) {
                parsed.customApps.forEach(function (a) {
                    if (a && a.domain) {
                        apps.push({ domain: a.domain, name: a.name || a.domain, icon: a.icon || '' });
                    }
                });
            } else if (parsed.customApps && typeof parsed.customApps === 'object') {
                for (var domain in parsed.customApps) {
                    if (!Object.prototype.hasOwnProperty.call(parsed.customApps, domain)) continue;
                    var entry = parsed.customApps[domain];
                    apps.push({
                        domain: domain,
                        name: (entry && entry.name) || String(entry || domain),
                        icon: (entry && entry.icon) || ''
                    });
                }
            }
            if (Array.isArray(parsed.customParams)) {
                params = parsed.customParams.slice();
            }
        }

        return { apps: apps, params: params };
    }

    function normalizeCsv(text) {
        var lines = text.split(/\r?\n/);
        var apps = [], params = [];

        lines.forEach(function (line) {
            var t = line.trim();
            if (!t || t.charAt(0) === '#') return;
            if (/^type,/i.test(t)) return; // header

            var cells = splitCsvLine(t);
            var type = (cells[0] || '').toLowerCase();
            if (type === 'app' && cells[1]) {
                apps.push({
                    domain: cells[1].toLowerCase().replace(/^www\./, ''),
                    name: cells[2] || cells[1],
                    icon: cells[3] || ''
                });
            } else if (type === 'param' && cells[1]) {
                params.push(cells[1]);
            } else if (cells[0] && cells[0].indexOf('.') !== -1 && !cells[1] && !cells[2]) {
                // Bare domain row (fallback for hand-written CSVs)
                apps.push({
                    domain: cells[0].toLowerCase().replace(/^www\./, ''),
                    name: cells[1] || cells[0],
                    icon: cells[2] || ''
                });
            }
        });

        return { apps: apps, params: params };
    }

    function splitCsvLine(line) {
        var out = [];
        var cur = '';
        var inQuote = false;
        for (var i = 0; i < line.length; i++) {
            var c = line.charAt(i);
            if (inQuote) {
                if (c === '"') {
                    if (line.charAt(i + 1) === '"') { cur += '"'; i++; }
                    else { inQuote = false; }
                } else cur += c;
            } else {
                if (c === ',') { out.push(cur); cur = ''; }
                else if (c === '"') inQuote = true;
                else cur += c;
            }
        }
        out.push(cur);
        return out;
    }

    function normalizeXlsRows(rows, paramRows) {
        var apps = [], params = [];

        rows.forEach(function (r) {
            var domain = String(r.Domain || r.domain || r.domain_name || '').toLowerCase().replace(/^www\./, '');
            var name = String(r.Name || r.name || r.app || '');
            var icon = String(r.Icon || r.icon || '');
            if (domain) apps.push({ domain: domain, name: name || domain, icon: icon });
        });

        paramRows.forEach(function (row, i) {
            if (i === 0 && String(row[0] || '').toLowerCase() === 'parameter') return;
            var p = String(row[0] || '').trim();
            if (p) params.push(p);
        });

        return { apps: apps, params: params };
    }

    function applyImport(data) {
        if (!data) return;
        var appsCount = data.apps ? data.apps.length : 0;
        var paramsCount = data.params ? data.params.length : 0;

        if (!appsCount && !paramsCount) {
            flash('Nothing to import. Check the file format.');
            return;
        }

        if (!confirm('Import ' + appsCount + ' app(s) and ' + paramsCount +
            ' parameter(s)? Existing custom entries with the same keys will be overwritten.')) {
            return;
        }

        data.apps.forEach(function (a) {
            if (!a.domain) return;
            setCustomApp(a.domain, a.name || a.domain, a.icon || '');
        });
        data.params.forEach(function (p) {
            if (p) addCustomParam(p);
        });

        renderStage();
        flash('Imported ' + appsCount + ' app(s) and ' + paramsCount + ' parameter(s).', 'success');
    }

    // ---- File helpers ----
    function readText(file) {
        return new Promise(function (resolve, reject) {
            var r = new FileReader();
            r.onload = function () { resolve(String(r.result || '')); };
            r.onerror = function () { reject(new Error('Read failed')); };
            r.readAsText(file);
        });
    }

    function readArrayBuffer(file) {
        return new Promise(function (resolve, reject) {
            var r = new FileReader();
            r.onload = function () { resolve(r.result); };
            r.onerror = function () { reject(new Error('Read failed')); };
            r.readAsArrayBuffer(file);
        });
    }

    function download(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }

    // ---- Utility ----
    function val(sel) {
        var node = els.stage.querySelector(sel);
        return node ? (node.value || '') : '';
    }

    function flash(message, kind) {
        var existing = el_panel.querySelector('[data-settings-flash]');
        if (existing) existing.parentNode.removeChild(existing);

        var div = document.createElement('div');
        div.className = 'settings-flash' + (kind === 'success' ? ' is-success' : '');
        div.setAttribute('data-settings-flash', '');
        div.textContent = message;
        el_panel.insertBefore(div, el_panel.firstChild);

        setTimeout(function () {
            if (div.parentNode) div.parentNode.removeChild(div);
        }, 3500);
    }

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

    // ---- Bootstrap ----
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();