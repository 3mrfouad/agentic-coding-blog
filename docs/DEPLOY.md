# Deploying to Cloudflare Pages

This project is a **static site**: `npm run build` produces plain HTML, CSS, and
JavaScript in `dist/`, with no server or database. Cloudflare Pages is a good host for
it: fast, free, a preview URL for every pull request, and easy custom domains.

## Before you start

1. Push the project to a GitHub (or GitLab) repository.
2. Set `repoUrl` and `storyUrl` in `src/data/site.json` to your real links.

## 1. Connect the repository

- Sign in at [dash.cloudflare.com](https://dash.cloudflare.com), or create a free account.
- In the sidebar: **Compute (Workers & Pages)** -> **Create** -> **Pages** tab -> **Connect to Git**.
- Authorize Cloudflare and select your repository.

## 2. Build settings

| Setting | Value |
|---|---|
| Framework preset | Vite (or "None") |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | leave as default (`/`) |

`npm run build` runs the data check (`npm run check`) first, so a bad data file fails
the build with a clear message instead of shipping.

## 3. Environment variable

Add one variable so Cloudflare uses a current Node:

| Variable name | Value |
|---|---|
| `NODE_VERSION` | `20` |

## 4. Deploy

- Click **Save and Deploy**. The first build runs `npm install`, then `npm run build`.
- When it finishes, the site is live at `https://<project-name>.pages.dev`.

## After that, it is automatic

- Every push to your main branch deploys to the live URL.
- Every pull request gets its own preview URL, so you can review a change before merging.

## Custom domain (optional)

- Open your Pages project -> **Custom domains** -> **Set up a domain**, and enter it.
- If your domain's DNS is on Cloudflare, the record is added for you. Otherwise, add the
  `CNAME` record they show you at your DNS provider.

## Good to know

- `base: "./"` is already set in `vite.config.js`, so the site works at both the
  `.pages.dev` address and a custom domain with no change.
- The hash routes (`#/explore`, `#/library`) need no server rewrites, so there is nothing
  extra to configure for routing.
- `.github/workflows/deploy.yml` is only for GitHub Pages. With Cloudflare you can delete
  it, or keep it, since it also runs the data check on pull requests.
- If a build fails, open the deployment in the dashboard and read the log. The most common
  cause is a data error, which `npm run check` names exactly. You can run `npm run check`
  locally before pushing to catch it early.

## Alternatives

Netlify and Vercel work the same way, with the same build command (`npm run build`) and
output folder (`dist`). GitHub Pages is also set up already via the workflow file; use it
if you would rather keep everything on GitHub.

## Custom domain: agenticcoding.blog

The repo is set up for this domain:

- `public/CNAME` contains `agenticcoding.blog` and is copied into every build.
- `vite.config.js` uses `base: "/"` (served from the root).
- `index.html` sets the canonical URL and social-preview tags to `https://agenticcoding.blog`.

### DNS

At whoever manages DNS for `agenticcoding.blog`:

- **Cloudflare Pages:** in the Pages project, open **Custom domains** -> **Set up a domain**,
  enter `agenticcoding.blog` (and optionally `www`). If the domain's DNS is on Cloudflare, the
  records are added automatically. Otherwise add the `CNAME` target they show you.
- **GitHub Pages:** add the four `A` records (and four `AAAA` records) for GitHub Pages, or a
  `CNAME` record pointing `www` at `<your-user>.github.io`. Then set the domain under
  **Settings -> Pages** and enable **Enforce HTTPS** once the certificate is issued.

### Redirect www to the root (optional)

Pick the root (`agenticcoding.blog`) as canonical and redirect `www` to it, or vice versa.
On Cloudflare this is a one-line Redirect Rule; on GitHub Pages add the `www` host as a second
custom domain and it redirects automatically.
