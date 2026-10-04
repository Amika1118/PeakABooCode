/* ============================================
   bot/bot.js - Peek bot chat UI.
   - real conversation: small talk, follow-ups, typing indicator
   - learns: teach in chat, thumbs-up/down, "did you mean",
     and implicit learning from rephrased questions
   - chat history + learned knowledge persist locally
   - passive help nudges (failed clean / scan / camera)
   ============================================ */
(function () {
    'use strict';

    var HISTORY_KEY = 'history';
    var HISTORY_MAX = 40;
    var reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var els = {};
    var lastIntent = null;
    var lastMiss = null;          // {text, turn} - unanswered question, for implicit learning
    var turn = 0;
    var pending = null;           // conversational state: offer-teach | teach-question | teach-answer | confirm-reset
    var queue = Promise.resolve();
    var history = [];
    var langPref = 'auto';        // 'auto' | 'en' | 'si'
    var sessionSignals = { failedClean: 0, failedScan: 0, deniedCamera: 0, nudged: {}, errorAt: 0 };
    var idleTimer = null;
    var unreadCount = 0;

    var SVG_ATTR = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    var ICON_CHAT = '<svg class="bot-fab-icon" ' + SVG_ATTR + '><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
    var ICON_CLOSE = '<svg class="bot-fab-icon" ' + SVG_ATTR + '><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    var ICON_X = '<svg ' + SVG_ATTR + ' width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    var ICON_BRAIN = '<svg ' + SVG_ATTR + ' width="16" height="16"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M12 5v13"/></svg>';
    var ICON_SEND = '<svg ' + SVG_ATTR + ' width="18" height="18"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

    // ---- Init ----
    function init() {
        if (!window.BotEngine || !window.BotStorage) {
            console.warn('[Peek bot] not started. Missing: ' +
                (!window.BotStorage ? 'js/bot/storage.js ' : '') +
                (!window.BotEngine ? 'js/bot/engine.js' : '') +
                ' (check the files exist at those paths and the script tags load, see the Network tab)');
            return;
        }
        langPref = window.BotStorage.get('lang', 'auto');
        history = window.BotStorage.get(HISTORY_KEY, []);
        window.BotEngine.load().catch(function () { }).then(function () {
            buildUI();
            wireGlobalSignals();
            startIdleWatch();
        });
    }

    // ---- UI construction ----
    function buildUI() {
        els.fab = document.createElement('button');
        els.fab.type = 'button';
        els.fab.className = 'bot-fab';
        els.fab.setAttribute('aria-label', 'Open help chat');
        els.fab.setAttribute('aria-expanded', 'false');
        els.fab.addEventListener('click', togglePanel);
        document.body.appendChild(els.fab);
        setFabIcon(false);

        els.panel = document.createElement('aside');
        els.panel.className = 'bot-panel';
        els.panel.hidden = true;
        els.panel.setAttribute('aria-label', 'Help chat');
        els.panel.innerHTML =
            '<header class="bot-panel-head">' +
            '<div class="bot-panel-head-left">' +
            '<span class="bot-panel-avatar" aria-hidden="true">🤖</span>' +
            '<div class="bot-panel-title-wrap">' +
            '<span class="bot-panel-title">Peek bot</span>' +
            '<span class="bot-panel-status">Online · learns on this device</span>' +
            '</div></div>' +
            '<div class="bot-panel-head-actions">' +
            '<button type="button" class="bot-lang" data-bot-lang></button>' +
            '<button type="button" class="bot-icon-btn" data-bot-memory aria-label="What I\'ve learned" title="What I\'ve learned">' + ICON_BRAIN + '</button>' +
            '<button type="button" class="bot-icon-btn" data-bot-close aria-label="Close chat">' + ICON_X + '</button>' +
            '</div></header>' +
            '<div class="bot-panel-body" data-bot-body>' +
            '<div class="bot-messages" data-bot-messages role="log" aria-live="polite"></div>' +
            '</div>' +
            '<section class="bot-memory" data-bot-memory-view hidden aria-label="What the bot has learned"></section>' +
            '<form class="bot-panel-input" data-bot-form autocomplete="off">' +
            '<input type="text" class="bot-input" data-bot-input maxlength="400" ' +
            'placeholder="Ask anything, English or Singlish…" aria-label="Message the bot">' +
            '<button type="submit" class="bot-send" aria-label="Send">' + ICON_SEND + '</button>' +
            '</form>';
        document.body.appendChild(els.panel);

        els.body = els.panel.querySelector('[data-bot-body]');
        els.messages = els.panel.querySelector('[data-bot-messages]');
        els.input = els.panel.querySelector('[data-bot-input]');
        els.form = els.panel.querySelector('[data-bot-form]');
        els.langBtn = els.panel.querySelector('[data-bot-lang]');
        els.memory = els.panel.querySelector('[data-bot-memory-view]');

        els.form.addEventListener('submit', onSubmit);
        els.panel.querySelector('[data-bot-close]').addEventListener('click', togglePanel);
        els.panel.querySelector('[data-bot-memory]').addEventListener('click', toggleMemory);
        els.langBtn.addEventListener('click', cycleLang);
        updateLangBtn();

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !els.panel.hidden) togglePanel();
        });

        // Common-question chips need the help sections, which load async.
        document.addEventListener('help:loaded', refreshStarterChips);

        restoreHistory();
    }

    function setFabIcon(open) {
        els.fab.innerHTML = (open ? ICON_CLOSE : ICON_CHAT) +
            '<span class="bot-fab-badge" data-bot-badge hidden></span>';
        els.badge = els.fab.querySelector('[data-bot-badge]');
        if (!open && unreadCount) bumpBadge(true);
    }

    function togglePanel() {
        var open = els.panel.hidden;
        els.panel.hidden = !open;
        els.fab.setAttribute('aria-expanded', open ? 'true' : 'false');
        els.fab.setAttribute('aria-label', open ? 'Close help chat' : 'Open help chat');
        setFabIcon(open);
        if (open) {
            clearBadge();
            clearNudges();
            scrollDown();
            setTimeout(function () { els.input.focus(); }, 60);
        } else {
            hideMemory();
            els.fab.focus();
        }
    }

    function openPanel() {
        if (els.panel && els.panel.hidden) togglePanel();
    }

    function cycleLang() {
        var order = ['auto', 'en', 'si'];
        langPref = order[(order.indexOf(langPref) + 1) % order.length];
        window.BotStorage.set('lang', langPref);
        updateLangBtn();
    }

    function updateLangBtn() {
        els.langBtn.textContent = langPref === 'auto' ? 'Auto' : langPref.toUpperCase();
        els.langBtn.setAttribute('aria-label', 'Reply language: ' + langPref + '. Click to change.');
        els.langBtn.title = 'Reply language';
    }

    // ---- History ----
    function saveHistory() {
        if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
        window.BotStorage.set(HISTORY_KEY, history);
    }

    function restoreHistory() {
        if (!history.length) {
            greet();
            return;
        }
        history.forEach(function (m) {
            renderMessage(m.role, m.text, { readMoreSection: m.readMore, restored: true });
        });
        var note = document.createElement('div');
        note.className = 'bot-msg-system';
        note.textContent = 'Earlier conversation';
        els.messages.insertBefore(note, els.messages.firstChild);
        addChips(starterChips(), 'Common questions');
    }

    function clearChat() {
        history = [];
        lastIntent = null; lastMiss = null; pending = null;
        saveHistory();
        els.messages.innerHTML = '';
        greet();
    }

    function greet() {
        var n = window.BotEngine.stats();
        var extra = n.customQa ? ' I know ' + n.customQa + ' thing' + (n.customQa === 1 ? '' : 's') + ' you taught me.' : '';
        say('Hi! I\'m Peek bot. Ask me anything about the app, English or Singlish.' + extra, { instant: true });
        addChips(starterChips(), 'Try asking');
    }

    // ---- Rendering ----
    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

    // Tiny, safe formatter: **bold**, `code`, "- " bullets, line breaks.
    function format(text) {
        var lines = escapeHtml(text).split('\n');
        var out = '', inList = false;
        lines.forEach(function (line) {
            var m = /^\s*[-•]\s+(.*)$/.exec(line);
            if (m) {
                if (!inList) { out += '<ul>'; inList = true; }
                out += '<li>' + inline(m[1]) + '</li>';
            } else {
                if (inList) { out += '</ul>'; inList = false; }
                out += (out && !/<\/ul>$/.test(out) ? '<br>' : '') + inline(line);
            }
        });
        if (inList) out += '</ul>';
        return out;
    }
    function inline(s) {
        return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    function scrollDown() {
        if (els.body) els.body.scrollTop = els.body.scrollHeight;
    }

    function removeChips() {
        els.messages.querySelectorAll('.bot-chips, .bot-card').forEach(function (n) {
            n.parentNode.removeChild(n);
        });
    }

    function renderMessage(role, text, opts) {
        opts = opts || {};
        var wrap = document.createElement('div');
        wrap.className = 'bot-msg bot-msg-' + role;

        var body = document.createElement('div');
        body.className = 'bot-msg-body';
        body.innerHTML = format(text);
        wrap.appendChild(body);

        if (opts.readMoreSection) {
            var link = document.createElement('a');
            link.href = '#help/' + encodeURIComponent(opts.readMoreSection);
            link.className = 'bot-msg-link';
            link.textContent = 'Open the full help section';
            link.addEventListener('click', function () {
                if (window.HelpPage && window.HelpPage.openSection) window.HelpPage.openSection(opts.readMoreSection);
                if (window.matchMedia('(max-width: 560px)').matches) togglePanel();
            });
            wrap.appendChild(link);
        }

        if (opts.feedbackIntent) wrap.appendChild(buildFeedback(opts.feedbackIntent, opts.originalText));

        els.messages.appendChild(wrap);
        scrollDown();
        return wrap;
    }

    function buildFeedback(intentId, originalText) {
        var fb = document.createElement('div');
        fb.className = 'bot-msg-feedback';
        fb.innerHTML =
            '<button type="button" class="bot-fb-btn" data-up aria-label="Helpful">👍</button>' +
            '<button type="button" class="bot-fb-btn" data-down aria-label="Not helpful">👎</button>';
        fb.querySelector('[data-up]').addEventListener('click', function () {
            window.BotEngine.recordFeedback(intentId, true, originalText);
            fb.innerHTML = '<span class="bot-fb-done">Thanks, I\'ll remember that wording 🙌</span>';
        });
        fb.querySelector('[data-down]').addEventListener('click', function () {
            window.BotEngine.recordFeedback(intentId, false);
            fb.innerHTML = '<span class="bot-fb-note">Sorry about that.</span>';
            showCorrection(intentId, originalText);
        });
        return fb;
    }

    // Bot message with typing indicator, kept in order.
    function say(text, opts) {
        opts = opts || {};
        queue = queue.then(function () {
            return new Promise(function (resolve) {
                var instant = opts.instant || reduceMotion || els.panel.hidden;
                var finish = function (typingEl) {
                    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
                    renderMessage('bot', text, opts);
                    if (!opts.noSave) {
                        history.push({ role: 'bot', text: text, readMore: opts.readMoreSection || null });
                        saveHistory();
                    }
                    if (els.panel.hidden) bumpBadge();
                    resolve();
                };
                if (instant) return finish(null);
                var t = document.createElement('div');
                t.className = 'bot-msg bot-msg-bot bot-typing';
                t.innerHTML = '<div class="bot-msg-body" aria-label="Bot is typing"><span></span><span></span><span></span></div>';
                els.messages.appendChild(t);
                scrollDown();
                setTimeout(function () { finish(t); }, Math.min(320 + text.length * 6, 900));
            });
        });
        return queue;
    }

    function addChips(items, label) {
        queue = queue.then(function () {
            if (!items || !items.length) return;
            var box = document.createElement('div');
            box.className = 'bot-chips';
            if (label) {
                var l = document.createElement('p');
                l.className = 'bot-chips-label';
                l.textContent = label;
                box.appendChild(l);
            }
            items.forEach(function (it) {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'bot-chip' + (it.kind ? ' bot-chip-' + it.kind : '');
                b.textContent = it.label;
                b.addEventListener('click', function () { it.run(); });
                box.appendChild(b);
            });
            els.messages.appendChild(box);
            scrollDown();
        });
    }

    function starterChips() {
        var intents = window.BotEngine.getIntents().filter(function (i) { return i.source !== 'custom'; }).slice(0, 4);
        return intents.map(function (i) {
            return { label: i.title, run: function () { ask(i.title); } };
        });
    }

    function refreshStarterChips() {
        // Replace the starter chips only while they are the last thing shown.
        var last = els.messages && els.messages.lastElementChild;
        if (last && last.classList.contains('bot-chips') && /Try asking|Common questions/.test(last.textContent)) {
            els.messages.removeChild(last);
            addChips(starterChips(), 'Try asking');
        }
    }

    // ---- Input ----
    function onSubmit(e) {
        e.preventDefault();
        var text = (els.input.value || '').trim();
        if (!text) return;
        els.input.value = '';
        ask(text);
    }

    function ask(text) {
        removeChips();
        renderMessage('user', text);
        history.push({ role: 'user', text: text });
        saveHistory();
        turn++;
        respond(text);
    }

    function pickLang(text) {
        if (langPref !== 'auto') return langPref;
        return window.BotEngine.detectLanguage(text);
    }
    function answerFor(intent, lang) {
        return (lang === 'si' && intent.shortAnswerSi) ? intent.shortAnswerSi : intent.shortAnswer;
    }

    // ---- Conversation logic ----
    function respond(text) {
        var E = window.BotEngine;
        var lang = pickLang(text);

        if (pending && handlePending(text, lang)) return;
        pending = null;

        if (handleCommand(text)) return;

        var talk = E.smallTalk(text);
        if (talk) {
            say(lang === 'si' ? talk.replySi : talk.reply);
            return;
        }

        if (/^(more|tell me more|explain( more)?|go on|details?|elaborate|why)\W*$/i.test(text)) {
            if (lastIntent) {
                say(lastIntent.helpSection
                    ? 'Here\'s the full section on that.'
                    : 'That\'s all I have on it. You can teach me more if you like: **teach: question = answer**.',
                    { readMoreSection: lastIntent.helpSection || null });
            } else {
                say('More about what? Ask me a question first.');
            }
            return;
        }

        var c = E.classify(text);

        if (c.type === 'answer') {
            learnFromMiss(c.best);
            answerWith(c.best, text, lang, c.options);
        } else if (c.type === 'ambiguous') {
            say(lang === 'si' ? 'Meka dekakata hari yanawa. Mokakda oyata oni?' : 'A couple of things fit that. Which did you mean?');
            addChips(c.options.map(function (i) {
                return { label: i.title, run: function () { choose(i, text); } };
            }));
        } else if (c.type === 'weak') {
            say(lang === 'si' ? 'Hariyatama therune na. Methana thiyenne hodama ewa:' : 'I\'m not sure I got that. These are the closest I have:');
            var chips = c.options.map(function (i) {
                return { label: i.title, run: function () { choose(i, text); } };
            });
            chips.push({ label: 'Teach me this', kind: 'teach', run: function () { startTeach(text); } });
            addChips(chips);
            lastMiss = { text: text, turn: turn };
        } else {
            noIdea(text, lang);
        }
    }

    function answerWith(intent, text, lang, related) {
        lastIntent = intent;
        say(answerFor(intent, lang), {
            readMoreSection: intent.helpSection,
            feedbackIntent: intent.id,
            originalText: text
        });
        if (related && related.length) {
            addChips(related.map(function (i) {
                return { label: i.title, run: function () { ask(i.title); } };
            }), 'Related');
        }
    }

    // User picked one of the suggestions: answer it and learn the wording.
    function choose(intent, originalText) {
        removeChips();
        window.BotEngine.addPattern(intent.id, originalText, 0.25);
        lastMiss = null;
        answerWith(intent, originalText, pickLang(originalText), []);
    }

    // They rephrased after a miss and got an answer: the first wording means the same thing.
    function learnFromMiss(intent) {
        if (lastMiss && turn - lastMiss.turn <= 3) {
            window.BotEngine.addPattern(intent.id, lastMiss.text, 0.15);
        }
        lastMiss = null;
    }

    function noIdea(text, lang) {
        lastIntent = null;
        lastMiss = { text: text, turn: turn };
        pending = { type: 'offer-teach', question: text };
        say(lang === 'si'
            ? 'Mata meka thawama therenne na. Oyata mata ugannanna puluwan: **yes** kiyala answer eka liyanna.'
            : 'I don\'t know that one yet. Want to teach me? Reply **yes** and then type the answer, or just ask something else.');
        addChips([
            { label: 'Yes, teach you', kind: 'teach', run: function () { ask('yes'); } },
            { label: 'No thanks', run: function () { ask('no'); } }
        ]);
    }

    // ---- Teaching ----
    function startTeach(question) {
        removeChips();
        if (question) {
            pending = { type: 'teach-answer', question: question };
            say('What should I answer when someone asks:\n**' + question + '**\n(Type the answer, or say "cancel".)');
        } else {
            pending = { type: 'teach-question' };
            say('Sure. What question should I learn?');
        }
        if (els.input) els.input.focus();
    }

    function learnQa(q, a) {
        var id = window.BotEngine.addCustomQa(q, a);
        lastMiss = null;
        if (!id) { say('I need both a question and an answer to learn something.'); return; }
        say('Got it, I learned that. ✅ Try asking me again to check.', { noSave: false });
        addChips([{ label: q.length > 48 ? q.slice(0, 45) + '…' : q, run: function () { ask(q); } }], 'Test it');
    }

    // Returns true if the message was consumed by the pending flow.
    function handlePending(text, lang) {
        var E = window.BotEngine;
        var p = pending;

        if (p.type === 'offer-teach') {
            if (E.isYes(text)) { startTeach(p.question); return true; }
            if (E.isNo(text)) { pending = null; say('No problem. Ask me something else any time.'); return true; }
            return false; // a new question: drop the offer and answer it normally
        }
        if (p.type === 'teach-question') {
            if (E.isNo(text)) { pending = null; say('Okay, cancelled.'); return true; }
            startTeach(text);
            return true;
        }
        if (p.type === 'teach-answer') {
            if (E.isNo(text) || /^cancel\W*$/i.test(text)) { pending = null; say('Okay, I won\'t save that.'); return true; }
            pending = null;
            learnQa(p.question, text);
            return true;
        }
        if (p.type === 'confirm-reset') {
            pending = null;
            if (E.isYes(text)) {
                E.reset();
                say('Done. I\'ve forgotten everything I learned.');
            } else {
                say('Okay, I\'ll keep what I know.');
            }
            return true;
        }
        return false;
    }

    function handleCommand(text) {
        var m = /^\s*(?:teach|learn)\s*(?:me)?\s*[:\-]?\s*(.+?)\s*(?:=>|->|=|\|)\s*(.+)$/i.exec(text);
        if (m) { learnQa(m[1], m[2]); return true; }

        if (/^\s*(teach|learn)( me)?\W*$/i.test(text)) { startTeach(null); return true; }

        if (/^\s*(what (have|did) you learn(ed|t)?|what do you know|show (me )?(what you learned|memory|learned)|your memory|forget)\b/i.test(text)) {
            say('Here\'s what I\'ve learned so far.');
            setTimeout(showMemory, 300);
            return true;
        }
        if (/^\s*(clear|reset|wipe)\s+(the\s+)?(chat|conversation|history)\W*$/i.test(text)) {
            clearChat();
            return true;
        }
        if (/^\s*(reset|wipe|erase)\s+(your\s+)?(learning|memory|everything)\W*$/i.test(text)) {
            pending = { type: 'confirm-reset' };
            say('That deletes everything I learned (taught answers and corrections). Are you sure? Reply **yes** or **no**.');
            return true;
        }
        return false;
    }

    // ---- Correction flow (thumbs down) ----
    function showCorrection(intentId, originalText) {
        removeChips();
        var box = document.createElement('div');
        box.className = 'bot-card';
        box.innerHTML = '<p class="bot-card-title">What were you looking for?</p>' +
            '<div class="bot-card-list" data-list></div>' +
            '<div class="bot-card-actions">' +
            '<button type="button" class="bot-chip bot-chip-teach" data-teach>None of these, teach me</button>' +
            '<button type="button" class="bot-chip" data-cancel>Cancel</button></div>';

        var list = box.querySelector('[data-list]');
        window.BotEngine.getIntents().forEach(function (i) {
            if (i.id === intentId) return;
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'bot-card-option';
            b.textContent = i.title;
            b.addEventListener('click', function () {
                box.parentNode.removeChild(box);
                choose(i, originalText);
                say('Thanks, I\'ll connect those next time.', { noSave: true });
            });
            list.appendChild(b);
        });
        box.querySelector('[data-teach]').addEventListener('click', function () {
            box.parentNode.removeChild(box);
            startTeach(originalText);
        });
        box.querySelector('[data-cancel]').addEventListener('click', function () {
            box.parentNode.removeChild(box);
        });
        els.messages.appendChild(box);
        scrollDown();
    }

    // ---- "What I've learned" view ----
    function toggleMemory() {
        if (els.memory.hidden) showMemory(); else hideMemory();
    }
    function hideMemory() {
        if (els.memory) els.memory.hidden = true;
    }
    function showMemory() {
        openPanel();
        renderMemory();
        els.memory.hidden = false;
    }

    function renderMemory() {
        var E = window.BotEngine;
        var qa = E.getCustomQa();
        var patterns = E.getLearnedPatterns();
        var titles = {};
        E.getIntents().forEach(function (i) { titles[i.id] = i.title; });
        var s = E.stats();

        var html = '<div class="bot-memory-head"><h2>What I\'ve learned</h2>' +
            '<button type="button" class="bot-icon-btn" data-mem-back aria-label="Back to chat">' + ICON_X + '</button></div>' +
            '<p class="bot-memory-sub">' + s.customQa + ' taught answer' + (s.customQa === 1 ? '' : 's') + ', ' +
            s.patterns + ' learned phrase' + (s.patterns === 1 ? '' : 's') + '. Stored only in this browser.</p>';

        html += '<h3>Taught answers</h3>';
        if (!qa.length) html += '<p class="bot-memory-empty">Nothing yet. Say <strong>teach: question = answer</strong>.</p>';
        qa.forEach(function (item) {
            html += '<div class="bot-memory-item"><div><strong>' + escapeHtml(item.question) + '</strong>' +
                '<span>' + escapeHtml(item.answer) + '</span></div>' +
                '<button type="button" class="bot-memory-del" data-del-qa="' + escapeAttr(item.id) + '" aria-label="Forget this answer">Forget</button></div>';
        });

        var keys = Object.keys(patterns).filter(function (k) { return titles[k] && patterns[k].length; });
        html += '<h3>Phrases I connected to answers</h3>';
        if (!keys.length) html += '<p class="bot-memory-empty">None yet. Use 👍, 👎 or the suggestions and I\'ll pick them up.</p>';
        keys.forEach(function (k) {
            html += '<div class="bot-memory-group"><p>' + escapeHtml(titles[k]) + '</p>';
            patterns[k].forEach(function (p) {
                html += '<span class="bot-memory-phrase">' + escapeHtml(p) +
                    '<button type="button" data-del-pat="' + escapeAttr(k) + '" data-phrase="' + escapeAttr(p) + '" aria-label="Forget this phrase">×</button></span>';
            });
            html += '</div>';
        });

        html += '<div class="bot-memory-foot">' +
            '<button type="button" class="bot-chip" data-mem-clear>Clear chat</button>' +
            '<button type="button" class="bot-chip bot-chip-danger" data-mem-reset>Forget everything</button></div>';

        els.memory.innerHTML = html;

        els.memory.querySelector('[data-mem-back]').addEventListener('click', hideMemory);
        els.memory.querySelectorAll('[data-del-qa]').forEach(function (b) {
            b.addEventListener('click', function () { E.removeCustomQa(b.getAttribute('data-del-qa')); renderMemory(); });
        });
        els.memory.querySelectorAll('[data-del-pat]').forEach(function (b) {
            b.addEventListener('click', function () {
                E.removePattern(b.getAttribute('data-del-pat'), b.getAttribute('data-phrase'));
                renderMemory();
            });
        });
        els.memory.querySelector('[data-mem-clear]').addEventListener('click', function () { clearChat(); hideMemory(); });
        var resetBtn = els.memory.querySelector('[data-mem-reset]');
        resetBtn.addEventListener('click', function () {
            if (resetBtn.getAttribute('data-sure') !== '1') {
                resetBtn.setAttribute('data-sure', '1');
                resetBtn.textContent = 'Tap again to confirm';
                return;
            }
            E.reset();
            renderMemory();
        });
    }

    // ---- Global signals (nudges) ----
    function wireGlobalSignals() {
        document.addEventListener('bot:failed-clean', function () {
            sessionSignals.failedClean++; sessionSignals.errorAt = Date.now();
            maybeNudge('failed-clean', 'Link eka clean karanna help oni da?', 'link-cleaner');
        });
        document.addEventListener('bot:failed-scan', function () {
            sessionSignals.failedScan++; sessionSignals.errorAt = Date.now();
            maybeNudge('failed-scan', 'Code eka hari nadda? Help oni da?', 'qr-vs-barcode');
        });
        document.addEventListener('bot:denied-camera', function () {
            sessionSignals.deniedCamera++; sessionSignals.errorAt = Date.now();
            maybeNudge('denied-camera', 'Camera allow karanna help oni da?', 'call-test');
        });

        document.addEventListener('input', function (e) {
            var t = e.target;
            if (!t || !t.value || (t.closest && t.closest('.bot-panel'))) return;
            var v = t.value.trim().toLowerCase();
            if (v === '?' || v === 'help' || v === 'mokada' || v === 'kohomada') openPanel();
        });
    }

    function maybeNudge(key, message, sectionId) {
        if (sessionSignals.nudged[key]) return;
        var threshold = key === 'failed-clean' ? 3 : 2;
        var count = key === 'failed-clean' ? sessionSignals.failedClean
            : key === 'failed-scan' ? sessionSignals.failedScan : sessionSignals.deniedCamera;
        if (count < threshold) return;
        sessionSignals.nudged[key] = true;
        showNudge(message, sectionId);
    }

    function showNudge(message, sectionId) {
        if (!els.panel) return;
        if (els.panel.hidden) {
            var main = document.getElementById('main');
            if (main) {
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
                    var intent = window.BotEngine.getIntents().filter(function (i) { return i.id === sectionId; })[0];
                    if (intent) ask(intent.title);
                    if (nudge.parentNode) nudge.parentNode.removeChild(nudge);
                });
                nudge.querySelector('.bot-nudge-dismiss').addEventListener('click', function () {
                    if (nudge.parentNode) nudge.parentNode.removeChild(nudge);
                });
                main.insertBefore(nudge, main.firstChild);
            }
        }
        bumpBadge();
        els.fab.classList.add('has-news');
        addTabIndicator();
    }

    function addTabIndicator() {
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
        if (els.fab) els.fab.classList.remove('has-news');
    }

    // ---- Badge ----
    function bumpBadge(keep) {
        if (!keep) unreadCount++;
        if (!els.badge) return;
        els.badge.hidden = false;
        els.badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
    }
    function clearBadge() {
        unreadCount = 0;
        if (els.badge) els.badge.hidden = true;
    }

    // ---- Idle watch ----
    function startIdleWatch() {
        ['click', 'keydown', 'input'].forEach(function (ev) { document.addEventListener(ev, resetIdle); });
        resetIdle();
    }
    function resetIdle() {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(function () {
            if (!sessionSignals.errorAt || Date.now() - sessionSignals.errorAt > 120000) return;
            if (sessionSignals.nudged.idle) return;
            sessionSignals.nudged.idle = true;
            showNudge('Still stuck? I can help.', 'help-bot');
        }, 60000);
    }

    // ---- Bootstrap ----
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
