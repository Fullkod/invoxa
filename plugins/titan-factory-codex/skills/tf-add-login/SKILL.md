---
name: tf-add-login
description: "Implement or extend Supabase authentication, sessions, profiles and access control in a Next.js app."
---

# Add Login

Inspect existing routes and clients. Implement requested methods: email/password, OAuth, recovery or profiles. Reuse existing auth. Read [GUIDE.md](GUIDE.md) for the complete recipe, adapting proxy/middleware naming to the installed Next.js version.
Validate redirects, email confirmation, server identity and profile ownership. Never accept user-supplied privileged role fields. Test signed-out, signed-in and cross-user behavior. OAuth is optional; do not add or forbid it merely because of a template. Regenerate database types from the real schema when possible.
