---
name: tf-add-emails
description: "Add Resend and React Email transactional templates, delivery handling and appropriate unsubscribe flows."
---

# Add Emails

Read [GUIDE.md](GUIDE.md) for examples. Reuse the existing provider. Separate transactional and marketing semantics; apply unsubscribe behavior appropriate to the message.
Keep keys server-side, validate payloads, avoid duplicate sends on retries and surface delivery errors. Preview representative templates before sending. Use approved test recipients. Creating email code does not authorize contacting real people; send only within the user's explicit communication request.
