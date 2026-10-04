/* ============================================
   link-cleaner.js - URL validation, tracking
   param stripping, source app detection, and
   result rendering for the Clean tab.

   Now also exposes:
   - XSS / command injection / sensitive data detection
   - Nested URL extraction from redirect params
   - Open redirect neutralization

   These are used by threat-checker.js.
   ============================================ */
(function () {
    'use strict';

    // ============================================================
    // 1. TRACKING PARAMETERS
    // ============================================================

    // Family regexes — cover namespaced params that keep growing
    var TRACKING_PATTERNS = [
        /^utm_/i,
        /^utm[A-Z]/,
        /^pk_/i,
        /^piwik_/i,
        /^mtm_/i,
        /^hsa_/i,
        /^_hs/i,
        /^__hs/i,
        /^hsCtaTracking$/i,
        /^pd_rd_/i,
        /^pf_rd_/i,
        /^_encoding$/i,
        /^smid$/i,
        /^smtyp$/i,
        /^trk_/i,
        /^trk[A-Z]/,
        /^sc_/i,
        /^_ga/i,
        /^_gl$/i,
        /^ga_/i,
        /^gclid/i,
        /^gbraid$/i,
        /^wbraid$/i,
        /^dclid$/i,
        /^gclsrc$/i,
        /^gad_source$/i,
        /^srsltid$/i,
        /^msclkid$/i,
        /^fbclid$/i,
        /^fb_action_ids$/i,
        /^fb_action_types$/i,
        /^fb_ref$/i,
        /^fb_source$/i,
        /^_fbp$/i,
        /^_fbc$/i,
        /^ttclid$/i,
        /^twclid$/i,
        /^li_fat_id$/i,
        /^igshid$/i,
        /^igsh$/i,
        /^ig_mid$/i,
        /^yclid$/i,
        /^ysclid$/i,
        /^mc_eid$/i,
        /^mc_cid$/i,
        /^mkt_tok$/i,
        /^_mkto_trk$/i,
        /^oly_enc_id$/i,
        /^oly_anon_id$/i,
        /^vero_id$/i,
        /^vero_conv$/i,
        /^wickedid$/i,
        /^elqTrackId$/i,
        /^elqTrack$/i,
        /^assetId$/i,
        /^assetType$/i,
        /^campaignId$/i,
        /^siteId$/i,
        /^ref_src$/i,
        /^ref_url$/i,
        /^refSrc$/i,
        /^ref_/i,
        /^referrer$/i,
        /^source$/i,
        /^sourceid$/i,
        /^medium$/i,
        /^campaign$/i,
        /^content$/i,
        /^term$/i,
        /^keyword$/i,
        /^campaignid$/i,
        /^adgroupid$/i,
        /^adid$/i,
        /^matchtype$/i,
        /^network$/i,
        /^device$/i,
        /^placement$/i,
        /^creative$/i,
        /^targetid$/i,
        /^loc_interest_ms$/i,
        /^loc_physical_ms$/i,
        /^gadid$/i,
        /^si$/i,
        /^feature$/i,
        /^ab_channel$/i,
        /^app$/i,
        /^kw$/i,
        /^pp$/i,
        /^_trk/i,
        /^_hsenc$/i,
        /^_hsmi$/i,
        /^_openstat$/i,
        /^_ga$/i,
        /^_gl$/i,
        /^__hssc$/i,
        /^__hstc$/i,
        /^__hsfp$/i,
        /^_clck$/i,
        /^_clsk$/i,
        /^clck$/i,
        /^clsk$/i,
        /^icid$/i,
        /^ncid$/i,
        /^cmpid$/i,
        /^CID$/i,
        /^s_cid$/i,
        /^camp$/i,
        /^adsetid$/i,
        /^adset_id$/i,
        /^ad_id$/i,
        /^campaign_id$/i,
        /^adgroup_id$/i,
        /^group_id$/i,
        /^placement_id$/i,
        /^creative_id$/i,
        /^audience_id$/i,
        /^audienceid$/i,
        /^segment_id$/i,
        /^segmentid$/i,
        /^visitor_id$/i,
        /^visitorid$/i,
        /^visitorId$/,
        /^user_id$/i,
        /^userid$/i,
        /^customer_id$/i,
        /^customerid$/i,
        /^cart_id$/i,
        /^cartid$/i,
        /^session_id$/i,
        /^sessionid$/i,
        /^sid$/i,
        /^vid$/i,
        /^uid$/i,
        /^uuid$/i,
        /^guid$/i,
        /^_vid$/i,
        /^_uid$/i,
        /^_uuid$/i,
        /^_guid$/i,
        /^_sid$/i,
        /^_sessionId$/,
        /^_session_id$/,
        /^_cartId$/,
        /^_cart_id$/,
        /^_customerId$/,
        /^_customer_id$/,
        /^_userId$/,
        /^_user_id$/,
        /^_visitorId$/,
        /^_visitor_id$/,
        /^_visitor$/,
        /^__visitor/,
        /^_gac$/,
        /^_fplc$/,
        /^_ttp$/,
        /^_tt_enable_cookie$/,
        /^_pin_unauth$/,
        /^_derived_epik$/,
        /^epik$/,
        /^ppid$/,
        /^_shopify_/,
        /^_y$/,
        /^_s$/,
        /^_orig_referrer$/,
        /^_landing_page$/,
        /^_gid$/,
        /^_gat$/,
        /^_dc_gtm_/,
        /^gtm_/,
        /^_gaexp$/,
        /^_opt_aw/
    ];

    var TRACKING_LITERALS = [
        // Google
        'gclid', 'dclid', 'gclsrc', 'gbraid', 'wbraid', 'srsltid',
        'gad_source', '_ga', '_gl', '_gid', '_gat', '_gaexp',
        // Meta / Facebook
        'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_ref', 'fb_source',
        '_fbp', '_fbc',
        // Microsoft
        'msclkid', '_clck', '_clsk', 'clck', 'clsk', 'yclid', 'ysclid',
        // TikTok
        'ttclid', '_ttp', '_tt_enable_cookie',
        // Twitter / X
        'twclid', 'ref_src', 'ref_url', 'refsrc', 'ref_',
        // LinkedIn
        'li_fat_id',
        // Instagram
        'igshid', 'igsh', 'ig_mid',
        // YouTube
        'si', 'feature', 'ab_channel', 'app',
        // Mailchimp / Marketo
        'mc_eid', 'mc_cid', 'mkt_tok', '_mkto_trk', 'elqtrackid', 'elqtrack',
        // HubSpot
        '_hsenc', '_hsmi', 'hsctatracking', 'hsa_',
        // Omeda / Vero / Wicked
        'oly_enc_id', 'oly_anon_id', 'vero_id', 'vero_conv', 'wickedid',
        // Pinterest
        '_pin_unauth', '_derived_epik', 'epik', 'ppid',
        // Google Analytics / GTM
        'gtm_', 'ga_', '_dc_gtm_',
        // Shopify
        '_shopify_ga', '_shopify_fs', '_shopify_s', '_shopify_y',
        '_shopify_sa_p', '_shopify_sa_t', '_shopify_uniq', '_shopify_visit',
        '_orig_referrer', '_landing_page', '_shopify_country',
        '_shopify_m', '_shopify_tm', '_shopify_tw', '_shopify_evids',
        '_shopify_p',
        '_y', '_s',
        // Generic campaign / ad IDs
        'campaignid', 'adgroupid', 'adid', 'matchtype', 'network',
        'device', 'placement', 'creative', 'targetid', 'loc_interest_ms',
        'loc_physical_ms', 'gadid', 'kw', 'pp', 'camp',
        'adsetid', 'adset_id', 'ad_id', 'campaign_id', 'adgroup_id',
        'group_id', 'placement_id', 'creative_id', 'audience_id',
        'audienceid', 'segment_id', 'segmentid',
        // Generic visitor / session IDs
        'visitor_id', 'visitorid', 'visitorid', 'user_id', 'userid',
        'customer_id', 'customerid', 'cart_id', 'cartid',
        'session_id', 'sessionid', 'sid', 'vid', 'uid', 'uuid', 'guid',
        // Amazon affiliate
        'tag', 'linkcode', 'linkid', 'ascsubtag',
        'pd_rd_i', 'pd_rd_r', 'pd_rd_w', 'pd_rd_wg',
        'pf_rd_p', 'pf_rd_r', 'pf_rd_s', 'pf_rd_t', 'pf_rd_i', 'pf_rd_m',
        // eBay
        'mkevt', 'mkcid', 'mkrid', 'campid', 'customid', 'toolid',
        'mpt', 'siteid', 'var', 'hash',
        // AliExpress
        'aff_fcid', 'aff_platform', 'aff_trace_key',
        'terminal_id', 'algo_expid', 'algo_pvid', 'btsid', 'ws_ab_test',
        // Etsy
        'click_key', 'click_sum', 'frs', 'plkey', 'pro',
        // Walmart
        'wmlspartner', 'wl0', 'wl1', 'wl2', 'wl3', 'wl4', 'wl5', 'wl6',
        'wl7', 'wl8', 'wl9', 'wl10', 'wl11', 'wl12', 'wl13',
        // Target
        'clkid', 'lnm', 'afid', 'preselect',
        // Best Buy
        'loc', 'cmp', 'irclickid', 'irgwc',
        // Newegg
        'cm_sp', 'nm_mc', 'cm_mmc',
        // Impact / CJ / Rakuten / Awin / Skimlinks
        'ir_campaignid', 'ir_adid', 'ir_pubid',
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term',
        'utm_content', 'utm_id', 'utm_source_platform',
        'utm_creative_format', 'utm_marketing_tactic',
        'ranmid', 'raneaid', 'ransiteid', 'ranpublisherid',
        'ranlinkid', 'ranadid', 'rancampaignid',
        'awc', 'awinmid', 'awinaffid', 'clickref', 'ued',
        'sld', 'sref', 'srefid',
        // Referral / misc
        'ref', 'referrer', 'source', 'sourceid', 'medium', 'campaign',
        'content', 'term', 'keyword', 'cid', 's_cid', 'ncid', 'icid',
        'cmpid', 'cid', '_openstat', '_trk',
        // Misc analytics
        '_visitor', '_visitorid', '__visitor', '__visitorid',
        '_vid', '_uid', '_uuid', '_guid', '_sid', '_sessionid',
        '_session_id', '_cartid', '_cart_id', '_customerid',
        '_customer_id', '_userid', '_user_id', '_visitorid',
        '_visitor_id', '_gac', '_fplc', '_fbc', '_fbp', '_ttp',
        '_tt_enable_cookie', '_pin_unauth', '_derived_epik', 'epik',
        'ppid', '_y', '_s', '_orig_referrer', '_landing_page',
        // Amazon "ref_" family — safe-listed separately because
        // "ref" alone might be a real parameter on some sites
        'asc_refurl', 'ascsubtag', 'creative', 'creativeasin',
        'linkcode', 'linkid'
    ];

    var TRACKING_PARAM_SET = (function () {
        var seen = {};
        var out = [];
        for (var i = 0; i < TRACKING_LITERALS.length; i++) {
            var k = TRACKING_LITERALS[i].toLowerCase();
            if (!seen[k]) {
                seen[k] = 1;
                out.push(k);
            }
        }
        return out;
    })();

    // ============================================================
    // 2. REDIRECT PARAM NAMES (for nested URL extraction)
    // ============================================================

    var REDIRECT_PARAM_NAMES = [
        'redirect', 'redirect_uri', 'redirect_url', 'redirecturl',
        'next', 'continue', 'return', 'return_to', 'returnurl',
        'goto', 'dest', 'destination',
        'redir', 'url', 'to', 'target', 'link', 'out', 'forward',
        'location', 'back', 'callback', 'successurl', 'failureurl',
        'cancelurl', 'rurl', 'post_logout_redirect_uri', 'relaystate',
        'state', 'u', 'r', 'go', 'landing', 'ref', 'src', 'source'
    ];

    var REDIRECT_WRAPPER_HOSTS = [
        'l.facebook.com', 'lm.facebook.com', 'l.instagram.com',
        'out.reddit.com', 'redirectingat.com',
        'go.skimresources.com', 'go.redirectingat.com'
    ];

    // ============================================================
    // 3. XSS / CMD / SENSITIVE DATA PATTERNS
    // ============================================================

    var XSS_PATTERNS = [
        { pattern: /<script\b/i, label: 'raw <script> tag' },
        { pattern: /<\/script>/i, label: 'closing </script> tag' },
        { pattern: /<iframe\b/i, label: 'raw <iframe> tag' },
        { pattern: /<object\b/i, label: 'raw <object> tag' },
        { pattern: /<embed\b/i, label: 'raw <embed> tag' },
        { pattern: /<svg\b/i, label: 'raw <svg> tag' },
        { pattern: /<img\b[^>]*\bonerror\s*=/i, label: 'img onerror handler' },
        { pattern: /<body\b[^>]*\bonload\s*=/i, label: 'body onload handler' },
        { pattern: /<input\b[^>]*\bonfocus\s*=/i, label: 'input onfocus handler' },
        { pattern: /javascript\s*:/i, label: 'javascript: URI' },
        { pattern: /vbscript\s*:/i, label: 'vbscript: URI' },
        { pattern: /data\s*:\s*text\/html/i, label: 'data:text/html URI' },
        { pattern: /expression\s*\(/i, label: 'CSS expression()' },
        { pattern: /url\s*\(\s*['"]?\s*javascript/i, label: 'CSS url(javascript:)' },
        { pattern: /%3cscript/i, label: 'percent-encoded <script>' },
        { pattern: /%3c%2fscript/i, label: 'percent-encoded </script>' },
        { pattern: /%3ciframe/i, label: 'percent-encoded <iframe>' },
        { pattern: /%3csvg/i, label: 'percent-encoded <svg>' },
        { pattern: /%3cimg/i, label: 'percent-encoded <img>' },
        { pattern: /%6a%61%76%61%73%63%72%69%70%74/i, label: 'fully-encoded javascript' },
        { pattern: /%3c%73%63%72%69%70%74/i, label: 'encoded <script> (letter-by-letter)' },
        { pattern: /%0d%0a/i, label: 'CRLF injection' },
        { pattern: /%0a/i, label: 'LF injection' },
        { pattern: /%0d/i, label: 'CR injection' },
        { pattern: /%6f%6e%65%72%72%6f%72/i, label: 'encoded onerror' },
        { pattern: /%6f%6e%6c%6f%61%64/i, label: 'encoded onload' },
        { pattern: /%6f%6e%66%6f%63%75%73/i, label: 'encoded onfocus' },
        { pattern: /document\.cookie/i, label: 'document.cookie access' },
        { pattern: /document\.location/i, label: 'document.location access' },
        { pattern: /window\.location/i, label: 'window.location access' },
        { pattern: /eval\s*\(/i, label: 'eval() call' },
        { pattern: /settimeout\s*\(\s*['"]/i, label: 'setTimeout with string' },
        { pattern: /setinterval\s*\(\s*['"]/i, label: 'setInterval with string' },
        { pattern: /function\s*\(/i, label: 'Function constructor' },
        { pattern: /\.innerhtml\s*=/i, label: 'innerHTML assignment' },
        { pattern: /\.outerhtml\s*=/i, label: 'outerHTML assignment' },
        { pattern: /\.insertadjacenthtml/i, label: 'insertAdjacentHTML' },
        { pattern: /document\.write/i, label: 'document.write' },
        { pattern: /document\.writeln/i, label: 'document.writeln' },
        { pattern: /window\.open/i, label: 'window.open' },
        { pattern: /location\.href\s*=/i, label: 'location.href assignment' },
        { pattern: /location\.replace/i, label: 'location.replace' },
        { pattern: /location\.assign/i, label: 'location.assign' }
    ];

    var CMD_INJECTION_PATTERNS = [
        { pattern: /\|\|/, label: 'logical OR pipe' },
        { pattern: /&&/, label: 'logical AND pipe' },
        { pattern: /`[^`]*`/, label: 'backtick command substitution' },
        { pattern: /\$\([^)]*\)/, label: 'command substitution $()' },
        { pattern: /\$\{[^}]*\}/, label: 'variable expansion ${}' },
        { pattern: /\bpython\b.*\s-c\s/i, label: 'python -c' },
        { pattern: /\bperl\b.*\s-e\s/i, label: 'perl -e' },
        { pattern: /\bruby\b.*\s-e\s/i, label: 'ruby -e' },
        { pattern: /\bnode\b.*\s-e\s/i, label: 'node -e' },
        { pattern: /\bbash\b.*\s-c\s/i, label: 'bash -c' },
        { pattern: /\bsh\b.*\s-c\s/i, label: 'sh -c' },
        { pattern: /\bcmd\b.*\s\/c\s/i, label: 'cmd /c' },
        { pattern: /\bpowershell\b/i, label: 'powershell invocation' },
        { pattern: /\bwget\b/i, label: 'wget download' },
        { pattern: /\bcurl\b/i, label: 'curl download' },
        { pattern: /\bnc\b\s+-[elp]/i, label: 'netcat listener' },
        { pattern: /\bncat\b/i, label: 'ncat invocation' },
        { pattern: /\.\.\//, label: 'directory traversal ../' },
        { pattern: /\.\.\\/, label: 'directory traversal ..\\' },
        { pattern: /%2e%2e%2f/i, label: 'encoded traversal %2e%2e%2f' },
        { pattern: /%2e%2e\//i, label: 'encoded traversal %2e%2e/' },
        { pattern: /\.\.%2f/i, label: 'encoded traversal ..%2f' },
        { pattern: /%252e%252e/i, label: 'double-encoded traversal' },
        { pattern: /\bexec\b/i, label: 'exec keyword' },
        { pattern: /\bsystem\s*\(/i, label: 'system() call' },
        { pattern: /\bpassthru\s*\(/i, label: 'passthru() call' },
        { pattern: /\bshell_exec\s*\(/i, label: 'shell_exec() call' },
        { pattern: /\bpopen\s*\(/i, label: 'popen() call' },
        { pattern: /\bproc_open\s*\(/i, label: 'proc_open() call' },
        { pattern: /\bdir\b\s+\/s/i, label: 'dir /s command' },
        { pattern: /\bls\b\s+-la/i, label: 'ls -la command' },
        { pattern: /\bcat\b\s+\/etc\//i, label: 'cat /etc/ command' },
        { pattern: /\brm\b\s+-rf/i, label: 'rm -rf command' },
        { pattern: /\bchmod\b\s+/i, label: 'chmod command' },
        { pattern: /\bkill\b\s+-9/i, label: 'kill -9 command' },
        { pattern: /\bps\b\s+-ef/i, label: 'ps -ef command' },
        { pattern: /\bnetstat\b/i, label: 'netstat command' },
        { pattern: /\bifconfig\b/i, label: 'ifconfig command' },
        { pattern: /\bipconfig\b/i, label: 'ipconfig command' },
        { pattern: /\bping\b\s+-[tc]/i, label: 'ping command' }
    ];

    var JWT_REGEX = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;

    var SESSION_COOKIE_REGEX = /(?:^|[?&])(?:session|sessionid|jsessionid|phpsessid|asp\.net_sessionid|connect\.sid|sid|auth|token|access_token|refresh_token|id_token|api_key|apikey|secret|password|passwd|pwd|bearer|authorization)=/i;

    var API_KEY_PATTERNS = [
        { pattern: /sk-[A-Za-z0-9]{20,}/, label: 'OpenAI API key (sk-)' },
        { pattern: /pk_[A-Za-z0-9]{20,}/, label: 'Stripe publishable key (pk_)' },
        { pattern: /sk_live_[A-Za-z0-9]{20,}/, label: 'Stripe live secret key (sk_live_)' },
        { pattern: /rk_live_[A-Za-z0-9]{20,}/, label: 'Stripe restricted key (rk_live_)' },
        { pattern: /AKIA[0-9A-Z]{16}/, label: 'AWS access key ID (AKIA)' },
        { pattern: /ASIA[0-9A-Z]{16}/, label: 'AWS temporary access key (ASIA)' },
        { pattern: /AIza[0-9A-Za-z_-]{35}/, label: 'Google API key (AIza)' },
        { pattern: /ya29\.[0-9A-Za-z_-]+/, label: 'Google OAuth token (ya29.)' },
        { pattern: /ghp_[A-Za-z0-9]{36}/, label: 'GitHub personal access token (ghp_)' },
        { pattern: /gho_[A-Za-z0-9]{36}/, label: 'GitHub OAuth token (gho_)' },
        { pattern: /ghu_[A-Za-z0-9]{36}/, label: 'GitHub user token (ghu_)' },
        { pattern: /ghs_[A-Za-z0-9]{36}/, label: 'GitHub server token (ghs_)' },
        { pattern: /ghr_[A-Za-z0-9]{36}/, label: 'GitHub refresh token (ghr_)' },
        { pattern: /xox[baprs]-[A-Za-z0-9-]+/, label: 'Slack token (xox)' },
        { pattern: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/, label: 'SendGrid API key (SG.)' },
        { pattern: /AC[a-f0-9]{32}/, label: 'Twilio account SID (AC)' },
        { pattern: /SK[a-f0-9]{32}/, label: 'Twilio auth token (SK)' },
        { pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/, label: 'private key block' },
        { pattern: /ssh-rsa\s+AAAA[A-Za-z0-9+/=]+/, label: 'SSH public key' }
    ];

    // ============================================================
    // 4. STATE
    // ============================================================

    var appMapping = {};
    var els = {};

    // ============================================================
    // 5. INIT
    // ============================================================

    function init() {
        els.form = document.querySelector('[data-clean-form]');
        els.input = document.querySelector('[data-clean-input]');
        els.result = document.querySelector('[data-clean-result]');
        els.neutralizeToggle = document.querySelector('[data-neutralize-redirects]');
        if (!els.form || !els.input || !els.result) return;

        els.form.addEventListener('submit', onSubmit);

        loadMapping().then(function () {
            els.form.classList.add('is-ready');
            els.input.disabled = false;
            els.input.focus();
        });
    }

    // ============================================================
    // 6. APP MAPPING
    // ============================================================

    function loadMapping() {
        return fetch('data/app-mapping.json', { cache: 'force-cache' })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                if (data && typeof data === 'object') appMapping = data;
                mergeCustomApps();
            })
            .catch(function () {
                appMapping = {};
                mergeCustomApps();
            });
    }

    function mergeCustomApps() {
        if (!window.PeekSettings || typeof window.PeekSettings.getCustomApps !== 'function') return;
        var custom = window.PeekSettings.getCustomApps();
        for (var domain in custom) {
            if (!Object.prototype.hasOwnProperty.call(custom, domain)) continue;
            appMapping[domain] = custom[domain];
        }
    }

    function getEffectiveRules() {
        // Return an object with { set, patterns } so cleanUrl can check both
        var set = TRACKING_PARAM_SET.slice();
        var patterns = TRACKING_PATTERNS.slice();

        if (window.PeekSettings && typeof window.PeekSettings.getCustomParams === 'function') {
            var custom = window.PeekSettings.getCustomParams();
            custom.forEach(function (pattern) {
                try {
                    patterns.push(new RegExp(pattern, 'i'));
                } catch (e) { /* skip invalid */ }
                // Also treat it as a literal (lowercased)
                if (pattern.indexOf('^') === -1 && pattern.indexOf('$') === -1 &&
                    pattern.indexOf('*') === -1 && pattern.indexOf('(') === -1) {
                    set.push(pattern.toLowerCase());
                }
            });
        }

        return { set: set, patterns: patterns };
    }

    // ============================================================
    // 7. SUBMIT
    // ============================================================

    function onSubmit(e) {
        e.preventDefault();
        mergeCustomApps();

        var raw = (els.input.value || '').trim();
        if (!raw) {
            renderError('Paste a link to clean.');
            return;
        }

        var parsed = parseUrl(raw);
        if (!parsed) {
            renderError("That doesn't look like a link.");
            return;
        }

        var neutralize = els.neutralizeToggle ? els.neutralizeToggle.checked : false;

        var cleaned = cleanUrl(parsed.url, {
            neutralizeRedirects: neutralize,
            redirectMode: 'strip'
        });

        var source = getSource(parsed.url);
        var nestedUrls = extractNestedUrlsRecursive(parsed.url, 3);

        renderResult({
            original: parsed.url.toString(),
            cleaned: cleaned.cleanUrl,
            removed: cleaned.removed,
            sourceName: source ? source.name : null,
            sourceDomain: source ? source.domain : parsed.url.hostname.replace(/^www\./, ''),
            wasPrepended: parsed.wasPrepended,
            hasCredentials: parsed.hasCredentials,
            nestedUrls: nestedUrls
        });
    }

    // ============================================================
    // 8. URL PARSING
    // ============================================================

    function parseUrl(input) {
        var url, wasPrepended = false;

        try {
            url = new URL(input);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                return null;
            }
        } catch (e) {
            if (!looksLikeDomain(input)) return null;
            try {
                url = new URL('https://' + input);
                wasPrepended = true;
            } catch (e2) {
                return null;
            }
        }

        var hasCredentials = false;
        if (url.username || url.password) {
            hasCredentials = true;
            url.username = '';
            url.password = '';
        }

        return {
            url: url,
            wasPrepended: wasPrepended,
            hasCredentials: hasCredentials
        };
    }

    function looksLikeDomain(str) {
        if (!str || /\s/.test(str)) return false;
        if (str.indexOf('.') === -1) return false;
        var hostPart = str.split(/[\/?#]/)[0];
        if (hostPart.indexOf('.') === -1) return false;
        var parts = hostPart.split('.');
        if (parts.length < 2) return false;
        var tld = parts[parts.length - 1];
        if (!/^[a-z]{2,}$/i.test(tld)) return false;
        return true;
    }

    // ============================================================
    // 9. TRAILING DELIMITER NORMALIZATION
    // ============================================================

    function normalizeTrailingDelimiters(urlString) {
        if (!urlString) return urlString;
        var cleaned = urlString.replace(/\?$/, '');
        cleaned = cleaned.replace(/\?&$/, '');
        cleaned = cleaned.replace(/[?&]+$/, '');
        return cleaned;
    }

    // ============================================================
    // 10. TRACKING PARAM STRIPPING
    // ============================================================

    function stripTrackingParams(url, rules) {
        var removed = [];
        var params = url.searchParams;
        var effective = rules || getEffectiveRules();
        var keys = [];

        params.forEach(function (value, key) {
            keys.push(key);
        });

        keys.forEach(function (key) {
            var lower = key.toLowerCase();
            var shouldRemove = effective.set.indexOf(lower) !== -1;

            if (!shouldRemove) {
                for (var i = 0; i < effective.patterns.length; i++) {
                    if (effective.patterns[i].test(key)) {
                        shouldRemove = true;
                        break;
                    }
                }
            }

            if (shouldRemove) {
                removed.push(key);
                params.delete(key);
            }
        });

        return { removed: removed };
    }

    // ============================================================
    // 11. NESTED URL EXTRACTION
    // ============================================================

    function tryDecodeNestedUrl(value) {
        if (!value) return null;

        var candidates = [value];
        for (var i = 0; i < 3; i++) {
            try {
                var last = candidates[candidates.length - 1];
                var decoded = decodeURIComponent(last);
                if (decoded !== last) candidates.push(decoded);
                else break;
            } catch (e) { break; }
        }

        try {
            var plusDecoded = value.replace(/\+/g, ' ');
            if (plusDecoded !== value) candidates.push(plusDecoded);
        } catch (e) { /* ignore */ }

        for (var j = 0; j < candidates.length; j++) {
            var c = candidates[j];
            if (/^https?:\/\//i.test(c) || /^\/\//.test(c) || /^\/[^\/]/.test(c)) {
                try {
                    return new URL(c);
                } catch (e) { /* try next */ }
            }
        }
        return null;
    }

    function extractNestedUrlsRecursive(url, maxDepth) {
        maxDepth = maxDepth || 3;
        var results = [];
        var seen = {};

        function walk(currentUrl, depth) {
            if (depth > maxDepth) return;

            currentUrl.searchParams.forEach(function (value, key) {
                var lower = key.toLowerCase();
                if (REDIRECT_PARAM_NAMES.indexOf(lower) === -1) return;

                var nested = tryDecodeNestedUrl(value);
                if (!nested) return;

                var fingerprint = nested.toString();
                if (seen[fingerprint]) return;
                seen[fingerprint] = 1;

                results.push({
                    param: key,
                    rawValue: value,
                    decodedUrl: nested,
                    depth: depth
                });

                walk(nested, depth + 1);
            });
        }

        walk(url, 1);
        return results;
    }

    // ============================================================
    // 12. OPEN REDIRECT NEUTRALIZATION
    // ============================================================

    function isSuspiciousRedirect(sourceUrl, nestedUrl) {
        var reasons = [];
        var sourceHost = sourceUrl.hostname.toLowerCase().replace(/^www\./, '');
        var nestedHost = nestedUrl.hostname.toLowerCase().replace(/^www\./, '');

        if (nestedHost !== sourceHost) {
            reasons.push('redirects to a different host');
        }
        if (nestedUrl.protocol !== 'http:' && nestedUrl.protocol !== 'https:') {
            reasons.push('non-HTTP(S) scheme: ' + nestedUrl.protocol);
        }
        if (sourceUrl.protocol === 'https:' && nestedUrl.protocol === 'http:') {
            reasons.push('downgrades HTTPS to HTTP');
        }
        if (nestedUrl.username || nestedUrl.password) {
            reasons.push('contains embedded credentials');
        }
        if (REDIRECT_WRAPPER_HOSTS.indexOf(nestedHost) !== -1) {
            reasons.push('points to a known redirect wrapper');
        }

        return {
            suspicious: reasons.length > 0,
            reasons: reasons
        };
    }

    function neutralizeOpenRedirects(url, mode) {
        mode = mode || 'strip';
        var neutralized = [];
        var paramsToHandle = [];

        url.searchParams.forEach(function (value, key) {
            var lower = key.toLowerCase();
            if (REDIRECT_PARAM_NAMES.indexOf(lower) === -1) return;

            var nested = tryDecodeNestedUrl(value);
            if (!nested) return;

            var verdict = isSuspiciousRedirect(url, nested);
            if (verdict.suspicious) {
                paramsToHandle.push({ key: key });
            }
        });

        paramsToHandle.forEach(function (item) {
            neutralized.push(item.key);
            if (mode === 'strip') {
                url.searchParams.delete(item.key);
            } else {
                url.searchParams.set(item.key, '');
            }
        });

        return { neutralized: neutralized };
    }

    // ============================================================
    // 13. THREAT DETECTION (exposed for threat-checker.js)
    // ============================================================

    function detectXss(value) {
        var labels = [];
        if (!value) return { hit: false, labels: labels };
        for (var i = 0; i < XSS_PATTERNS.length; i++) {
            if (XSS_PATTERNS[i].pattern.test(value)) {
                labels.push(XSS_PATTERNS[i].label);
            }
        }
        return { hit: labels.length > 0, labels: labels };
    }

    function detectCommandInjection(value) {
        var labels = [];
        if (!value) return { hit: false, labels: labels };

        var decoded = value;
        try { decoded = decodeURIComponent(value); } catch (e) { /* raw */ }

        for (var i = 0; i < CMD_INJECTION_PATTERNS.length; i++) {
            if (CMD_INJECTION_PATTERNS[i].pattern.test(value) ||
                CMD_INJECTION_PATTERNS[i].pattern.test(decoded)) {
                labels.push(CMD_INJECTION_PATTERNS[i].label);
            }
        }
        return { hit: labels.length > 0, labels: labels };
    }

    function detectSensitiveData(value) {
        var labels = [];
        if (!value) return { hit: false, labels: labels };

        if (JWT_REGEX.test(value)) labels.push('JWT token in URL');
        if (SESSION_COOKIE_REGEX.test(value)) labels.push('session or auth token in URL');

        for (var i = 0; i < API_KEY_PATTERNS.length; i++) {
            if (API_KEY_PATTERNS[i].pattern.test(value)) {
                labels.push(API_KEY_PATTERNS[i].label);
            }
        }

        if (/[?&](?:password|passwd|pwd|secret|token|key)=[^&\s]+/i.test(value)) {
            labels.push('credential-like parameter in query string');
        }

        return { hit: labels.length > 0, labels: labels };
    }

    // ============================================================
    // 14. CLEANING PIPELINE
    // ============================================================

    function cleanUrl(url, options) {
        options = options || {};

        // Step 1: strip tracking
        var rules = getEffectiveRules();
        var trackResult = stripTrackingParams(url, rules);
        var removed = trackResult.removed;

        // Step 2: optionally strip suspicious redirects
        if (options.neutralizeRedirects) {
            var redirectResult = neutralizeOpenRedirects(url, options.redirectMode || 'strip');
            removed = removed.concat(redirectResult.neutralized);
        }

        // Step 3: normalize trailing ? and &
        var cleanUrl = normalizeTrailingDelimiters(url.toString());

        return {
            cleanUrl: cleanUrl,
            removed: removed
        };
    }

    // ============================================================
    // 15. SOURCE DETECTION
    // ============================================================

    function getSource(url) {
        var host = url.hostname.toLowerCase().replace(/^www\./, '');

        if (appMapping[host]) {
            return { name: appMapping[host], domain: host };
        }

        for (var domain in appMapping) {
            if (!Object.prototype.hasOwnProperty.call(appMapping, domain)) continue;
            if (host === domain || host.endsWith('.' + domain)) {
                return { name: appMapping[domain], domain: domain };
            }
        }

        return null;
    }

    // ============================================================
    // 16. RENDERING
    // ============================================================

    function renderError(message) {
        els.result.hidden = false;
        els.result.innerHTML =
            '<div class="clean-error" role="alert">' +
            '<span class="clean-error-icon" aria-hidden="true">⚠</span>' +
            '<span>' + escapeHtml(message) + '</span>' +
            '</div>';
        try {
            document.dispatchEvent(new CustomEvent('bot:failed-clean'));
        } catch (e) { /* ignore */ }
    }

    function renderResult(data) {
        var hasSource = !!data.sourceName;
        var sourceLabel = hasSource ? data.sourceName : data.sourceDomain;
        var iconHtml = window.Icons
            ? window.Icons.get(data.sourceName, data.sourceDomain)
            : '';

        var removedHtml = data.removed.length
            ? '<ul class="clean-removed-list">' +
            data.removed.map(function (p) {
                return '<li><code>' + escapeHtml(p) + '</code></li>';
            }).join('') +
            '</ul>'
            : '<p class="clean-none">No tracking parameters found.</p>';

        var notesHtml = '';
        if (data.wasPrepended) {
            notesHtml += '<p class="clean-note">Added <code>https://</code> to the start.</p>';
        }
        if (data.hasCredentials) {
            notesHtml += '<p class="clean-note clean-note-warn">Removed embedded username/password from the URL.</p>';
        }

        var nestedHtml = '';
        if (data.nestedUrls && data.nestedUrls.length) {
            nestedHtml =
                '<section class="clean-block">' +
                '<h3 class="clean-block-title">Nested URLs found</h3>' +
                '<ul class="clean-nested-list">' +
                data.nestedUrls.map(function (n) {
                    return '<li>' +
                        '<span class="clean-nested-param">' + escapeHtml(n.param) + '</span>' +
                        '<code class="clean-nested-url">' +
                        escapeHtml(n.decodedUrl.toString()) +
                        '</code>' +
                        (n.depth > 1
                            ? '<span class="clean-nested-depth">depth ' + n.depth + '</span>'
                            : '') +
                        '</li>';
                }).join('') +
                '</ul>' +
                '</section>';
        }

        els.result.hidden = false;
        els.result.innerHTML =
            '<article class="clean-card">' +

            '<header class="clean-card-head">' +
            '<div class="clean-source">' +
            iconHtml +
            '<div class="clean-source-text">' +
            '<span class="clean-source-label">Source</span>' +
            '<span class="clean-source-name">' + escapeHtml(sourceLabel) + '</span>' +
            '</div>' +
            '</div>' +
            '</header>' +

            '<section class="clean-block">' +
            '<h3 class="clean-block-title">Cleaned URL</h3>' +
            '<div class="clean-url-row">' +
            '<code class="clean-url" data-clean-url>' + escapeHtml(data.cleaned) + '</code>' +
            '</div>' +
            '<div class="clean-action-row">' +
            '<button type="button" class="btn btn-secondary btn-sm" data-clean-copy>Copy</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-clean-make-code>Make Code</button>' +
            '</div>' +
            '</section>' +

            '<section class="clean-block">' +
            '<h3 class="clean-block-title">Removed</h3>' +
            removedHtml +
            '</section>' +

            nestedHtml +

            (notesHtml ? '<section class="clean-block">' + notesHtml + '</section>' : '') +

            '</article>';

        var copyBtn = els.result.querySelector('[data-clean-copy]');
        if (copyBtn) {
            copyBtn.addEventListener('click', function () {
                copyToClipboard(data.cleaned).then(function (ok) {
                    setCopyState(copyBtn, ok ? 'Copied' : 'Press Ctrl+C');
                });
            });
        }

        var makeCodeBtn = els.result.querySelector('[data-clean-make-code]');
        if (makeCodeBtn) {
            makeCodeBtn.addEventListener('click', function () {
                if (window.CodeGenerator && typeof window.CodeGenerator.open === 'function') {
                    window.CodeGenerator.open(data.cleaned);
                }
            });
        }

        try {
            els.result.dispatchEvent(new CustomEvent('cleaner:rendered', {
                bubbles: true,
                detail: {
                    url: data.cleaned,
                    original: data.original,
                    element: els.result,
                    sourceName: data.sourceName,
                    sourceDomain: data.sourceDomain,
                    nestedUrls: data.nestedUrls
                }
            }));
        } catch (e) { /* ignore */ }
    }

    // ============================================================
    // 17. CLIPBOARD
    // ============================================================

    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).then(function () {
                return true;
            }).catch(function () {
                return fallbackCopy(text);
            });
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
        } catch (e) {
            return false;
        }
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

    // ============================================================
    // 18. PUBLIC API
    // ============================================================

    window.LinkCleaner = {
        parse: parseUrl,
        getSource: getSource,
        submit: function (value) {
            if (!els.input || !els.form) return;
            els.input.value = value;
            els.form.dispatchEvent(new Event('submit', { cancelable: true }));
        },

        // Exposed for threat-checker.js
        stripTrackingParams: function (url) {
            return stripTrackingParams(url, getEffectiveRules());
        },
        extractNestedUrls: extractNestedUrlsRecursive,
        neutralizeOpenRedirects: neutralizeOpenRedirects,
        isSuspiciousRedirect: isSuspiciousRedirect,
        detectXss: detectXss,
        detectCommandInjection: detectCommandInjection,
        detectSensitiveData: detectSensitiveData,
        normalizeTrailingDelimiters: normalizeTrailingDelimiters
    };

    // ============================================================
    // 19. BOOTSTRAP
    // ============================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();