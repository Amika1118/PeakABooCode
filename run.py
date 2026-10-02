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

# ---------------------------------------------------------------
# Config
# ---------------------------------------------------------------

OUTPUT_DIR = os.path.join("assets", "logos")
CDN_BASE = "https://cdn.simpleicons.org"
# Optional color per slug. Leave None for theme-aware monochrome.
# Example for brand colors: {"youtube": "FF0000", "instagram": "E4405F"}
COLORS = {}
RETRY_COUNT = 2
TIMEOUT_SECONDS = 15

# Slug list - filename without .svg
SLUGS = [
    "youtube",
    "instagram",
    "x",
    "facebook",
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
    "spotify",
    "amazon",
    "netflix",
    "twitch",
    "vimeo",
    "apple",
    "google",
    "microsoft",
    "stackoverflow",
    "wikipedia",
    "dropbox",
    "googledrive",
    "googledocs",
    "gmail",
]

# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------

def build_url(slug):
    color = COLORS.get(slug)
    if color:
        return f"{CDN_BASE}/{slug}/{color}"
    return f"{CDN_BASE}/{slug}"


def looks_like_svg(data):
    """Basic sanity check. Simple Icons returns SVG or a 404 page."""
    if not data:
        return False
    head = data[:200].lower()
    return b"<svg" in head


def fetch(url):
    """Fetch a URL. Returns bytes or None."""
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "PeekABooCode-logo-downloader/1.0"},
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
        return resp.read()


def download(slug):
    """Download one slug. Returns 'ok', 'skip', or 'fail'."""
    dest = os.path.join(OUTPUT_DIR, f"{slug}.svg")

    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return "skip"

    url = build_url(slug)

    for attempt in range(1, RETRY_COUNT + 2):
        try:
            data = fetch(url)
            if not looks_like_svg(data):
                print(f"  ✗ {slug}: response is not an SVG (check the slug on simpleicons.org)")
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
            print(f"  ✗ {slug}: unexpected error - {e}")
            return "fail"

    return "fail"

# ---------------------------------------------------------------
# Main
# ---------------------------------------------------------------

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
        print("Failed slugs:")
        for s in results["fail"]:
            print(f"  - {s}")
        print()
        print("Tip: check the exact slug at https://simpleicons.org")
        print("Example: 'googledrive' works, 'google-drive' does not.")
        sys.exit(1)

    print()
    print("All logos in place. Reload the app to see them.")


if __name__ == "__main__":
    main()