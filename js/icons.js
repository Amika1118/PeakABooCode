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
        // ---- AI / LLM ----
        'OpenAI': 'openai',
        'ChatGPT': 'openai',
        'Anthropic': 'anthropic',
        'Claude': 'anthropic',
        'Gemini': 'googlegemini',
        'Copilot': 'githubcopilot',
        'GitHub Copilot': 'githubcopilot',
        'Perplexity': 'perplexity',
        'Hugging Face': 'huggingface',
        'Ollama': 'ollama',
        'Mistral AI': 'mistralai',
        'Cohere': 'cohere',
        'Replicate': 'replicate',
        'Stability AI': 'stabilityai',
        'Suno': 'suno',
        'ElevenLabs': 'elevenlabs',
        'Runway': 'runway',
        'Cursor': 'cursor',
        'DeepSeek': 'deepseek',

        // ---- Social / messaging ----
        'YouTube': 'youtube',
        'YouTube Music': 'youtubemusic',
        'Instagram': 'instagram',
        'X': 'x',
        'Facebook': 'facebook',
        'Messenger': 'messenger',
        'TikTok': 'tiktok',
        'LinkedIn': 'linkedin',
        'Reddit': 'reddit',
        'Snapchat': 'snapchat',
        'WhatsApp': 'whatsapp',
        'Telegram': 'telegram',
        'Discord': 'discord',
        'Slack': 'slack',
        'Zoom': 'zoom',
        'Signal': 'signal',
        'Viber': 'viber',
        'LINE': 'line',
        'WeChat': 'wechat',
        'Skype': 'skype',
        'Microsoft Teams': 'microsoftteams',
        'KakaoTalk': 'kakaotalk',
        'Naver': 'naver',
        'Pinterest': 'pinterest',

        // ---- Productivity / work ----
        'Notion': 'notion',
        'Figma': 'figma',
        'Linear': 'linear',
        'Asana': 'asana',
        'Trello': 'trello',
        'Monday': 'mondaydotcom',
        'Airtable': 'airtable',
        'Miro': 'miro',
        'Canva': 'canva',
        'Framer': 'framer',
        'Webflow': 'webflow',
        'Squarespace': 'squarespace',
        'Atlassian': 'atlassian',
        'Jira': 'jira',
        'Confluence': 'confluence',

        // ---- Dev tools ----
        'GitHub': 'github',
        'GitLab': 'gitlab',
        'Bitbucket': 'bitbucket',
        'VS Code': 'visualstudiocode',
        'JetBrains': 'jetbrains',
        'Postman': 'postman',
        'DEV Community': 'devdotto',
        'Hashnode': 'hashnode',
        'Stack Overflow': 'stackoverflow',
        'Stack Exchange': 'stackexchange',
        'Hacker News': 'ycombinator',
        'Product Hunt': 'producthunt',

        // ---- Cloud / hosting ----
        'Cloudflare': 'cloudflare',
        'AWS': 'amazonwebservices',
        'Google Cloud': 'googlecloud',
        'DigitalOcean': 'digitalocean',
        'Vercel': 'vercel',
        'Netlify': 'netlify',
        'Heroku': 'heroku',
        'Supabase': 'supabase',
        'Firebase': 'firebase',
        'MongoDB': 'mongodb',
        'Docker': 'docker',
        'Kubernetes': 'kubernetes',

        // ---- Finance / crypto ----
        'Stripe': 'stripe',
        'PayPal': 'paypal',
        'Wise': 'wise',
        'Revolut': 'revolut',
        'Coinbase': 'coinbase',
        'Binance': 'binance',
        'Kraken': 'kraken',
        'MetaMask': 'metamask',

        // ---- Commerce ----
        'Amazon': 'amazon',
        'eBay': 'ebay',
        'Etsy': 'etsy',
        'Walmart': 'walmart',
        'Target': 'target',
        'Best Buy': 'bestbuy',
        'AliExpress': 'aliexpress',
        'Alibaba': 'alibabacom',
        'Daraz': 'daraz',
        'Shopify': 'shopify',

        // ---- Music / media / streaming ----
        'Spotify': 'spotify',
        'SoundCloud': 'soundcloud',
        'Bandcamp': 'bandcamp',
        'Deezer': 'deezer',
        'Tidal': 'tidal',
        'Shazam': 'shazam',
        'Audible': 'audible',
        'Goodreads': 'goodreads',
        'IMDb': 'imdb',
        'Netflix': 'netflix',
        'Twitch': 'twitch',
        'Vimeo': 'vimeo',

        // ---- Big tech ----
        'Apple': 'apple',
        'Google': 'google',
        'Google Drive': 'googledrive',
        'Google Docs': 'googledocs',
        'Gmail': 'gmail',
        'Microsoft': 'microsoft',
        'Medium': 'medium',
        'Wikipedia': 'wikipedia',
        'Dropbox': 'dropbox',

        // ---- Gaming ----
        'Steam': 'steam',
        'Epic Games': 'epicgames',
        'PlayStation': 'playstation',
        'Xbox': 'xbox',
        'Nintendo': 'nintendo',
        'Roblox': 'roblox',
        'Minecraft': 'minecraft',

        // ---- Travel ----
        'Uber': 'uber',
        'Uber Eats': 'ubereats',
        'Lyft': 'lyft',
        'Bolt': 'bolt',
        'DoorDash': 'doordash',
        'Grubhub': 'grubhub',
        'Airbnb': 'airbnb',
        'Booking.com': 'bookingdotcom',
        'Expedia': 'expedia',
        'TripAdvisor': 'tripadvisor',

        // ---- Education ----
        'Duolingo': 'duolingo',
        'Coursera': 'coursera',
        'Udemy': 'udemy',
        'Khan Academy': 'khanacademy',
        'Skillshare': 'skillshare',
        'Brilliant': 'brilliant',

        // ---- News ----
        'BBC': 'bbc',
        'CNN': 'cnn',
        'The New York Times': 'nytimes',
        'The Guardian': 'theguardian',
        'Reuters': 'reuters',
        'Bloomberg': 'bloomberg',
        'The Verge': 'theverge',
        'TechCrunch': 'techcrunch',
        'Wired': 'wired',
        'Ars Technica': 'arstechnica',

        // ---- Search ----
        'DuckDuckGo': 'duckduckgo',
        'Brave': 'brave',
        'Brave Search': 'brave',
        'Yandex': 'yandex',
        'Baidu': 'baidu'
    };

    // Emoji fallback (used if the logo file is missing)
    var EMOJI = {
        // ---- AI / LLM ----
        'OpenAI': '🤖',
        'ChatGPT': '🤖',
        'Anthropic': '🎭',
        'Claude': '🎭',
        'Gemini': '✨',
        'Copilot': '🧑‍✈️',
        'GitHub Copilot': '🧑‍✈️',
        'Perplexity': '🔮',
        'Hugging Face': '🤗',
        'Ollama': '🦙',
        'Mistral AI': '🌬️',
        'Cohere': '🧠',
        'Replicate': '🔁',
        'Stability AI': '🎨',
        'Suno': '🎵',
        'ElevenLabs': '🎙️',
        'Runway': '🎬',
        'Cursor': '🖱️',
        'DeepSeek': '🐋',

        // ---- Social / messaging ----
        'YouTube': '▶️',
        'YouTube Music': '🎵',
        'Instagram': '📷',
        'X': '𝕏',
        'Facebook': '📘',
        'Messenger': '💬',
        'TikTok': '🎵',
        'LinkedIn': '💼',
        'Reddit': '👽',
        'Snapchat': '👻',
        'WhatsApp': '💬',
        'Telegram': '✈️',
        'Discord': '🎮',
        'Slack': '💬',
        'Zoom': '📹',
        'Signal': '🔒',
        'Viber': '💬',
        'LINE': '💚',
        'WeChat': '💬',
        'Skype': '📞',
        'Microsoft Teams': '👥',
        'KakaoTalk': '💛',
        'Naver': '🟢',
        'Pinterest': '📌',

        // ---- Productivity ----
        'Notion': '📓',
        'Figma': '🎨',
        'Linear': '📐',
        'Asana': '✅',
        'Trello': '📋',
        'Monday': '📅',
        'Airtable': '🗃️',
        'Miro': '🎯',
        'Canva': '🎨',
        'Framer': '🖼️',
        'Webflow': '🌐',
        'Squarespace': '⬛',
        'Atlassian': '🔵',
        'Jira': '📊',
        'Confluence': '📚',

        // ---- Dev tools ----
        'GitHub': '🐙',
        'GitLab': '🦊',
        'Bitbucket': '🪣',
        'VS Code': '💻',
        'JetBrains': '🧠',
        'Postman': '📮',
        'DEV Community': '👩‍💻',
        'Hashnode': '📝',
        'Stack Overflow': '📚',
        'Stack Exchange': '📚',
        'Hacker News': '🟠',
        'Product Hunt': '🐱',

        // ---- Cloud ----
        'Cloudflare': '☁️',
        'AWS': '☁️',
        'Google Cloud': '☁️',
        'DigitalOcean': '🌊',
        'Vercel': '▲',
        'Netlify': '🌐',
        'Heroku': '💜',
        'Supabase': '⚡',
        'Firebase': '🔥',
        'MongoDB': '🍃',
        'Docker': '🐳',
        'Kubernetes': '☸️',

        // ---- Finance ----
        'Stripe': '💳',
        'PayPal': '💵',
        'Wise': '💸',
        'Revolut': '💳',
        'Coinbase': '🪙',
        'Binance': '🟡',
        'Kraken': '🐙',
        'MetaMask': '🦊',

        // ---- Commerce ----
        'Amazon': '📦',
        'eBay': '🏷️',
        'Etsy': '🧶',
        'Walmart': '🛒',
        'Target': '🎯',
        'Best Buy': '🛍️',
        'AliExpress': '🛒',
        'Alibaba': '🏭',
        'Daraz': '🛍️',
        'Shopify': '🛍️',

        // ---- Music / media ----
        'Spotify': '🎧',
        'SoundCloud': '☁️',
        'Bandcamp': '🎸',
        'Deezer': '🎵',
        'Tidal': '🌊',
        'Shazam': '🎤',
        'Audible': '🎧',
        'Goodreads': '📚',
        'IMDb': '🎬',
        'Netflix': '🎬',
        'Twitch': '🎥',
        'Vimeo': '🎞️',

        // ---- Big tech ----
        'Apple': '🍎',
        'Google': '🔍',
        'Google Drive': '🗂️',
        'Google Docs': '📄',
        'Gmail': '✉️',
        'Microsoft': '🪟',
        'Medium': '✍️',
        'Wikipedia': '📖',
        'Dropbox': '📁',

        // ---- Gaming ----
        'Steam': '🎮',
        'Epic Games': '🎮',
        'PlayStation': '🎮',
        'Xbox': '🎮',
        'Nintendo': '🎮',
        'Roblox': '🟥',
        'Minecraft': '⛏️',

        // ---- Travel ----
        'Uber': '🚗',
        'Uber Eats': '🍔',
        'Lyft': '🚕',
        'Bolt': '⚡',
        'DoorDash': '🍕',
        'Grubhub': '🍔',
        'Airbnb': '🏠',
        'Booking.com': '🏨',
        'Expedia': '✈️',
        'TripAdvisor': '🧭',

        // ---- Education ----
        'Duolingo': '🦉',
        'Coursera': '🎓',
        'Udemy': '📚',
        'Khan Academy': '📖',
        'Skillshare': '🎨',
        'Brilliant': '💡',

        // ---- News ----
        'BBC': '📺',
        'CNN': '📺',
        'The New York Times': '📰',
        'The Guardian': '📰',
        'Reuters': '📰',
        'Bloomberg': '📊',
        'The Verge': '📱',
        'TechCrunch': '📰',
        'Wired': '📡',
        'Ars Technica': '🔬',

        // ---- Search ----
        'DuckDuckGo': '🦆',
        'Brave': '🦁',
        'Brave Search': '🦁',
        'Yandex': '🔎',
        'Baidu': '🔍'
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