import os
import sys
from datetime import datetime, timezone
import psycopg2

BASE_URL = os.getenv("BASE_URL", "https://www.appliancepartgeeks.com").rstrip("/")
PG_DSN = os.getenv("PG_DSN")
MIN_COUNT = int(os.getenv("MIN_COUNT", "10"))
OUT_PATH = os.getenv("OUT_PATH", "public/sitemap-offers.xml")

if not PG_DSN:
    print("ERROR: PG_DSN env var is required", file=sys.stderr)
    sys.exit(1)

SQL = f"""
WITH normed AS (
  SELECT
    regexp_replace(lower(coalesce(o.mpn, '')), '[^a-z0-9]', '', 'g') AS mpn_norm,
    o.created_at
  FROM public.offers o
  WHERE o.mpn IS NOT NULL
    AND btrim(o.mpn) <> ''
),
agg AS (
  SELECT
    mpn_norm,
    COUNT(*) AS offer_count,
    MAX(created_at) AS last_seen
  FROM normed
  WHERE mpn_norm <> ''
  GROUP BY mpn_norm
  HAVING COUNT(*) >= %s
)
SELECT mpn_norm, offer_count, last_seen
FROM agg
ORDER BY offer_count DESC, mpn_norm ASC;
"""

def xml_escape(s: str) -> str:
    return (
        s.replace("&", "&amp;")
         .replace("<", "&lt;")
         .replace(">", "&gt;")
         .replace('"', "&quot;")
         .replace("'", "&apos;")
    )

def main():
    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute(SQL, (MIN_COUNT,))
            rows = cur.fetchall()

        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        lines = []
        lines.append('<?xml version="1.0" encoding="UTF-8"?>')
        lines.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')

        for mpn_norm, offer_count, last_seen in rows:
            # Use last_seen if present; otherwise use "now"
            lastmod = (last_seen.strftime("%Y-%m-%dT%H:%M:%SZ") if last_seen else now)
            loc = f"{BASE_URL}/refurb/{mpn_norm}"

            lines.append("  <url>")
            lines.append(f"    <loc>{xml_escape(loc)}</loc>")
            lines.append(f"    <lastmod>{lastmod}</lastmod>")
            lines.append("    <changefreq>daily</changefreq>")
            lines.append("    <priority>0.7</priority>")
            lines.append("  </url>")

        lines.append("</urlset>")

        os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
        with open(OUT_PATH, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")

        print(f"OK: wrote {OUT_PATH} with {len(rows)} URLs (MIN_COUNT={MIN_COUNT})")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
