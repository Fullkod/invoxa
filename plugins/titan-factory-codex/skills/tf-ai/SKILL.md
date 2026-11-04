---
name: tf-ai
description: "Add application AI features such as chat, extraction, RAG, vision, tools or streaming UI."
---

# Ai

Inspect provider, SDK version, server boundaries, auth and data access. Preserve the chosen provider. Next.js + Supabase is preferred; OpenRouter is optional.
Read only the relevant recipe:
- [Setup](references/agents/00-setup-base.md), [chat](references/agents/01-chat-streaming.md), [action streaming](references/agents/01-alt-action-stream.md).
- [Search](references/agents/02-web-search.md), [history](references/agents/03-historial-supabase.md), [vision](references/agents/04-vision-analysis.md), [tools](references/agents/05-tools-funciones.md), [RAG](references/agents/06-rag-basico.md).
- [Single call](references/single-call.md), [structured output](references/structured-outputs.md), [generative UI](references/generative-ui.md).
These inherited Vercel AI SDK/OpenRouter recipes require checking current APIs against installed versions. Implement only necessary dependencies; a classifier need not build chat history. Keep privileged calls server-side, enforce tenant ownership, validate tool arguments and authorize external mutations. Test malformed output, provider errors and access boundaries. Application model selection does not reconfigure Codex.
