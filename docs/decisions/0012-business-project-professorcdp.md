# 0012. Business project, repo under professorcdp

- **Date:** 2026-10-11
- **Status:** accepted (decided by Jim with the advisor, #33; public repo decided by Jim)

## Context
Âncoras is becoming a business project. Saved progress is tied to the site address
(decision 0009) and only Jim's first few sessions exist, so this is the moment to move it.

## Decision
- **Move the repo to the professorcdp organization** (`ancoras`), so the site is
  https://professorcdp.github.io/ancoras/.
- **Restamp the folder BUSINESS** (`claude-stamp business .`), so Claude usage for this
  project is billed to the business account.
- **Make the repo public.** The plan was to keep it private, but after the transfer GitHub
  refused to build the site: professorcdp is on GitHub's free plan, which doesn't include
  Pages for private repos (Jim's personal account does). Jim chose to make the repo public
  rather than upgrade the organization or host elsewhere.
- **Before going public, hide the personal email:** a scan of the whole history and the
  issues found no secrets; the only personal item was jmranalli@yahoo.com as author of all 21
  commits. The history was rewritten to use the GitHub noreply address (content unchanged,
  commit IDs changed; see docs/commit-id-map.md), and this clone now commits with it.

Reasons: the app will be shared under the business name, so the address should carry it, and
the Claude usage should be billed to the business account.

## Consequences
- The old address (jamminalley.github.io/ancoras) and any progress saved on it are gone; that
  was only Jim's first sessions.
- The site, the source, the history and the issues are all public. Sharing the app is
  sharing the link; each person's progress stays in their own browser.
- Commit IDs before 2026-10-11 changed; docs/commit-id-map.md maps the old IDs used in the
  runlog to the new ones.
- GitHub still serves the old (pre-rewrite) commits by ID, and some issue timelines link
  them, so the old email remains reachable until GitHub Support purges them.
