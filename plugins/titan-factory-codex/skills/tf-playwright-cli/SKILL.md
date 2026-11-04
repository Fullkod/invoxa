---
name: tf-playwright-cli
description: "Verify browser behavior, reproduce UI bugs and collect QA evidence with browser tools or Playwright Test."
---

# Playwright Cli

Identify the flow, expected result, target URL and safe test data. Prefer the available browser integration and follow its instructions. For repositories with Playwright Test use their installed version and configuration. Do not assume a browser MCP is connected.

Real commands include `npx playwright test tests/example.spec.ts`; consult `npx playwright --help` when unsure. Interactive actions belong in browser tools or tests using page.goto(), getByRole(), fill(), click() and expect(), not standalone navigate/click/fill commands of the ordinary playwright package.

Prefer semantic locators and observable assertions. A screenshot alone does not verify auth, DB writes or permissions. Reproduce regressions and retain useful tests; do not add tests solely to mirror trivial changes.

Capture focused evidence in .titan/qa/<run>/ when useful. Record behavior, failures and blocked coverage without secrets. Provision only authorized test data. Missing servers or credentials are blockers, not passing checks.

Reference: https://playwright.dev/docs/test-cli . Verify the installed command surface.
