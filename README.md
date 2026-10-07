# Tales Beneath the Surface: website

Static website for the horror anthology podcast **Tales Beneath the Surface**, built with [Astro](https://astro.build) (static output, TypeScript, plain CSS, no UI framework).

Episodes come from the podcast's RSS feed at build time. Everything else (About text, cast and crew, transcripts, subscribe links, site settings) is Markdown or data files in this repository.

> [!WARNING]
> **Set `SITE_URL` before deploying.** Without it the build uses the placeholder `https://example.com`, so every canonical URL, Open Graph URL, `robots.txt` entry and sitemap entry will point at the wrong domain. The build prints a warning while the placeholder is in use.

## Requirements

- Node.js 24 (current LTS). Astro 7 needs Node 22.12 or newer. `.nvmrc` pins 24, so with nvm you can run `nvm use`.
- npm.

## Running locally

```bash
npm install
cp .env.example .env   # then edit as needed
npm run dev            # http://localhost:4321
npm run build          # production build into dist/
npm run preview        # serve dist/ locally
npm run check          # type-check .astro and .ts files (astro check)
```

The dev server fetches the feed once on start-up and keeps it in memory. Restart the dev server to pick up new episodes.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PODCAST_RSS_URL` | `https://media.rss.com/tales-beneath-the-surface/feed.xml` | Feed URL **or local file path** |
| `SITE_URL` | `https://example.com` (placeholder) | Public URL of the site. **Required for deployment.** |
| `OPTIMIZE_REMOTE_IMAGES` | `true` | Set to `false` to use the original cover image URLs instead of optimised copies (needed for fully offline builds) |

Put them in `.env` locally, or set them in your host's dashboard.

### Feed URL and offline builds

`PODCAST_RSS_URL` can be an `http(s)` URL or a path to a local XML file. Relative paths are resolved from the project root, and `file://` URLs also work:

```bash
curl -o feed.xml https://media.rss.com/tales-beneath-the-surface/feed.xml
PODCAST_RSS_URL=./feed.xml OPTIMIZE_REMOTE_IMAGES=false npm run build
```

Cover art is hosted on `media.rss.com`. Astro downloads and optimises it during the build and caches it in `node_modules/.astro`. On a fresh offline machine, set `OPTIMIZE_REMOTE_IMAGES=false` so the pages link to the original images instead.

How the feed is loaded:

- It is fetched with a 15-second timeout and retried once. If it still cannot be fetched or parsed, **the build fails** with a message saying why.
- Items with no title or no audio enclosure are skipped, and a warning is logged.
- The episode archive lists episodes oldest first. The home page features the first full episode under "Start here" and lists the five most recent. Titles are shown exactly as published. `itunes:episode` is ignored because it does not match the "Episode NN" numbering in the titles.

## Editing content

All content lives in `src/content/` and `src/data/`. It is validated against the schemas in `src/content.config.ts`, so a typo in a frontmatter field fails the build with a clear error.

| What | Where |
| --- | --- |
| Show name, tagline, meta description, fallback cover, social image | `src/data/settings.yaml` |
| About page intro | `src/content/pages/about.md` |
| Cast and crew | `src/content/people/*.md` |
| Transcripts | `src/content/transcripts/*.md` |
| Subscribe links (Subscribe page, home page and footer) | `src/data/subscribe.json` |
| Frozen episode URLs | `src/data/slug-overrides.json` |
| Colours, spacing, type scale | the custom properties at the top of `src/styles/global.css` |

### Site settings

`src/data/settings.yaml` holds `showName`, `tagline` (marked with a TODO for review), `description` (a plain-text copy of the feed's channel description, used for meta tags), `language` and `timeZone`, the `channelImage` fallback cover, and an optional `socialImage`. To use your own share image, put it in `public/` (for example `public/social.png`) and set `socialImage: /social.png`. Otherwise the channel cover is used. Episode pages always use their own cover.

Dates are shown in en-GB format in the Europe/London time zone, for example "31 October 2025".

### Subscribe links

Edit `src/data/subscribe.json`. Links appear **in the order they are listed in the file**, and that order is used on the Subscribe page, the home page and the footer. Each entry needs a unique `id`, a `label` and a `url`. The entry with `"kind": "feed"` is shown as the feed URL in plain text with a Copy button, which appears only when the browser supports the Clipboard API.

### Adding a person

Create `src/content/people/<name-in-lowercase-with-hyphens>.md`:

```markdown
---
name: Jane Doe
role: Voice Actor
groups: [cast]            # cast, crew, or both: [cast, crew]
order: 17                 # sort position within each section
photo: ./photos/jane-doe.jpg   # optional portrait
website: https://janedoe.com   # optional; shown as a link reading "janedoe.com"
links:                    # optional extra links
  - label: Instagram
    url: https://instagram.com/janedoe
---

Optional longer bio in Markdown.
```

Each existing person file already has commented-out `# photo:` and `# website:` lines. To use them, remove the `# ` and fill in the value.

**Portraits.** Put the image in `src/content/people/photos/`, ideally named after the person's file (for example `jane-doe.jpg`). JPEG, PNG and WebP all work. Use a photo at least 200 × 200 pixels. At build time it is cropped to a square, resized and converted to WebP. The crop is anchored to the top of the photo, so a tall head-and-shoulders portrait keeps the face. If a crop cuts off the wrong part, add `photoPosition` set to `center`, `bottom` or `attention`. `attention` automatically keeps the most detailed part of the photo, which is usually the face. People without a photo get a circle with their initials.

**Websites and links.** `website` must be a full URL including `https://`. The link text is the domain name without `www.`. Any other links go under `links` with your own label, and they appear after the website. The Cast and Crew sections on `/about/` are filtered by `groups` and sorted by `order`. A section with nobody in it is left out. A body that contains only the `<!-- TODO: bio -->` comment counts as having no bio.

### Adding a transcript

1. Create `src/content/transcripts/<episode-slug>.md`. The filename must match the episode slug exactly.
2. Optional frontmatter: `speakers` (a list of names shown above the transcript) and `draft`.
3. The transcript goes in the Markdown body.
4. **To publish it, delete the `draft: true` line** (or set `draft: false`). A draft transcript is treated as if it does not exist.

```markdown
---
speakers: [The Narrator, Rachel Acham Seagroatt]
---

**THE NARRATOR:** It began, as these things often do, on the Northern line…
```

Each build logs a warning that lists episodes with no published transcript, and any transcript files that match no episode (which usually means a typo in the filename).

Current episode slugs (as of the latest build; check the build log or `dist/episodes/` for new ones):

```
tales-beneath-the-surface-trailer
between-stone-and-sky-episode-01      ← placeholder transcript (draft)
of-smoke-and-sacrifice-episode-02     ← placeholder transcript (draft)
written-in-lies-and-blood-episode-03  ← placeholder transcript (draft)
i-see-you-you-see-me-episode-04
the-smallest-fracture-episode-05
intermission
a-christmas-message
paid-in-full-episode-06
when-it-rains-episode-07
a-shadowed-fraternity-episode-08
a-vessel-to-be-filled-episode-09
one-more-time-episode-10
your-body-our-temple-episode-11
reality-writes-itself-episode-12
beginnings-episode-13
```

### Slugs and slug overrides

An episode's slug (its URL is `/episodes/<slug>/`) comes from its title: lowercase it, replace `&` with "and", turn each run of other characters into a single hyphen, and trim hyphens from the ends. For example, "Between Stone & Sky: Episode 01" becomes `between-stone-and-sky-episode-01`.

If a title is edited after publication, its slug and URL would change. To keep the old URL, map the episode's `<guid>` (from the feed) to the slug you want in `src/data/slug-overrides.json`:

```json
{
  "b87b6ea4-60f3-4723-84d3-a05e1d7cbeb5": "between-stone-and-sky-episode-01"
}
```

If you change a slug, rename the matching transcript file too. The build fails if two episodes end up with the same slug, or if a slug is purely numeric (it would clash with archive pages such as `/episodes/2/`). The error names the guids to add to the overrides file.

## How new episodes appear

The site is static. A new episode appears only when the site is **rebuilt**. Publish the episode on RSS.com, then trigger a build (see below). No code changes are needed: the episode page, archive pages, home page and sitemap are all regenerated from the feed.

## Deploying

Every host below uses the same settings:

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node version:** 24 (`NODE_VERSION=24`, or the host's Node setting)
- **Environment variables:** `SITE_URL` (required) and optionally `PODCAST_RSS_URL`

### Netlify

1. Add the repository as a new site with the build settings above.
2. Under *Site configuration → Environment variables*, set `SITE_URL` (for example `https://talesbeneaththesurface.com`) and `NODE_VERSION=24`.
3. **Rebuilds:** under *Build & deploy → Build hooks*, create a hook and copy its URL. Anything that sends a `POST` request to that URL starts a rebuild.

### Vercel

1. Import the repository. The Astro preset fills in the build settings. Set the Node.js version to 24 under *Settings → General*.
2. Add `SITE_URL` under *Settings → Environment Variables*.
3. **Rebuilds:** under *Settings → Git → Deploy Hooks*, create a hook and use its URL as above.

### Cloudflare Pages

1. Create a Pages project from the repository with the Astro preset, build command `npm run build` and output directory `dist`.
2. Add `SITE_URL` and `NODE_VERSION=24` as environment variables.
3. **Rebuilds:** under *Settings → Builds & deployments → Deploy hooks*, create a hook.

### Scheduled or webhook-triggered rebuilds

Choose one or both:

- **Scheduled.** Call the deploy hook on a schedule. A daily build is plenty for a weekly show. With GitHub Actions, add `.github/workflows/rebuild.yml`:

  ```yaml
  name: Scheduled rebuild
  on:
    schedule:
      - cron: '0 6 * * *'   # every day at 06:00 UTC
    workflow_dispatch:
  jobs:
    rebuild:
      runs-on: ubuntu-latest
      steps:
        - run: curl -fsS -X POST "${{ secrets.DEPLOY_HOOK_URL }}"
  ```

  Store the hook URL as the repository secret `DEPLOY_HOOK_URL`. Netlify's scheduled functions or Cloudflare Cron Triggers can call the hook in the same way.

- **Webhook.** If your podcast host or an automation tool (Zapier, Make, IFTTT, and so on) can call a URL when an episode is published, point it at the deploy hook. Free automation tools usually do this with an "RSS feed has a new item" trigger and a "send webhook (POST)" action.

## Project structure

```
src/
  content.config.ts        content collection schemas
  content/
    pages/about.md         About intro
    people/*.md            cast and crew
    transcripts/*.md       transcripts (filename = episode slug)
  data/
    settings.yaml          site settings
    subscribe.json         subscribe links (ordered)
    slug-overrides.json    guid → slug overrides
  lib/
    feed.ts                fetch, parse, memoise and normalise the RSS feed
    slug.ts                slug helper
    html.ts                show-notes sanitising and excerpts
    format.ts              en-GB dates, durations, timestamps
    transcripts.ts         transcript lookup and coverage warnings
    site.ts                settings and subscribe-link helpers
  layouts/BaseLayout.astro shared <head> (SEO, Open Graph, Twitter), header and footer
  components/              header, footer, cover, player, cards, people, pagination
  pages/                   /, /episodes/[...page], /episodes/[slug], /about, /subscribe, 404, robots.txt
  styles/global.css        design tokens and base styles
public/favicon.svg
```

## Notes

- No analytics, tracking scripts, cookies or third-party fonts. The site uses system fonts only.
- JavaScript is used only for two small enhancements: the feed URL Copy button, and opening the transcript when the URL ends in `#transcript`.
- Show notes are sanitised with `sanitize-html`. Links are kept and given `rel="noopener noreferrer"`, and `target="_blank"` from the feed is removed so links open in the same tab.
- Inline `psc:chapters` are shown as a chapter list. `podcast:chapters` JSON URLs are ignored.
