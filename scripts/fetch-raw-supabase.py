#!/usr/bin/env python3
"""
fetch-raw-supabase.py — Baixa arquivos raw do GitHub para extrair chaves Supabase completas.
"""

import re
import time
import urllib.request
import urllib.error

SUPABASE_FILE = "scraped_supabase.txt"
OUTPUT = "supabase_creds.txt"

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0"

LINK_RE = re.compile(r'LINK: (https://github\.com/[^\s]+)')
SUPABASE_URL_RE = re.compile(r'https?://([a-z0-9\-]+)\.supabase\.co')
SUPABASE_KEY_RE = re.compile(
    r'(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_\-]{50,}\.[a-zA-Z0-9_\-]{20,})'
)


def blob_to_raw(url: str) -> str:
    """Converte URL blob do GitHub para URL raw."""
    return url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/")


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        return ""


def main():
    print("=== Baixando raw files para Supabase credentials ===\n")

    with open(SUPABASE_FILE, "r", errors="replace") as f:
        content = f.read()

    links = list(set(LINK_RE.findall(content)))
    print(f"  {len(links)} links únicos encontrados\n")

    found = {}  # url_id → set of keys
    fetched = 0

    for i, link in enumerate(links):
        # Só processar links que parecem ter conteúdo Supabase
        raw_url = blob_to_raw(link.split("#")[0])  # Remove #L123

        if fetched >= 30:
            print(f"\n  Limite de 30 downloads atingido")
            break

        raw = fetch(raw_url)
        fetched += 1

        if not raw:
            continue

        urls = SUPABASE_URL_RE.findall(raw)
        keys = SUPABASE_KEY_RE.findall(raw)

        urls = [u for u in urls if u not in ("abcdefgh", "your-project", "xxx")]
        keys = [k for k in keys if len(k) > 100]  # JWT real tem 200+ chars

        if urls and keys:
            for url_id in set(urls):
                for key in set(keys):
                    if url_id not in found:
                        found[url_id] = set()
                    found[url_id].add(key)
                    print(f"  [{len(found)}] {url_id}.supabase.co  key={key[:40]}...")

        # Rate limit gentle
        if fetched % 5 == 0:
            time.sleep(1)

    with open(OUTPUT, "w") as f:
        f.write("# Supabase credentials — url|anon_key\n")
        count = 0
        for url_id, keys in found.items():
            for key in keys:
                f.write(f"https://{url_id}.supabase.co|{key}\n")
                count += 1

    print(f"\n  Total: {count} credenciais de {len(found)} projetos → {OUTPUT}")


if __name__ == "__main__":
    main()
