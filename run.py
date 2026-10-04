#!/usr/bin/env python3
"""
download_logos.py
Download PeekABooCode app logos from Simple Icons (simpleicons.org).
Run once from the project root:

    python3 download_logos.py

Creates assets/logos/ and fills it with SVGs.
Standard library only. No pip install needed.
"""

import os
import sys
import time
import urllib.request
import urllib.error

OUTPUT_DIR = os.path.join("assets", "logos")
CDN_BASE = "https://cdn.simpleicons.org"
COLORS = {}
RETRY_COUNT = 2
TIMEOUT_SECONDS = 15

SLUGS = [
    # ---------- AI / LLM ----------
    "openai",
    "anthropic",
    "googlegemini",
    "githubcopilot",
    "perplexity",
    "huggingface",
    "ollama",
    "mistralai",
    "cohere",
    "replicate",
    "stabilityai",
    "suno",
    "elevenlabs",
    "runway",
    "cursor",
    "deepseek",

    # ---------- Big tech / social ----------
    "youtube",
    "youtubemusic",
    "instagram",
    "x",
    "facebook",
    "messenger",
    "tiktok",
    "linkedin",
    "reddit",
    "github",
    "medium",
    "pinterest",
    "snapchat",
    "whatsapp",
    "telegram",
    "discord",
    "apple",
    "google",
    "microsoft",
    "amazon",
    "netflix",
    "twitch",
    "vimeo",
    "spotify",
    "stackoverflow",
    "stackexchange",
    "wikipedia",
    "dropbox",
    "googledrive",
    "googledocs",
    "gmail",
    "googlecloud",

    # ---------- Asian video / streaming ----------
    "bilibili",
    "iqiyi",
    "youku",
    "douban",
    "kuaishou",
    "naver",
    "line",
    "kakaotalk",
    "wechat",

    # ---------- Messaging / communication ----------
    "slack",
    "zoom",
    "signal",
    "viber",
    "skype",
    "microsoftteams",

    # ---------- Productivity / work ----------
    "notion",
    "figma",
    "linear",
    "asana",
    "trello",
    "mondaydotcom",
    "airtable",
    "miro",
    "canva",
    "framer",
    "webflow",
    "squarespace",
    "atlassian",
    "jira",
    "confluence",

    # ---------- Developer tools ----------
    "visualstudiocode",
    "jetbrains",
    "intellijidea",
    "vim",
    "neovim",
    "sublimetext",
    "postman",
    "gitlab",
    "bitbucket",
    "devdotto",
    "hashnode",
    "ycombinator",
    "producthunt",

    # ---------- Cloud / hosting ----------
    "cloudflare",
    "amazonwebservices",
    "digitalocean",
    "vercel",
    "netlify",
    "heroku",
    "supabase",
    "firebase",
    "mongodb",
    "postgresql",
    "mysql",
    "redis",
    "docker",
    "kubernetes",
    "nginx",
    "apache",
    "railway",
    "render",

    # ---------- Finance / crypto ----------
    "stripe",
    "paypal",
    "wise",
    "revolut",
    "coinbase",
    "binance",
    "kraken",
    "metamask",
    "trustwallet",

    # ---------- Commerce ----------
    "shopify",
    "ebay",
    "etsy",
    "walmart",
    "target",
    "bestbuy",
    "aliexpress",
    "alibabacom",
    "daraz",

    # ---------- Music / audio / video ----------
    "soundcloud",
    "bandcamp",
    "deezer",
    "tidal",
    "shazam",
    "audible",
    "goodreads",
    "imdb",

    # ---------- Gaming ----------
    "steam",
    "epicgames",
    "playstation",
    "xbox",
    "nintendo",
    "roblox",
    "minecraft",

    # ---------- Travel / transport ----------
    "uber",
    "ubereats",
    "lyft",
    "bolt",
    "doordash",
    "grubhub",
    "airbnb",
    "bookingdotcom",
    "expedia",
    "tripadvisor",

    # ---------- Education ----------
    "duolingo",
    "coursera",
    "udemy",
    "khanacademy",
    "skillshare",
    "brilliant",

    # ---------- News / media ----------
    "bbc",
    "cnn",
    "nytimes",
    "theguardian",
    "reuters",
    "bloomberg",
    "theverge",
    "techcrunch",
    "wired",
    "arstechnica",

    # ---------- Search ----------
    "duckduckgo",
    "brave",
    "yandex",
    "baidu",
]

# Deduplicate while preserving order
_seen = set()
SLUGS = [s for s in SLUGS if not (s in _seen or _seen.add(s))]


def build_url(slug):
    color = COLORS.get(slug)
    if color:
        return f"{CDN_BASE}/{slug}/{color}"
    return f"{CDN_BASE}/{slug}"


def looks_like_svg(data):
    if not data:
        return False
    head = data[:200].lower()
    return b"<svg" in head


def fetch(url):
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "PeekABooCode-logo-downloader/1.0"},
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
        return resp.read()


def download(slug):
    dest = os.path.join(OUTPUT_DIR, f"{slug}.svg")
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return "skip"

    url = build_url(slug)

    for attempt in range(1, RETRY_COUNT + 2):
        try:
            data = fetch(url)
            if not looks_like_svg(data):
                print(f"  ✗ {slug}: not an SVG (check the slug)")
                return "fail"
            with open(dest, "wb") as f:
                f.write(data)
            return "ok"
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(f"  ✗ {slug}: not found on Simple Icons (404)")
                return "fail"
            if attempt <= RETRY_COUNT:
                time.sleep(0.8)
                continue
            print(f"  ✗ {slug}: HTTP {e.code}")
            return "fail"
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt <= RETRY_COUNT:
                time.sleep(0.8)
                continue
            print(f"  ✗ {slug}: {e}")
            return "fail"
        except Exception as e:
            print(f"  ✗ {slug}: {e}")
            return "fail"

    return "fail"


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"Downloading {len(SLUGS)} logos to {OUTPUT_DIR}/")
    print("-" * 48)

    results = {"ok": [], "skip": [], "fail": []}

    for slug in SLUGS:
        status = download(slug)
        results[status].append(slug)
        if status == "ok":
            print(f"  ✓ {slug}.svg")
        elif status == "skip":
            print(f"  · {slug}.svg (already exists)")

    print("-" * 48)
    print(f"Done.  ok: {len(results['ok'])}  "
          f"skipped: {len(results['skip'])}  "
          f"failed: {len(results['fail'])}")

    if results["fail"]:
        print()
        print("Failed slugs (safe to ignore — the app falls back to emoji):")
        for s in results["fail"]:
            print(f"  - {s}")
        print()
        print("Tip: verify slugs at https://simpleicons.org")


if __name__ == "__main__":
    main()