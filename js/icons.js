/* ============================================
   icons.js - app icon lookup
   Tier 1: bundled SVG logo (assets/logos/)
   Tier 2: emoji (offline, no file needed)
   Tier 3: letter avatar with hash color
   ============================================ */
(function () {
    'use strict';

    // App name -> Simple Icons slug (filename without .svg)
    var SLUGS = {
        'YouTube': 'youtube',
        'Instagram': 'instagram',
        'X': 'x',
        'Facebook': 'facebook',
        'TikTok': 'tiktok',
        'LinkedIn': 'linkedin',
        'Reddit': 'reddit',
        'GitHub': 'github',
        'Medium': 'medium',
        'Pinterest': 'pinterest',
        'Snapchat': 'snapchat',
        'WhatsApp': 'whatsapp',
        'Telegram': 'telegram',
        'Discord': 'discord',
        'Spotify': 'spotify',
        'Amazon': 'amazon',
        'Netflix': 'netflix',
        'Twitch': 'twitch',
        'Vimeo': 'vimeo',
        'Apple': 'apple',
        'Google': 'google',
        'Microsoft': 'microsoft',
        'Stack Overflow': 'stackoverflow',
        'Wikipedia': 'wikipedia',
        'Dropbox': 'dropbox',
        'Google Drive': 'googledrive',
        'Google Docs': 'googledocs',
        'Gmail': 'gmail'
    };

    // Emoji fallback (if a logo file is missing)
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

    var AVATAR_COLORS = [
        '#E8793F', // brand orange
        '#2A8A94', // brand teal
        '#6A9CFF',
        '#B8860B',
        '#8B5CF6',
        '#EC4899'
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
     * Return HTML for the app icon.
     * @param {string} appName  e.g. "YouTube" (may be null)
     * @param {string} domain   fallback e.g. "example.com"
     * @returns {string} HTML
     */
    function get(appName, domain) {
        var key = appName || domain || '?';

        // Tier 1: bundled logo
        var slug = SLUGS[appName];
        if (slug) {
            var initial = escapeHtml(String(key).charAt(0).toUpperCase());
            return '<span class="app-icon app-icon-logo">' +
                '<img src="assets/logos/' + slug + '.svg" alt="" width="24" height="24" loading="lazy"' +
                ' onerror="this.style.display=\'none\';this.parentNode.classList.add(\'app-icon-logo-missing\');this.parentNode.setAttribute(\'data-letter\',\'' + initial + '\');">' +
                '</span>';
        }

        // Tier 2: emoji
        var emoji = EMOJI[appName];
        if (emoji) {
            return '<span class="app-icon app-icon-emoji" aria-hidden="true">' +
                emoji + '</span>';
        }

        // Tier 3: letter avatar
        var letter = String(key).charAt(0).toUpperCase();
        var bg = hashColor(key);
        return '<span class="app-icon app-icon-letter" aria-hidden="true" style="background:' +
            bg + '">' + escapeHtml(letter) + '</span>';
    }

    window.Icons = {
        get: get
    };
})();