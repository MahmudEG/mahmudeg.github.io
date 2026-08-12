#!/usr/bin/env bash
# Assemble the deployed site:
#   _site/            ← landing page (from landing/)
#   _site/blog/       ← Jekyll build of the blog (baseurl "/blog")
#   _site/<old-path>/ ← redirect stub for every page that used to live at the
#                       site root, so no existing link, share, or search
#                       result ever 404s.
#
# Usage: tools/assemble-site.sh [SITE_DIR]   (default: _site)
set -euo pipefail

SITE="${1:-_site}"
ORIGIN="https://mahmudeg.github.io"

[ -d "$SITE/blog" ] || { echo "error: $SITE/blog not found — build Jekyll with -d $SITE/blog first" >&2; exit 1; }

# 1. Landing page at the root
cp -r landing/. "$SITE/"

# 2. Redirect stubs: every /blog/**/index.html gets a stub at the old root path
stub_count=0
while IFS= read -r f; do
  rel="${f#"$SITE"/blog/}"          # e.g. posts/foo/index.html
  dir="$(dirname "$rel")"           # e.g. posts/foo
  case "$dir" in
    .|assets|assets/*|404*) continue ;;   # skip blog home, assets, 404
  esac
  target="/blog/$dir/"
  mkdir -p "$SITE/$dir"
  cat > "$SITE/$dir/index.html" <<EOF
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>Redirecting…</title>
<link rel="canonical" href="$ORIGIN$target">
<meta http-equiv="refresh" content="0; url=$target">
<meta name="robots" content="noindex">
</head><body><p>This page has moved to <a href="$target">$ORIGIN$target</a>.</p></body></html>
EOF
  stub_count=$((stub_count + 1))
done < <(find "$SITE/blog" -name index.html)

# 3. Compatibility copies at old root paths
cp "$SITE/blog/feed.xml" "$SITE/feed.xml"                       # old feed subscribers
mkdir -p "$SITE/assets/img"
cp "$SITE/blog/assets/Profileimage.jpg" "$SITE/assets/" 2>/dev/null || true   # old og:image refs
cp -r "$SITE/blog/assets/img/favicons" "$SITE/assets/img/" 2>/dev/null || true
# NOTE: robots.txt at the root comes from landing/robots.txt (copied in step 1).
# The blog's own /blog/robots.txt is ignored by crawlers — only the origin root counts.

# 4. Sitemaps. Jekyll only knows about the blog, so the landing page needs its own
# sitemap, and a sitemap index at the root ties both together for search engines.
TODAY="$(date -u +%Y-%m-%d)"

cat > "$SITE/sitemap-pages.xml" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>$ORIGIN/</loc>
    <lastmod>$TODAY</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
EOF

cat > "$SITE/sitemap.xml" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>$ORIGIN/sitemap-pages.xml</loc>
    <lastmod>$TODAY</lastmod>
  </sitemap>
  <sitemap>
    <loc>$ORIGIN/blog/sitemap.xml</loc>
    <lastmod>$TODAY</lastmod>
  </sitemap>
</sitemapindex>
EOF

echo "assembled: landing at /, blog at /blog, $stub_count redirect stubs, sitemap index"
