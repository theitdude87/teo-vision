# Deploying Teo Vision to Netlify

## What gets published

Only the **`site/`** folder. Everything else in this project is source material
and must stay off the web.

```
site/                     <- this is the website
  index.html
  img/                    <- 30 WebP images
  favicon.svg / .ico
  apple-touch-icon.png
  og-image.png            <- link preview card
  robots.txt
  _headers                <- security headers

assets-src/               <- PNG originals of everything in site/img (not published)
teo-vision.backup.html    <- pre-edit copy, do not publish
*.png (project root)      <- your Figma exports, do not publish
netlify.toml              <- tells Netlify to publish `site/`
```

## Option A — drag and drop (fastest)

1. Go to <https://app.netlify.com/drop>
2. Drag the **`site`** folder onto the page.
3. Done. Netlify gives you a URL like `random-name-123.netlify.app`.

Drag the `site` folder itself — not the project folder, or you will publish the
Figma exports and the backup HTML along with it.

## Option B — connect Git (better: redeploys on every push)

1. Push this whole project to GitHub.
2. Netlify → **Add new site → Import an existing project** → pick the repo.
3. Leave the build command empty. Publish directory: **`site`**
   (`netlify.toml` already sets this, so it should be filled in for you.)

## After it is live

**1. Set your custom domain** — Site configuration → Domain management.
HTTPS is issued automatically and is free.

**2. Fix the link-preview image.** In `site/index.html` change:

```html
<meta property="og:image" content="/og-image.png" />
```

to your real domain:

```html
<meta property="og:image" content="https://teovision.com/og-image.png" />
```

WhatsApp, Facebook and X need an absolute URL here. Everything else on the page
works fine with relative paths.

**3. Hook up the contact form.** It currently does nothing — the submit handler
is `return false`. On Netlify the easiest fix is to add `netlify` and a name to
the `<form>` tag and remove the `onsubmit`:

```html
<form class="contact__form" name="contact" method="POST" data-netlify="true">
```

Submissions then show up under **Forms** in the Netlify dashboard.

## Page weight

About **660 KB** total (59 KB HTML + ~600 KB images). Images are WebP, which
every browser since 2020 supports. The PNG originals are in `assets-src/` if you
ever need them back.

## Replacing an image later

Put the new file in `assets-src/`, convert it to WebP into `site/img/` under the
same name, and redeploy. Keeping the filename means nothing else has to change.
