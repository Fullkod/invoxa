---
name: tf-add-mobile
description: "Add installable PWA behavior and optional browser push to an existing web application."
---

# Add Mobile

Read [GUIDE.md](GUIDE.md) for manifest, service worker, push and platform gotchas. A PWA is not a native mobile app. Push requires consent, secure contexts and platform support.
Inspect caching and auth boundaries. Do not cache private responses across users. Verify offline fallback, cache updates, install metadata and logout. Check target-browser support before promising iOS push. Keep VAPID private keys server-side. Test permission denial and expired subscriptions.
