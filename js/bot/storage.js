/* ============================================
   bot/storage.js - tiny localStorage wrapper for the bot.
   Falls back to in-memory storage when localStorage
   is blocked (private mode, disabled cookies).
   ============================================ */
(function () {
    'use strict';

    var PREFIX = 'peekbot:';
    var memory = {};
    var useLocal = (function () {
        try {
            var k = PREFIX + '__t';
            localStorage.setItem(k, '1');
            localStorage.removeItem(k);
            return true;
        } catch (e) {
            return false;
        }
    })();

    function get(key, fallback) {
        var raw = null;
        try {
            raw = useLocal ? localStorage.getItem(PREFIX + key) : memory[key];
        } catch (e) { raw = memory[key]; }
        if (raw === null || raw === undefined) return fallback;
        try {
            return JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    }

    function set(key, value) {
        var raw;
        try { raw = JSON.stringify(value); } catch (e) { return false; }
        memory[key] = raw;
        if (!useLocal) return true;
        try {
            localStorage.setItem(PREFIX + key, raw);
            return true;
        } catch (e) {
            return false;
        }
    }

    function remove(key) {
        delete memory[key];
        if (!useLocal) return;
        try { localStorage.removeItem(PREFIX + key); } catch (e) { }
    }

    function keys() {
        if (!useLocal) return Object.keys(memory);
        var out = [];
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length));
            }
        } catch (e) { }
        return out;
    }

    function clear() {
        keys().forEach(remove);
        memory = {};
    }

    window.BotStorage = { get: get, set: set, remove: remove, keys: keys, clear: clear };
})();