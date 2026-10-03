/* ============================================
   bot/engine.js - matching, scoring, learning.
   Reads help-content.json (via HelpPage),
   singlish.json, and user-added custom Q&A.
   ============================================ */
(function () {
    'use strict';

    var SINGLISH_URL = 'data/singlish.json';
    var MIN_SCORE = 2.0;
    var WEIGHT_MIN = 0.1;
    var WEIGHT_MAX = 10;

    var singlish = { words: {}, phrases: {} };
    var singlishLoaded = false;
    var singlishPromise = null;

    // ---- Singlish loader ----
    function loadSinglish() {
        if (singlishPromise) return singlishPromise;
        singlishPromise = fetch(SINGLISH_URL, { cache: 'force-cache' })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                if (data && data.words) singlish.words = data.words;
                if (data && data.phrases) singlish.phrases = data.phrases;
                singlishLoaded = true;
            })
            .catch(function () {
                singlishLoaded = true;
            });
        return singlishPromise;
    }

    // ---- Intent building ----
    // Combine help sections + custom Q&A into a single list of intents.
    function getIntents() {
        var intents = [];
        var helpSections = (window.HelpPage && window.HelpPage.getSections)
            ? window.HelpPage.getSections()
            : [];

        var weights = window.BotStorage.get('weights', {});
        var customPatterns = window.BotStorage.get('custom_patterns', {});
        var customQa = window.BotStorage.get('custom_qa', []);

        helpSections.forEach(function (s) {
            var weight = weights[s.id];
            if (typeof weight !== 'number') weight = s.weight || 1;

            var keywords = Array.isArray(s.keywords) ? s.keywords.slice() : [];
            // Add any user corrections for this section
            var extras = customPatterns[s.id];
            if (Array.isArray(extras)) {
                keywords = keywords.concat(extras);
            }

            intents.push({
                id: s.id,
                title: s.title,
                keywords: keywords,
                singlish: Array.isArray(s.singlish) ? s.singlish : [],
                shortAnswer: s.shortAnswer || '',
                shortAnswerSi: s.shortAnswerSi || s.shortAnswer || '',
                helpSection: s.id,
                weight: weight,
                source: 'help'
            });
        });

        customQa.forEach(function (qa, i) {
            if (!qa || !qa.question || !qa.answer) return;
            var id = qa.id || ('custom_' + i);
            var weight2 = weights[id];
            if (typeof weight2 !== 'number') weight2 = 1;

            intents.push({
                id: id,
                title: qa.question,
                keywords: tokenizeLoose(qa.question),
                singlish: [],
                shortAnswer: qa.answer,
                shortAnswerSi: qa.answer,
                helpSection: null,
                weight: weight2,
                source: 'custom'
            });
        });

        return intents;
    }

    // ---- Normalization ----
    function normalize(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/[^\w\s'-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function tokenizeLoose(text) {
        var n = normalize(text);
        if (!n) return [];
        return n.split(' ').filter(function (w) { return w.length > 1; });
    }

    function tokenize(text) {
        var tokens = tokenizeLoose(text);

        // Singlish expansion: add English meaning of any singlish word found
        var extra = [];
        tokens.forEach(function (t) {
            var canonical = findSinglishWord(t);
            if (canonical && canonical.meaning) {
                var meaningWords = normalize(canonical.meaning).split(' ').filter(function (w) {
                    return w.length > 1;
                });
                extra = extra.concat(meaningWords);
            }
        });
        return tokens.concat(extra);
    }

    function findSinglishWord(token) {
        if (!singlishLoaded) return null;
        // Direct hit
        if (singlish.words[token]) return singlish.words[token];
        // Search variants
        for (var key in singlish.words) {
            if (!Object.prototype.hasOwnProperty.call(singlish.words, key)) continue;
            var entry = singlish.words[key];
            if (entry.variants && entry.variants.indexOf(token) !== -1) {
                return entry;
            }
        }
        return null;
    }

    // ---- Scoring ----
    function score(intent, tokens, originalText) {
        var score = 0;
        var lowerText = originalText.toLowerCase();
        var hits = 0;

        intent.keywords.forEach(function (kw) {
            var k = String(kw).toLowerCase().trim();
            if (!k) return;
            // Phrase match bonus (substring search on the full text)
            if (k.indexOf(' ') !== -1) {
                if (lowerText.indexOf(k) !== -1) {
                    score += 2;
                    hits++;
                }
            } else {
                if (tokens.indexOf(k) !== -1) {
                    score += 1;
                    hits++;
                }
            }
        });

        // Singlish phrase bonus
        if (intent.singlish && intent.singlish.length) {
            intent.singlish.forEach(function (phrase) {
                var p = String(phrase).toLowerCase().trim();
                if (!p) return;
                if (lowerText.indexOf(p) !== -1) {
                    score += 2;
                    hits++;
                }
            });
        }

        if (hits >= 2) score += 2;   // multiple-hit bonus
        if (hits >= 3) score += 2;   // strong-signal bonus

        return score * (intent.weight || 1);
    }

    function match(text) {
        var tokens = tokenize(text);
        if (!tokens.length) return null;

        var intents = getIntents();
        var best = null;

        intents.forEach(function (intent) {
            var s = score(intent, tokens, text);
            if (!best || s > best.score) {
                best = { intent: intent, score: s };
            }
        });

        if (!best || best.score < MIN_SCORE) return null;
        return best.intent;
    }

    // ---- Language detection ----
    function detectLanguage(text) {
        if (!text) return 'en';
        var tokens = normalize(text).split(' ');
        var singlishHits = 0;
        tokens.forEach(function (t) {
            if (findSinglishWord(t)) singlishHits++;
        });
        if (singlishHits >= 1) return 'si';
        return 'en';
    }

    // ---- Learning ----
    function adjustWeight(intentId, delta) {
        var weights = window.BotStorage.get('weights', {});
        var current = typeof weights[intentId] === 'number' ? weights[intentId] : 1;
        var next = current + delta;
        if (next < WEIGHT_MIN) next = WEIGHT_MIN;
        if (next > WEIGHT_MAX) next = WEIGHT_MAX;
        weights[intentId] = next;
        window.BotStorage.set('weights', weights);
    }

    function recordFeedback(intentId, helpful) {
        adjustWeight(intentId, helpful ? 0.1 : -0.1);

        var log = window.BotStorage.get('feedback_log', []);
        log.push({
            intent: intentId,
            helpful: !!helpful,
            at: new Date().toISOString()
        });
        // Keep the last 200
        if (log.length > 200) log = log.slice(-200);
        window.BotStorage.set('feedback_log', log);
    }

    function addPattern(intentId, text) {
        var patterns = window.BotStorage.get('custom_patterns', {});
        if (!patterns[intentId]) patterns[intentId] = [];
        var clean = String(text || '').trim();
        if (!clean) return;
        if (patterns[intentId].indexOf(clean) === -1) {
            patterns[intentId].push(clean);
            window.BotStorage.set('custom_patterns', patterns);
        }
        adjustWeight(intentId, 0.3);
    }

    function addCustomQa(question, answer) {
        var list = window.BotStorage.get('custom_qa', []);
        var id = 'custom_' + Date.now().toString(36);
        list.push({ id: id, question: question, answer: answer });
        window.BotStorage.set('custom_qa', list);
        return id;
    }

    function removeCustomQa(id) {
        var list = window.BotStorage.get('custom_qa', []);
        list = list.filter(function (qa) { return qa.id !== id; });
        window.BotStorage.set('custom_qa', list);
    }

    function getCustomQa() {
        return window.BotStorage.get('custom_qa', []);
    }

    function reset() {
        window.BotStorage.clear();
    }

    // ---- Public API ----
    window.BotEngine = {
        load: loadSinglish,
        match: match,
        detectLanguage: detectLanguage,
        recordFeedback: recordFeedback,
        addPattern: addPattern,
        addCustomQa: addCustomQa,
        removeCustomQa: removeCustomQa,
        getCustomQa: getCustomQa,
        getIntents: getIntents,
        reset: reset
    };
})();