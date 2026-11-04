---
name: tf-tasknic
description: "Use a configured Tasknic Agent API for tasks, comments, attachments, project knowledge and administration."
---

# Tasknic

Require TASKNIC_API_URL and TASKNIC_API_KEY in the environment. No fixed tenant or assumed admin identity is included. Discover current routes and payloads through GET of the API index. Verify the inherited [contract summary](references/api-contract.md) against this instance.
Use [tasknic.py](scripts/tasknic.py) with --method, --path and optional --body-file. It accepts relative API paths, rejects traversal/absolute URLs and does not redirect credentials. GET is read-only; other methods require --apply after user authorization. Errors omit provider bodies and keys. Mutations are not retried automatically.
Determine requested_by from this conversation when needed; never reuse a template identity. Discover permissions, never claim admin by default. Tasks/comments/invitations/attachments can notify people; send only when explicitly requested or authorized. Reading tasks does not authorize replies. Resolve ambiguous targets first. Report verified results without promising unverified notification delivery.
