# Release checklist

Before the first public deploy, set the three values that are placeholders in the repo.

## 1. Fill in your links (`src/data/site.json`)

- `repoUrl` -> your GitHub repo, e.g. `https://github.com/your-user/agenticcodingblog`
- `storyUrl` -> your Substack article (or delete the line to hide the "Why I built this" link)
- `url` is already set to `https://agenticcoding.blog`

Run `npm run check` after editing; it validates these.

## 2. Push to GitHub

```bash
git init
git add -A
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-user/agenticcodingblog.git
git push -u origin main
```

## 3. Deploy

Follow [DEPLOY.md](DEPLOY.md). In short, for Cloudflare Pages:
build command `npm run build`, output `dist`, and `NODE_VERSION=20`.

## 4. Point the domain

Add `agenticcoding.blog` as a custom domain on your host and update DNS (see DEPLOY.md).
`public/CNAME` is already in the repo, so the domain survives every build.

## 5. Replace the preview image (optional)

`public/preview.png` is the social-share image (`og:image`). Swap it for a cleaner shot if
you like; keep the filename, or update the paths in `index.html`.

## Verify after deploy

- Home, Explore, Library, News all load.
- A shared deep link like `https://agenticcoding.blog/#/library` opens the right page.
- Light and dark themes both look right.
- `https://agenticcoding.blog/robots.txt` and `/sitemap.xml` resolve.
