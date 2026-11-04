---
name: tf-add-payments
description: "Implement Polar checkout, subscriptions, webhooks and server-side entitlements in projects using Polar."
---

# Add Payments

Read [GUIDE.md](GUIDE.md) for the Polar/Supabase recipe. Preserve existing billing providers unless migration is requested. Establish sandbox versus production, products and entitlement rules from actual configuration.
Verify raw-body webhook signatures, repeated/out-of-order events and server-derived access. Never grant entitlements from a success-page URL. Use stable identifiers and unique constraints. Test sandbox checkout, replay, cancellation and access denial. Verify SDK event types against the installed version.
