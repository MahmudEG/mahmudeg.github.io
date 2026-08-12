# mahmudeg.github.io

Personal site and technical blog of **Mahmud Elgoueri** — systems and hybrid infrastructure
engineer (Windows Server, Active Directory, Azure & Entra ID).

- **Landing page** → <https://mahmudeg.github.io>
- **Blog** → <https://mahmudeg.github.io/blog>

## How it's built

One repository serves two sites from the same domain.

**The blog** is [Jekyll](https://jekyllrb.com) 4.4.1 with the
[Chirpy](https://github.com/cotes2020/jekyll-theme-chirpy) theme 7.2.4, built with a
`baseurl` of `/blog`. Posts are Markdown in `_posts/`.

**The landing page** (`landing/`) is hand-written HTML, CSS, and vanilla JavaScript — no
framework, no build step. It has two modes:

- **noob** — the full UI, with an animated [three.js](https://threejs.org) particle scene
  and scroll-reveal motion.
- **pro** — a Kali-style terminal that reads the same content through typed commands
  (`help`, `whoami`, `skills`, `posts`, …).

Both modes pull the latest posts from the blog's own `search.json` index at runtime, so
publishing a post updates the landing page with no edits to it.

**Deployment** is a GitHub Actions workflow (`.github/workflows/pages-deploy.yml`) on every
push to `main`: Jekyll builds into `_site/blog`, then `tools/assemble-site.sh` copies the
landing page to the site root, generates a redirect stub for every URL from before the blog
moved under `/blog`, and writes the sitemap index. GitHub Pages serves the result.

Structured data (schema.org JSON-LD), `robots.txt`, `llms.txt`, and the sitemaps are
maintained for search engines and AI answer engines.

## Local development

```bash
bundle install
bundle exec jekyll s          # blog only, at http://127.0.0.1:4000/blog
```

To preview the assembled site exactly as deployed:

```bash
bundle exec jekyll b -d _site/blog && bash tools/assemble-site.sh _site
```

## License

Content © Mahmud Elgoueri. Theme under [MIT](LICENSE).
