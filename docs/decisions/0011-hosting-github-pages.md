# 0011. Hosting: GitHub Pages from main, repo renamed ancoras

- **Date:** 2026-10-10
- **Status:** accepted (decided by Jim with the advisor, #32)

## Context
The app is a static site (decision 0001) and Jim wants it on his phone. SPEC §10 left the
host open. Saved progress lives in the browser per address (decision 0009), so the address
should be settled before anyone has progress on it.

## Decision
- **Rename the repo from TVFpractice to `ancoras` first,** then publish. This is the only
  moment no one's progress is tied to an address. The local folder keeps its name
  (TVFpractice) and the `.claude-account` marker is unchanged.
- **Publish with GitHub Pages from the `main` branch, root folder, no build step,** at
  https://jamminalley.github.io/ancoras/. An empty `.nojekyll` makes Pages serve files
  exactly as they are.
- **Phone polish:** a web app manifest (`manifest.webmanifest`, standalone display) and
  home-screen icons (`icons/icon-192.png`, `icons/icon-512.png`), all with relative paths.
  No service worker.
- **The repo stays private.**

Reasons: no new accounts or services; pushing to `main` is the deploy; the repo stays
private; the address is chosen before anyone has progress on it.

## Consequences
- **The site is public to anyone with the address, and so is every file in the repo**
  (notes, docs, tests, settings files), not only the app. Checked before publishing: nothing
  secret; Jim chose to publish everything rather than only the app files.
- **Progress on the live address is separate from localhost:4791.** Use Export progress on
  one and Import progress on the other to move it.
- **Sharing the app is sharing the link.** Each person's progress stays in their own
  browser; nothing is collected.
- Pushing anything to `main` publishes it within about a minute, so tests and the data check
  should pass before every push.
