/* ============================================
   icons.js - app icon lookup
   Tier 1: emoji (fast, no data, offline-safe)
   Tier 2: letter avatar with hash-derived color
   ============================================ */
(function () {
    'use strict';

    var EMOJI = {
        'YouTube': '▶️',
        'Instagram': '📷',
        'X': '𝕏',
        'Facebook': '📘',
        'TikTok': '🎵',
        'LinkedIn': '💼',
        'Reddit': '👽',
        'GitHub': '🐙',
        'Medium': '✍️',
        'Pinterest': '📌',
        'Snapchat': '👻',
        'WhatsApp': '💬',
        'Telegram': '✈️',
        'Discord': '🎮',
        'Spotify': '🎧',
        'Amazon': '📦',
        'Netflix': '🎬',
        'Twitch': '🎥',
        'Vimeo': '🎞️',
        'Apple': '🍎',
        'Google': '🔍',
        'Microsoft': '🪟',
        'Stack Overflow': '📚',
        'Wikipedia': '📖',
        'Dropbox': '📁',
        'Google Drive': '🗂️',
        'Google Docs': '📄',
        'Gmail': '✉️'
    };

    // A small palette for letter avatars that reads well in both themes
    var AVATAR_COLORS = [
        '#E87A3E', // orange
        '#2D8B96', // teal
        '#6A9CFF', // blue
        '#B8860B', // gold
        '#8B5CF6', // purple
        '#EC4899'  // pink
    ];

    function hashColor(str) {
        var h = 0;
        for (var i = 0; i < str.length; i++) {
            h = (h * 31 + str.charCodeAt(i)) | 0;
        }
        return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Return an HTML string for the icon.
     * @param {string} appName  e.g. "YouTube" (may be null)
     * @param {string} domain   fallback e.g. "example.com"
     * @returns {string} HTML
     */
    function get(appName, domain) {
        var key = appName || domain || '?';
        var emoji = EMOJI[appName];

        if (emoji) {
            return '<span class="app-icon app-icon-emoji" aria-hidden="true">' +
                emoji + '</span>';
        }

        var letter = String(key).charAt(0).toUpperCase();
        var bg = hashColor(key);

        return '<span class="app-icon app-icon-letter" aria-hidden="true" style="background:' +
            bg + '">' + escapeHtml(letter) + '</span>';
    }

    window.Icons = {
        get: get
    };
})();