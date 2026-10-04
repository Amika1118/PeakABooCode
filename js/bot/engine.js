/* ============================================
   bot/engine.js - matching, small talk, learning.
   Knowledge = built-in FAQ + help-content.json
   (via HelpPage) + user-taught Q&A. Everything the
   bot learns is stored locally via BotStorage.
   ============================================ */
(function () {
    'use strict';

    var SINGLISH_URL = 'data/singlish.json';
    var CONFIDENT = 1.6;      // answer straight away
    var WEAK = 0.7;           // "closest I have" suggestions
    var AMBIGUOUS_RATIO = 0.8; // runner-up this close => ask which one
    var WEIGHT_MIN = 0.1;
    var WEIGHT_MAX = 10;
    var MAX_PATTERNS = 25;    // learned phrases per intent
    var MAX_CUSTOM = 100;

    var singlish = { words: {}, phrases: {} };
    var singlishLoaded = false;
    var singlishPromise = null;

    // Built-in answers so the bot can chat even before (or without)
    // help-content.json. A help section with the same id overrides these.
    var BUILTIN = [
        {
            id: 'link-cleaner', title: 'How do I clean a link?',
            keywords: ['clean', 'link', 'url', 'tracker', 'tracking', 'utm', 'strip', 'paste', 'share'],
            shortAnswer: 'Paste any link into the Clean tab and press Clean. I strip tracking parameters (like utm_source) and show where the link really goes.',
            shortAnswerSi: 'Clean tab eke link eka paste karala Clean press karanna. Tracking parts ain karala link eka kohedda yanne kiyala pennanawa.'
        },
        {
            id: 'qr-vs-barcode', title: 'Can I scan a QR code or barcode?',
            keywords: ['scan', 'qr', 'barcode', 'code', 'image', 'upload', 'camera', 'photo'],
            shortAnswer: 'Yes. On the Clean tab use Upload image or Use camera, or drop a QR / barcode picture onto the panel. Nothing leaves your device.',
            shortAnswerSi: 'Puluwan. Clean tab eke Upload image ho Use camera use karanna, nathnam QR eka drop karanna.'
        },
        {
            id: 'call-test', title: 'How do I test my camera and mic?',
            keywords: ['test', 'camera', 'mic', 'microphone', 'speaker', 'webcam', 'audio', 'call', 'permission', 'allow'],
            shortAnswer: 'Open the Test tab and follow the steps. If the browser asks, allow camera and microphone access. If you blocked it earlier, click the lock icon in the address bar to allow it again.',
            shortAnswerSi: 'Test tab eka open karala steps follow karanna. Browser eka ahuwoth camera/mic allow karanna.'
        },
        {
            id: 'privacy', title: 'Is my data private?',
            keywords: ['privacy', 'private', 'data', 'safe', 'secure', 'upload', 'server', 'backend', 'store', 'track'],
            shortAnswer: 'Yes. Everything runs in your browser and there is no backend. Settings, and anything I learn, stay on your device.',
            shortAnswerSi: 'Ow. Okkoma oyage browser eke thamai wada karanne. Server ekak nehe.'
        },
        {
            id: 'help-bot', title: 'What can this bot do?',
            keywords: ['bot', 'chat', 'assistant', 'learn', 'teach', 'remember'],
            shortAnswer: 'I answer questions about PeekABooCode, and I learn. Teach me new answers, correct me with the thumbs-down, and I will remember on this device.',
            shortAnswerSi: 'Mama app eka gana ahanna puluwan. Mata nawa dewal ugannanna puluwan.'
        },
        {
            id: 'theme', title: 'How do I change the theme?',
            keywords: ['theme', 'dark', 'light', 'mode', 'system', 'color'],
            shortAnswer: 'Use the theme button (sun / moon / monitor). It cycles through light, dark and system.',
            shortAnswerSi: 'Theme button eka click karanna. Light, dark, system kiyala marenawa.'
        },
        {
            id: 'settings', title: 'What can I change in Settings?',
            keywords: ['settings', 'custom', 'mapping', 'import', 'export', 'reset', 'parameter', 'param'],
            shortAnswer: 'Settings lets you add custom app mappings and tracking parameters, import / export them, and reset everything. All of it is stored locally.',
            shortAnswerSi: 'Settings eken custom mapping, tracking params add karanna, import/export karanna, reset karanna puluwan.'
        }
    ];

    var STOP = {};
    ('a an the is are am was were to of and or in on at it its i my me you your do does did can could ' +
        'would should how what whats this that these those for with be please pls there any about ' +
        'tell just so then if but not no yes ok okay hey hi hello').split(' ').forEach(function (w) { STOP[w] = 1; });

    // ---- Singlish loader ----
    function loadSinglish() {
        if (singlishPromise) return singlishPromise;
        singlishPromise = fetch(SINGLISH_URL, { cache: 'no-cache' })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                if (data && data.words) singlish.words = data.words;
                if (data && data.phrases) singlish.phrases = data.phrases;
                singlishLoaded = true;
            })
            .catch(function () { singlishLoaded = true; });
        return singlishPromise;
    }

    // ---- Text helpers ----
    function normalize(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/[^\w\s'-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function stem(w) {
        if (w.length <= 3) return w;
        if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + 'y';
        if (/ing$/.test(w) && w.length > 5) {
            w = w.slice(0, -3);
            if (/(.)\1$/.test(w)) w = w.slice(0, -1);
            return w;
        }
        if (/ed$/.test(w) && w.length > 4) return w.slice(0, -2);
        if (/es$/.test(w) && w.length > 4 && /(s|x|ch|sh)es$/.test(w)) return w.slice(0, -2);
        if (/s$/.test(w) && !/ss$/.test(w) && w.length > 3) return w.slice(0, -1);
        return w;
    }

    function rawTokens(text) {
        var n = normalize(text);
        return n ? n.split(' ').filter(function (w) { return w.length > 1; }) : [];
    }

    // Content tokens: stop words removed, stemmed
    function contentTokens(text) {
        return rawTokens(text)
            .filter(function (w) { return !STOP[w]; })
            .map(stem);
    }

    function findSinglishWord(token) {
        if (!singlishLoaded) return null;
        if (singlish.words[token]) return singlish.words[token];
        for (var key in singlish.words) {
            if (!Object.prototype.hasOwnProperty.call(singlish.words, key)) continue;
            var entry = singlish.words[key];
            if (entry && entry.variants && entry.variants.indexOf(token) !== -1) return entry;
        }
        return null;
    }

    function queryTokens(text) {
        var base = rawTokens(text);
        var extra = [];
        base.forEach(function (t) {
            var hit = findSinglishWord(t);
            if (hit && hit.meaning) {
                extra = extra.concat(rawTokens(hit.meaning));
            }
        });
        return base.concat(extra)
            .filter(function (w) { return !STOP[w]; })
            .map(stem);
    }

    function lev(a, b) {
        if (a === b) return 0;
        var m = a.length, n = b.length;
        if (!m) return n;
        if (!n) return m;
        var prev = [], cur = [], i, j;
        for (j = 0; j <= n; j++) prev[j] = j;
        for (i = 1; i <= m; i++) {
            cur[0] = i;
            for (j = 1; j <= n; j++) {
                cur[j] = Math.min(
                    prev[j] + 1,
                    cur[j - 1] + 1,
                    prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)
                );
            }
            var t = prev; prev = cur; cur = t;
        }
        return prev[n];
    }

    // Typo tolerance: only for longer words, so "map"/"mac" never match.
    function fuzzyEq(a, b) {
        if (a === b) return true;
        var len = Math.min(a.length, b.length);
        if (len < 5 || Math.abs(a.length - b.length) > 2) return false;
        return lev(a, b) <= (len >= 8 ? 2 : 1);
    }

    function jaccard(a, b) {
        if (!a.length || !b.length) return 0;
        var sa = {}, inter = 0, union = 0, k;
        a.forEach(function (t) { sa[t] = 1; });
        var sb = {};
        b.forEach(function (t) { sb[t] = 1; });
        for (k in sa) { union++; if (sb[k]) inter++; }
        for (k in sb) { if (!sa[k]) union++; }
        return union ? inter / union : 0;
    }

    // ---- Intents ----
    function getIntents() {
        var weights = window.BotStorage.get('weights', {});
        var learned = window.BotStorage.get('custom_patterns', {});
        var customQa = window.BotStorage.get('custom_qa', []);
        var byId = {};
        var order = [];

        function add(intent) {
            if (!byId[intent.id]) order.push(intent.id);
            byId[intent.id] = intent;
        }

        BUILTIN.forEach(function (b) {
            add({
                id: b.id, title: b.title,
                keywords: b.keywords.slice(),
                singlish: [],
                shortAnswer: b.shortAnswer,
                shortAnswerSi: b.shortAnswerSi || b.shortAnswer,
                helpSection: null,
                weight: 1,
                source: 'builtin'
            });
        });

        var helpSections = (window.HelpPage && window.HelpPage.getSections)
            ? window.HelpPage.getSections() : [];
        helpSections.forEach(function (s) {
            var prior = byId[s.id];
            add({
                id: s.id,
                title: s.title,
                keywords: Array.isArray(s.keywords) ? s.keywords.slice() : (prior ? prior.keywords : []),
                singlish: Array.isArray(s.singlish) ? s.singlish : [],
                shortAnswer: s.shortAnswer || (prior && prior.shortAnswer) || '',
                shortAnswerSi: s.shortAnswerSi || s.shortAnswer || (prior && prior.shortAnswerSi) || '',
                helpSection: s.id,
                weight: s.weight || 1,
                source: 'help'
            });
        });

        customQa.forEach(function (qa, i) {
            if (!qa || !qa.question || !qa.answer) return;
            var id = qa.id || ('custom_' + i);
            add({
                id: id,
                title: qa.question,
                keywords: [],
                singlish: [],
                shortAnswer: qa.answer,
                shortAnswerSi: qa.answer,
                helpSection: null,
                weight: 1,
                source: 'custom'
            });
        });

        return order.map(function (id) {
            var it = byId[id];
            var w = weights[id];
            if (typeof w === 'number') it.weight = w;
            it.learned = Array.isArray(learned[id]) ? learned[id] : [];
            // taught questions count as an example phrase of themselves
            if (it.source === 'custom') it.learned = [it.title].concat(it.learned);
            return it;
        }).filter(function (it) { return it.shortAnswer; });
    }

    // ---- Scoring ----
    function scoreIntent(intent, q) {
        var s = 0, hits = 0, i;
        var set = q.set;

        intent.keywords.forEach(function (kw) {
            var k = String(kw).toLowerCase().trim();
            if (!k) return;
            if (k.indexOf(' ') !== -1) {
                if (q.lower.indexOf(k) !== -1) { s += 2.5; hits++; }
                return;
            }
            var ks = stem(k);
            if (set[ks]) { s += 1.2; hits++; return; }
            for (i = 0; i < q.tokens.length; i++) {
                if (fuzzyEq(q.tokens[i], ks)) { s += 0.7; hits++; break; }
            }
        });

        (intent.singlish || []).forEach(function (phrase) {
            var p = String(phrase).toLowerCase().trim();
            if (p && q.lower.indexOf(p) !== -1) { s += 2; hits++; }
        });

        // title words
        var titleToks = contentTokens(intent.title);
        titleToks.forEach(function (t) { if (set[t]) s += 0.6; });

        // answer words (weak signal, capped)
        var ans = contentTokens(intent.shortAnswer);
        var ansBonus = 0;
        ans.forEach(function (t) { if (set[t]) ansBonus += 0.15; });
        s += Math.min(ansBonus, 0.6);

        // learned phrases: closest example wins
        var best = 0;
        intent.learned.forEach(function (phrase) {
            var j = jaccard(q.tokens, contentTokens(phrase));
            if (j > best) best = j;
        });
        if (best >= 0.5) { s += 1 + 4 * best; hits++; }

        if (hits >= 2) s += 1.5;
        if (hits >= 3) s += 1.5;

        return s * (intent.weight || 1);
    }

    function rank(text, n) {
        var tokens = queryTokens(text);
        if (!tokens.length) return [];
        var q = { lower: String(text).toLowerCase(), tokens: tokens, set: {} };
        tokens.forEach(function (t) { q.set[t] = 1; });

        var list = getIntents().map(function (intent) {
            return { intent: intent, score: scoreIntent(intent, q) };
        }).filter(function (r) { return r.score > 0; });

        list.sort(function (a, b) { return b.score - a.score; });
        return list.slice(0, n || 5);
    }

    // type: answer | ambiguous | weak | none
    function classify(text) {
        var r = rank(text, 4);
        if (!r.length || r[0].score < WEAK) return { type: 'none', best: null, options: [] };
        var best = r[0];
        var close = r.filter(function (x, i) {
            return i > 0 && x.score >= CONFIDENT && x.score >= best.score * AMBIGUOUS_RATIO;
        });
        if (best.score >= CONFIDENT) {
            if (close.length) {
                return { type: 'ambiguous', best: best.intent, score: best.score,
                    options: [best].concat(close).slice(0, 3).map(function (x) { return x.intent; }) };
            }
            return { type: 'answer', best: best.intent, score: best.score,
                options: r.slice(1, 3).filter(function (x) { return x.score >= WEAK * 1.5; })
                    .map(function (x) { return x.intent; }) };
        }
        return { type: 'weak', best: best.intent, score: best.score,
            options: r.slice(0, 3).map(function (x) { return x.intent; }) };
    }

    function match(text) {
        var c = classify(text);
        return (c.type === 'answer' || c.type === 'ambiguous') ? c.best : null;
    }

    // ---- Small talk ----
    var TALK = [
        { id: 'howareyou', re: /\b(how are you|how r u|how are u|hows it going|how is it going|oyata kohomada|oya kohomada|kohomada oyata)\b/,
            en: ["I'm doing great, thanks for asking! What can I help you with?", "All good here. Ask me anything about the app."],
            si: ['Mama hondin inne! Oyata mokakda oni?'] },
        { id: 'greet', re: /^(hi+|hello+|hey+|yo|hola|sup|good (morning|afternoon|evening)|ayubowan|kohomada|kohomda|suba udasanak|suba dawasak)\b/, max: 5,
            en: ['Hey! 👋 What can I help you with?', 'Hi there! Ask me anything about PeekABooCode.'],
            si: ['Ayubowan! 👋 Mokakda oni?', 'Hari, kohomada! Mokakda mama karanna oni?'] },
        { id: 'thanks', re: /\b(thanks|thank you|thankyou|thx|tysm|ty|cheers|stuti|istuti|sthuthi)\b/,
            en: ["You're welcome! 😊", 'Happy to help!', 'Anytime!'],
            si: ['Istuti! 😊', 'Ow, harida? Thawa mokakda oni?'] },
        { id: 'bye', re: /^(bye+|goodbye|see you|see ya|cya|later|good night|gn)\b/,
            en: ['Bye! Come back any time. 👋'], si: ['Bye! Passe hambawemu. 👋'] },
        { id: 'who', re: /\b(who are you|what are you|your name|who r u|oya kawda|oyage nama)\b/,
            en: ["I'm Peek bot, a small helper that lives in your browser. I answer questions about PeekABooCode and I learn new answers when you teach me."],
            si: ['Mama Peek bot. Oyage browser eke inna podi udaw karanna kenek. Mata nawa dewal ugannanna puluwan.'] },
        { id: 'maker', re: /\b(who (made|built|created|wrote) you|who is your (creator|maker|developer))\b/,
            en: ['Amika Alankara built PeekABooCode, and me along with it.'], si: ['Amika Alankara thamai mawa hadune.'] },
        { id: 'real', re: /\b(are you (real|human|an? ai|a bot|a robot)|you a (bot|robot))\b/,
            en: ["I'm a bot, not a person. I run entirely in your browser: no server, no account."], si: ['Mama bot kenek. Okkoma oyage browser eke wada karanne.'] },
        { id: 'abilities', re: /^(what can you do|what do you do|how do you work|do you learn|can you learn|how do you learn|how can you help)\b/,
            en: ['I can answer questions about cleaning links, scanning codes, testing your camera and the settings. I also learn:\n- Say **teach: question = answer** to add something.\n- Tap 👎 on a wrong answer and pick the right one.\n- Ask **what have you learned** to review or delete things.'],
            si: ['Mama link clean, code scan, camera test gana kiyanna puluwan. Mata ugannanna puluwan: "teach: prashnaya = uththaraya" kiyala liyanna.'] },
        { id: 'ack', re: /^(ok+|okay|cool|nice|great|awesome|got it|alright|fine|sure|sweet|hari|sari|ow)\W*$/,
            en: ['👍', 'Great! Anything else?', 'Cool. Just ask if you need anything.'], si: ['👍', 'Hari! Thawa mokakda?'] },
        { id: 'sorry', re: /^(sorry|my bad|oops)\b/,
            en: ['No worries at all!'], si: ['Awlak nehe!'] },
        { id: 'joke', re: /\b(tell me a joke|joke)\b/,
            en: ['Why did the QR code go to therapy? It had too many hidden issues. 😄'], si: ['Why did the QR code go to therapy? Too many hidden issues. 😄'] }
    ];

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    function smallTalk(text) {
        var n = normalize(text);
        if (!n) return null;
        var words = n.split(' ').length;
        for (var i = 0; i < TALK.length; i++) {
            var t = TALK[i];
            if (words > (t.max || 9)) continue;
            if (t.re.test(n)) {
                return { id: t.id, reply: pick(t.en), replySi: pick(t.si || t.en) };
            }
        }
        return null;
    }

    function isYes(text) {
        return /^(y|yes|yeah|yep|yup|sure|ok|okay|please|do it|go ahead|ow|oww|hari|puluwan|ou)\W*$/.test(normalize(text));
    }
    function isNo(text) {
        return /^(n|no|nope|nah|nay|cancel|skip|never ?mind|stop|nehe|na|epa)\W*$/.test(normalize(text));
    }

    // ---- Language detection ----
    function detectLanguage(text) {
        if (!text) return 'en';
        var hit = 0;
        normalize(text).split(' ').forEach(function (t) { if (findSinglishWord(t)) hit++; });
        return hit >= 1 ? 'si' : 'en';
    }

    // ---- Learning ----
    function adjustWeight(intentId, delta) {
        var weights = window.BotStorage.get('weights', {});
        var cur = typeof weights[intentId] === 'number' ? weights[intentId] : 1;
        weights[intentId] = Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, cur + delta));
        window.BotStorage.set('weights', weights);
    }

    // Remember a phrase as an example of this intent. Returns true if new.
    function addPattern(intentId, text, boost) {
        var clean = String(text || '').trim().slice(0, 160);
        if (!clean || !contentTokens(clean).length) return false;
        var patterns = window.BotStorage.get('custom_patterns', {});
        var list = patterns[intentId] || (patterns[intentId] = []);
        var key = normalize(clean);
        var exists = list.some(function (p) { return normalize(p) === key; });
        if (!exists) {
            list.push(clean);
            if (list.length > MAX_PATTERNS) list = patterns[intentId] = list.slice(-MAX_PATTERNS);
            window.BotStorage.set('custom_patterns', patterns);
        }
        adjustWeight(intentId, typeof boost === 'number' ? boost : 0.2);
        return !exists;
    }

    function removePattern(intentId, text) {
        var patterns = window.BotStorage.get('custom_patterns', {});
        if (!patterns[intentId]) return;
        patterns[intentId] = patterns[intentId].filter(function (p) { return p !== text; });
        if (!patterns[intentId].length) delete patterns[intentId];
        window.BotStorage.set('custom_patterns', patterns);
    }

    function recordFeedback(intentId, helpful, text) {
        adjustWeight(intentId, helpful ? 0.1 : -0.15);
        // A thumbs-up teaches the bot that this wording belongs to this answer.
        if (helpful && text) addPattern(intentId, text, 0);

        var log = window.BotStorage.get('feedback_log', []);
        log.push({ intent: intentId, helpful: !!helpful, at: new Date().toISOString() });
        if (log.length > 200) log = log.slice(-200);
        window.BotStorage.set('feedback_log', log);
    }

    function addCustomQa(question, answer) {
        var q = String(question || '').trim().slice(0, 200);
        var a = String(answer || '').trim().slice(0, 600);
        if (!q || !a) return null;
        var list = window.BotStorage.get('custom_qa', []);
        var key = normalize(q);
        for (var i = 0; i < list.length; i++) {
            if (normalize(list[i].question) === key) {   // same question: update answer
                list[i].answer = a;
                window.BotStorage.set('custom_qa', list);
                return list[i].id;
            }
        }
        if (list.length >= MAX_CUSTOM) list.shift();
        var id = 'custom_' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
        list.push({ id: id, question: q, answer: a });
        window.BotStorage.set('custom_qa', list);
        return id;
    }

    function removeCustomQa(id) {
        var list = window.BotStorage.get('custom_qa', []).filter(function (qa) { return qa.id !== id; });
        window.BotStorage.set('custom_qa', list);
        var patterns = window.BotStorage.get('custom_patterns', {});
        var weights = window.BotStorage.get('weights', {});
        delete patterns[id];
        delete weights[id];
        window.BotStorage.set('custom_patterns', patterns);
        window.BotStorage.set('weights', weights);
    }

    function getCustomQa() { return window.BotStorage.get('custom_qa', []); }
    function getLearnedPatterns() { return window.BotStorage.get('custom_patterns', {}); }

    function stats() {
        var patterns = getLearnedPatterns(), n = 0;
        Object.keys(patterns).forEach(function (k) { n += patterns[k].length; });
        return {
            customQa: getCustomQa().length,
            patterns: n,
            feedback: window.BotStorage.get('feedback_log', []).length
        };
    }

    function reset() {
        ['weights', 'custom_patterns', 'custom_qa', 'feedback_log'].forEach(function (k) {
            window.BotStorage.remove(k);
        });
    }

    window.BotEngine = {
        load: loadSinglish,
        match: match,
        rank: rank,
        classify: classify,
        smallTalk: smallTalk,
        isYes: isYes,
        isNo: isNo,
        detectLanguage: detectLanguage,
        recordFeedback: recordFeedback,
        addPattern: addPattern,
        removePattern: removePattern,
        addCustomQa: addCustomQa,
        removeCustomQa: removeCustomQa,
        getCustomQa: getCustomQa,
        getLearnedPatterns: getLearnedPatterns,
        getIntents: getIntents,
        stats: stats,
        normalize: normalize,
        reset: reset
    };
})();
