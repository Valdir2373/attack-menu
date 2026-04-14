#!/usr/bin/env python3
"""
extract-credentials.py — Extrai credenciais Supabase e Firebase dos resultados do scraper.
"""

import re
import os

SUPABASE_FILE = "scraped_supabase.txt"
SUPABASE_OUT  = "supabase_creds.txt"
FIREBASE_FILE = "scraped_firebase.txt"
FIREBASE_OUT  = "firebase_urls.txt"

# ── Supabase: extrair URL + anon key ─────────────────────────────────────────

SUPABASE_URL_RE = re.compile(r'https?://([a-z0-9\-]+)\.supabase\.co')
SUPABASE_KEY_RE = re.compile(
    r'(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_\-]{50,}\.[a-zA-Z0-9_\-]{20,})'
)

def extract_supabase():
    print("=== Extraindo Supabase ===\n")

    with open(SUPABASE_FILE, "r", errors="replace") as f:
        content = f.read()

    blocks = content.split("----" * 15)
    found = {}  # url_id → set of keys

    for block in blocks:
        urls = SUPABASE_URL_RE.findall(block)
        keys = SUPABASE_KEY_RE.findall(block)

        # Filtrar placeholders
        urls = [u for u in urls if u not in ("abcdefgh", "your-project", "xxx", "yyy")]
        keys = [k for k in keys if "..." not in k and len(k) > 80]

        for url_id in set(urls):
            for key in set(keys):
                if url_id not in found:
                    found[url_id] = set()
                found[url_id].add(key)

    with open(SUPABASE_OUT, "w") as f:
        f.write("# Supabase credentials — url|anon_key\n")
        f.write("# Extraídas pelo GitHubScraper\n")
        count = 0
        for url_id, keys in found.items():
            for key in keys:
                f.write(f"https://{url_id}.supabase.co|{key}\n")
                count += 1

    print(f"  {len(found)} projetos Supabase únicos")
    print(f"  {count} pares URL+key → {SUPABASE_OUT}")

    # Mostrar primeiros 5
    for i, (url_id, keys) in enumerate(list(found.items())[:5]):
        print(f"  [{i+1}] {url_id}.supabase.co ({len(keys)} key(s))")

    return count


# ── Firebase: extrair URLs ────────────────────────────────────────────────────

FIREBASE_URL_RE = re.compile(r'https?://([a-z0-9\-]+)\.firebaseio\.com')
FIREBASE_KEY_RE = re.compile(r'"private_key":\s*"(-----BEGIN.*?-----)"', re.DOTALL)
FIREBASE_PROJECT_RE = re.compile(r'"project_id":\s*"([a-z0-9\-]+)"')

def extract_firebase():
    print("\n=== Extraindo Firebase ===\n")

    with open(FIREBASE_FILE, "r", errors="replace") as f:
        content = f.read()

    blocks = content.split("----" * 15)
    urls = set()
    projects = set()

    for block in blocks:
        found_urls = FIREBASE_URL_RE.findall(block)
        found_projects = FIREBASE_PROJECT_RE.findall(block)

        for u in found_urls:
            if u not in ("your-project", "xxx", "example"):
                urls.add(u)

        for p in found_projects:
            if p not in ("your-project", "example"):
                projects.add(p)

    with open(FIREBASE_OUT, "w") as f:
        f.write("# Firebase URLs e projects\n")
        f.write("# Extraídas pelo GitHubScraper\n")
        for u in sorted(urls):
            f.write(f"https://{u}.firebaseio.com\n")
        f.write("\n# Projects IDs\n")
        for p in sorted(projects):
            f.write(f"{p}\n")

    print(f"  {len(urls)} URLs Firebase únicas")
    print(f"  {len(projects)} project IDs")
    print(f"  → {FIREBASE_OUT}")

    for u in sorted(list(urls))[:5]:
        print(f"  - {u}.firebaseio.com")

    return len(urls)


if __name__ == "__main__":
    sb = extract_supabase()
    fb = extract_firebase()
    print(f"\n=== Total: {sb} Supabase + {fb} Firebase ===\n")
