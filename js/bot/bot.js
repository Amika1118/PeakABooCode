/* ============================================
   bot/bot.js - Help bot UI, feedback, passive
   help detection, nudges.
   ============================================ */
(function () {
    'use strict';

    var els = {};
    var lastIntent = null;
    var langPref = 'auto';       // 'auto' | 'en' | 'si'
    var sessionSignals = {
        failedClean: 0,
        failedScan: 0,
        deniedCamera: 0,
        nudged: {},
        errorAt: 0
    };
    var idleTimer = null;

    // ---- Init ----
    function init() {
        if (!window.BotEngine || !window.BotStorage) return;

        window.BotEngine.load().then(function () {
            buildUI();
            wireGlobalSignals();
            startIdleWatch();
        });
    }

    // ---- UI construction ----
    function buildUI() {
        // Floating button
        els.fab = document.createElement('button');
        els.fab.type = 'button';
        els.fab.className = 'bot-fab';
        els.fab.setAttribute('aria-label', 'Open help bot');
        els.fab.setAttribute('aria-expanded', 'false');
        els.fab.innerHTML = '<span aria-hidden="true">💬</span>';
        els.fab.addEventListener('click', togglePanel);
        document.body.appendChild(els.fab);

        // Panel
        els.panel = document.createElement('aside');
        els.panel.className = 'bot-panel';
        els.panel.hidden = true;
        els.panel.setAttribute('aria-label', 'Help bot');
        els.panel.innerHTML =
            '<header class="bot-panel-head">' +
                '<span class="bot-panel-title">Help bot</span>' +
                '<div class="bot-panel-head-actions">' +
                    '<button type="button" class="bot-lang" data-bot-lang aria-label="Language">Auto</button>' +
                    '<button type="button" class="bot-close" data-bot-close aria-label="Close">×</button>' +
                '</div>' +
            '</header>' +
            '<div class="bot-panel-body" data-bot-body>' +
                '<div class="bot-messages" data-bot-messages></div>' +
                '<div class="bot-suggested" data-bot-suggested></div>' +
            '</div>' +
            '<form class="bot-panel-input" data-bot-form>' +
                '<input type="text" class="bot-input" data-bot-input placeholder="Ask me anything..." ' +
                    'aria-label="Ask the bot">' +
                '<button type="submit" class="btn btn-primary btn-sm" data-bot-send>Send</button>' +
            '</form>';
        document.body.appendChild(els.panel);

        els.messages = els.panel.querySelector('[data-bot-messages]');
        els.suggested = els.panel.querySelector('[data-bot-suggested]');
        els.input = els.panel.querySelector('[data-bot-input]');
        els.form = els.panel.querySelector('[data-bot-form]');
        els.langBtn = els.panel.querySelector('[data-bot-lang]');

        els.form.addEventListener('submit', onSubmit);
        els.panel.querySelector('[data-bot-close]').addEventListener('click', togglePanel);
        els.langBtn.addEventListener('click', cycleLang);

        // Escape closes
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !els.panel.hidden) togglePanel();
        });

        renderSuggested();
    }

    function togglePanel() {
        var open = els.panel.hidden;
        els.panel.hidden = !open;
        els.fab.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
            setTimeout(function () { els.input.focus(); }, 0);
            clearNudges();
        }
    }

    function openPanel() {
        if (els.panel && els.panel.hidden) togglePanel();
    }

    function cycleLang() {
        var order = ['auto', 'en', 'si'];
        var i = order.indexOf(langPref);
        langPref = order[(i + 1) % order.length];
        els.langBtn.textContent = langPref === 'auto' ? 'Auto' : langPref.toUpperCase();
        els.langBtn.setAttribute('aria-label', 'Language: ' + langPref);
    }

    // ---- Message rendering ----
    function addMessage(role, text, opts) {
        opts = opts || {};
        var wrap = document.createElement('div');
        wrap.className = 'bot-msg bot-msg-' + role;

        var body = document.createElement('div');
        body.className = 'bot-msg-body';
        body.textContent = text;
        wrap.appendChild(body);

        if (opts.readMoreSection) {
            var link = document.createElement('a');
            link.href = '#help/' + encodeURIComponent(opts.readMoreSection);
            link.className = 'bot-msg-link';
            link.textContent = 'Read more';
            link.addEventListener('click', function () {
                if (window.HelpPage && window.HelpPage.openSection) {
                    window.HelpPage.openSection(opts.readMoreSection);
                }
                if (els.panel) els.panel.hidden = true;
            });
            wrap.appendChild(link);
        }

        if (opts.feedbackIntent) {
            var fb = document.createElement('div');
            fb.className = 'bot-msg-feedback';
            var up = document.createElement('button');
            up.type = 'button';
            up.className = 'bot-fb-btn';
            up.setAttribute('aria-label', 'Helpful');
            up.textContent = '👍';
            up.addEventListener('click', function () {
                window.BotEngine.recordFeedback(opts.feedbackIntent, true);
                fb.innerHTML = '<span class="bot-fb-done">Thanks! 🙌</span>';
            });
            var down = document.createElement('button');
            down.type = 'button';
            down.className = 'bot-fb-btn';
            down.setAttribute('aria-label', 'Not helpful');
            down.textContent = '👎';
            down.addEventListener('click', function () {
                window.BotEngine.recordFeedback(opts.feedbackIntent, false);
                fb.innerHTML = '';
                renderCorrectionFlow(opts.feedbackIntent, opts.originalText);
            });
            fb.appendChild(up);
            fb.appendChild(down);
            wrap.appendChild(fb);
        }

        els.messages.appendChild(wrap);
        els.messages.scrollTop = els.messages.scrollHeight;
    }

    function addSystemMessage(text) {
        var wrap = document.createElement('div');
        wrap.className = 'bot-msg bot-msg-system';
        wrap.textContent = text;
        els.messages.appendChild(wrap);
        els.messages.scrollTop = els.messages.scrollHeight;
    }

    // ---- Submit ----
    function onSubmit(e) {
        e.preventDefault();
        var text = (els.input.value || '').trim();
        if (!text) return;
        els.input.value = '';
        handleQuestion(text);
    }

    function handleQuestion(text) {
        addMessage('user', text);

        var intent = window.BotEngine.match(text);
        if (!intent) {
            lastIntent = null;
            var lang = pickLang(text);
            var fallback = lang === 'si'
                ? 'Mata meka therenne na. Oyata help karanna puluwanda?'
                : "I don't understand that yet. Want to add it as a new question?";
            addMessage('bot', fallback);

            // Suggest a few sections
            renderFallbackSuggestions();
            // Offer "add this question"
            renderSuggestQuestion(text);
            return;
        }

        lastIntent = intent;
        var lang2 = pickLang(text);
        var answer = (lang2 === 'si' && intent.shortAnswerSi)
            ? intent.shortAnswerSi
            : intent.shortAnswer;

        addMessage('bot', answer, {
            readMoreSection: intent.helpSection,
            feedbackIntent: intent.id,
            originalText: text
        });
    }

    function pickLang(text) {
        if (langPref === 'en') return 'en';
        if (langPref === 'si') return 'si';
        return window.BotEngine.detectLanguage(text);
    }

    // ---- Corrections ----
    function renderCorrectionFlow(intentId, originalText) {
        var box = document.createElement('div');
        box.className = 'bot-correction';
        box.innerHTML =
            '<p class="bot-correction-q">Mokakda hoyanne? (What were you looking for?)</p>' +
            '<div class="bot-correction-list" data-bot-correct-list></div>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-bot-cancel>Cancel</button>';

        var list = box.querySelector('[data-bot-correct-list]');
        var intents = window.BotEngine.getIntents().filter(function (i) {
            return i.source === 'help';
        });

        intents.forEach(function (i) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'bot-correction-option';
            b.textContent = i.title;
            b.addEventListener('click', function () {
                window.BotEngine.addPattern(i.id, originalText);
                box.innerHTML = '<span class="bot-fb-done">Learned! I\'ll remember that next time.</span>';
                setTimeout(function () {
                    if (box.parentNode) box.parentNode.removeChild(box);
                }, 1600);
            });
            list.appendChild(b);
        });

        box.querySelector('[data-bot-cancel]').addEventListener('click', function () {
            box.parentNode.removeChild(box);
        });

        els.messages.appendChild(box);
        els.messages.scrollTop = els.messages.scrollHeight;
    }

    function renderFallbackSuggestions() {
        var suggestions = ['link-cleaner', 'qr-vs-barcode', 'call-test', 'privacy'];
        var intents = window.BotEngine.getIntents();
        var html = '<p class="bot-suggested-label">Maybe this helps:</p>';
        suggestions.forEach(function (id) {
            var match = intents.filter(function (i) { return i.id === id; })[0];
            if (!match) return;
            html += '<button type="button" class="bot-suggested-btn" data-bot-suggest="' +
                escapeAttr(match.title) + '">' + escapeHtml(match.title) + '</button>';
        });

        var box = document.createElement('div');
        box.className = 'bot-suggested-inline';
        box.innerHTML = html;
        box.querySelectorAll('[data-bot-suggest]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                handleQuestion(btn.getAttribute('data-bot-suggest'));
            });
        });
        els.messages.appendChild(box);
        els.messages.scrollTop = els.messages.scrollHeight;
    }

    function renderSuggestQuestion(originalText) {
        var box = document.createElement('div');
        box.className = 'bot-suggest-q';
        box.innerHTML =
            '<p class="bot-correction-q">Want to add this as a question?</p>' +
            '<input type="text" class="bot-input" data-new-q value="' + escapeAttr(originalText) + '" ' +
                'placeholder="Question" aria-label="Question">' +
            '<input type="text" class="bot-input" data-new-a placeholder="Answer" aria-label="Answer">' +
            '<div class="bot-suggest-q-actions">' +
                '<button type="button" class="btn btn-primary btn-sm" data-bot-add>Add</button>' +
                '<button type="button" class="btn btn-ghost btn-sm" data-bot-cancel>Cancel</button>' +
            '</div>';

        box.querySelector('[data-bot-add]').addEventListener('click', function () {
            var q = box.querySelector('[data-new-q]').value.trim();
            var a = box.querySelector('[data-new-a]').value.trim();
            if (!q || !a) return;
            window.BotEngine.addCustomQa(q, a);
            box.innerHTML = '<span class="bot-fb-done">Got it. I\'ll answer that next time.</span>';
            setTimeout(function () {
                if (box.parentNode) box.parentNode.removeChild(box);
            }, 1600);
        });

        box.querySelector('[data-bot-cancel]').addEventListener('click', function () {
            box.parentNode.removeChild(box);
        });

        els.messages.appendChild(box);
        els.messages.scrollTop = els.messages.scrollHeight;
    }

    // ---- Suggested questions on open ----
    function renderSuggested() {
        var intents = window.BotEngine.getIntents().filter(function (i) {
            return i.source === 'help';
        }).slice(0, 4);

        var html = '<p class="bot-suggested-label">Common questions</p>';
        intents.forEach(function (i) {
            html += '<button type="button" class="bot-suggested-btn" data-bot-ask="' +
                escapeAttr(i.title) + '">' + escapeHtml(i.title) + '</button>';
        });
        els.suggested.innerHTML = html;

        els.suggested.querySelectorAll('[data-bot-ask]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                handleQuestion(btn.getAttribute('data-bot-ask'));
            });
        });
    }

    // ---- Global signals (from other modules) ----
    function wireGlobalSignals() {
        document.addEventListener('bot:failed-clean', function () {
            sessionSignals.failedClean++;
            sessionSignals.errorAt = Date.now();
            maybeNudge('failed-clean', 'Link eka clean karanna help oni da?', 'link-cleaner');
        });
        document.addEventListener('bot:failed-scan', function () {
            sessionSignals.failedScan++;
            sessionSignals.errorAt = Date.now();
            maybeNudge('failed-scan', 'Code eka hari nadda? Help oni da?', 'qr-vs-barcode');
        });
        document.addEventListener('bot:denied-camera', function () {
            sessionSignals.deniedCamera++;
            sessionSignals.errorAt = Date.now();
            maybeNudge('denied-camera', 'Camera allow karanna help oni da?', 'call-test');
        });

        // Direct asks in any input
        document.addEventListener('input', function (e) {
            var t = e.target;
            if (!t || !t.value) return;
            if (t.closest && t.closest('.bot-panel')) return;
            var v = t.value.trim().toLowerCase();
            if (v === '?' || v === 'help' || v === 'mokada' || v === 'kohomada') {
                openPanel();
            }
        });
    }

    function maybeNudge(key, message, sectionId) {
        if (sessionSignals.nudged[key]) return;

        var threshold = key === 'failed-clean' ? 3
            : key === 'failed-scan' ? 2
            : key === 'denied-camera' ? 2
            : 1;

        var count = key === 'failed-clean' ? sessionSignals.failedClean
            : key === 'failed-scan' ? sessionSignals.failedScan
            : sessionSignals.deniedCamera;

        if (count < threshold) return;
        sessionSignals.nudged[key] = true;

        showNudge(message, sectionId);
    }

    function showNudge(message, sectionId) {
        // Inline nudge in the current panel
        var main = document.getElementById('main');
        if (!main) return;

        var existing = main.querySelector('[data-bot-nudge]');
        if (existing) existing.parentNode.removeChild(existing);

        var nudge = document.createElement('div');
        nudge.className = 'bot-nudge';
        nudge.setAttribute('data-bot-nudge', '');
        nudge.innerHTML =
            '<span class="bot-nudge-text">' + escapeHtml(message) + '</span>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-nudge-help>Get help</button>' +
            '<button type="button" class="bot-nudge-dismiss" aria-label="Dismiss">×</button>';

        nudge.querySelector('[data-nudge-help]').addEventListener('click', function () {
            openPanel();
            var intent = window.BotEngine.getIntents().filter(function (i) {
                return i.id === sectionId;
            })[0];
            if (intent) handleQuestion(intent.title);
            nudge.parentNode.removeChild(nudge);
        });
        nudge.querySelector('.bot-nudge-dismiss').addEventListener('click', function () {
            nudge.parentNode.removeChild(nudge);
        });

        main.insertBefore(nudge, main.firstChild);

        // Tab indicator
        addTabIndicator(sectionId);
    }

    function addTabIndicator(sectionId) {
        var helpLink = document.querySelector('[data-tab-link="help"]');
        if (helpLink && !helpLink.querySelector('[data-nudge-dot]')) {
            var dot = document.createElement('span');
            dot.className = 'bot-nudge-dot';
            dot.setAttribute('data-nudge-dot', '');
            dot.setAttribute('aria-hidden', 'true');
            helpLink.appendChild(dot);
        }
    }

    function clearNudges() {
        var nudge = document.querySelector('[data-bot-nudge]');
        if (nudge && nudge.parentNode) nudge.parentNode.removeChild(nudge);
        var dot = document.querySelector('[data-nudge-dot]');
        if (dot && dot.parentNode) dot.parentNode.removeChild(dot);
    }

    // ---- Idle watch ----
    function startIdleWatch() {
        document.addEventListener('click', resetIdle);
        document.addEventListener('keydown', resetIdle);
        document.addEventListener('input', resetIdle);
        resetIdle();
    }

    function resetIdle() {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(function () {
            // Only nudge if there was a recent error and no nudge yet
            if (!sessionSignals.errorAt) return;
            if (Date.now() - sessionSignals.errorAt > 120000) return;
            if (sessionSignals.nudged['idle']) return;
            sessionSignals.nudged['idle'] = true;
            showNudge('Still stuck? I can help.', 'help-bot');
        }, 60000);
    }

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

    // ---- Bootstrap ----
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();